// SaTurn Gate - WS Proxy + Config Generator
// این Worker ترافیک WS رو از طریق Cloudflare Tunnel به Xray محلی میفرسته

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userDomain = url.hostname;
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Upgrade',
      'Access-Control-Allow-Credentials': 'true'
    };

    // ========== WebSocket Proxy (اتصال به Xray محلی) ==========
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
      return handleWSProxy(request, url, env);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ========== API: Generate VLESS Config ==========
    if (url.pathname === '/api/generate' && request.method === 'POST') {
      try {
        const body = await request.json();
        const config = generateConfig(body, userDomain);
        return new Response(JSON.stringify(config), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // Serve panel
    return env.ASSETS.fetch(request);
  }
};

// ========== WebSocket Proxy Handler ==========
async function handleWSProxy(request, url, env) {
  const upgradeHeader = request.headers.get('Upgrade');
  
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket', { status: 400 });
  }
  
  // Get target from path - path format: /UUID
  const wsPath = url.pathname;
  
  // آدرس Xray محلی که از طریق Tunnel در دسترسه
  // این آدرس رو باید با آدرس Tunnel خودت جایگزین کنی
  const LOCAL_XRAY = env.XRAY_ENDPOINT || 'http://localhost:8080';
  
  try {
    // اتصال به Xray محلی از طریق Tunnel
    const targetUrl = LOCAL_XRAY + wsPath;
    
    // Forward WebSocket to local Xray
    const proxyResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Key': request.headers.get('Sec-WebSocket-Key') || '',
        'Sec-WebSocket-Version': '13',
        'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
        'X-Real-IP': request.headers.get('CF-Connecting-IP') || '',
        'Host': new URL(LOCAL_XRAY).hostname
      }
    });
    
    if (proxyResponse.status === 101) {
      // WebSocket handshake successful
      return new Response(null, {
        status: 101,
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Sec-WebSocket-Accept': proxyResponse.headers.get('Sec-WebSocket-Accept') || '',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // If Xray is not available, create direct proxy WebSocket
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    
    server.accept();
    
    server.addEventListener('message', async (event) => {
      try {
        const data = event.data;
        
        // Try to proxy the request
        let targetUrl;
        try {
          const parsed = JSON.parse(data);
          targetUrl = parsed.url || parsed.target;
        } catch (e) {
          // Raw data - proxy to local Xray
          try {
            const response = await fetch(LOCAL_XRAY + '/proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/octet-stream' },
              body: data
            });
            const responseData = await response.arrayBuffer();
            server.send(responseData);
          } catch (err) {
            server.send(JSON.stringify({
              status: 'error',
              message: 'Xray backend not available. Please set up Cloudflare Tunnel.',
              hint: 'Run: cloudflared tunnel --url http://localhost:8080'
            }));
          }
          return;
        }
        
        if (targetUrl && targetUrl.startsWith('http')) {
          const response = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0'
            }
          });
          const body = await response.text();
          server.send(JSON.stringify({
            status: response.status,
            body: body
          }));
        }
      } catch (e) {
        server.send(JSON.stringify({ error: e.message }));
      }
    });
    
    server.addEventListener('close', () => {});
    server.addEventListener('error', () => {});
    
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
    
  } catch (e) {
    // Tunnel not available - return error info
    return new Response(JSON.stringify({
      error: 'Tunnel connection failed',
      message: 'Please set up Cloudflare Tunnel to your local Xray',
      setup: 'Run: cloudflared tunnel --url http://localhost:8080',
      xrayEndpoint: LOCAL_XRAY
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ========== Config Generator ==========
function generateConfig(body, domain) {
  const type = body.type || 'vless';
  const uuid = body.uuid || generateUUID();
  const sni = body.sni || domain;
  const fp = body.fp || 'chrome';
  const alpn = body.alpn || '';
  const host = body.host || domain;
  const path = body.path || '/' + uuid;
  const remark = body.remark || 'SaTurn-' + type.toUpperCase();
  
  let config = '';
  
  if (type === 'vless') {
    config = buildVLESS({ uuid, domain, sni, fp, alpn, host, path, remark });
  } else if (type === 'trojan') {
    config = buildTrojan({ password: uuid.substring(0, 16), domain, sni, fp, alpn, host, path, remark });
  }
  
  return {
    config,
    uuid,
    type,
    path,
    host,
    sni,
    remark
  };
}

function buildVLESS(opts) {
  let url = `vless://${opts.uuid}@${opts.domain}:443`;
  url += '?encryption=none';
  url += '&security=tls';
  url += `&sni=${opts.sni}`;
  url += `&fp=${opts.fp}`;
  url += '&type=ws';
  url += `&path=${encodeURIComponent(opts.path)}`;
  url += `&host=${opts.host}`;
  if (opts.alpn) url += `&alpn=${encodeURIComponent(opts.alpn)}`;
  url += `#${encodeURIComponent(opts.remark)}`;
  return url;
}

function buildTrojan(opts) {
  let url = `trojan://${opts.password}@${opts.domain}:443`;
  url += '?security=tls';
  url += `&sni=${opts.sni}`;
  url += `&fp=${opts.fp}`;
  url += '&type=ws';
  url += `&path=${encodeURIComponent(opts.path)}`;
  url += `&host=${opts.host}`;
  if (opts.alpn) url += `&alpn=${encodeURIComponent(opts.alpn)}`;
  url += `#${encodeURIComponent(opts.remark)}`;
  return url;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
