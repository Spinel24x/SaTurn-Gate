const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userDomain = url.hostname;
    
    // ========== WebSocket Proxy ==========
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
      return handleWebSocket(request, url, env);
    }
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ============ API: Generate VLESS ============
    if (url.pathname === '/api/generate-vless' && request.method === 'POST') {
      try {
        const body = await request.json();
        const config = await generateVLESS(body, userDomain, env);
        return new Response(JSON.stringify(config), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // ============ API: Generate Trojan ============
    if (url.pathname === '/api/generate-trojan' && request.method === 'POST') {
      try {
        const body = await request.json();
        const config = await generateTrojan(body, userDomain, env);
        return new Response(JSON.stringify(config), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // ============ API: Scan IPs ============
    if (url.pathname === '/api/scan' && request.method === 'POST') {
      try {
        const body = await request.json();
        const results = await scanIPs(body, env);
        return new Response(JSON.stringify(results), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // ============ API: Get Saved IPs ============
    if (url.pathname === '/api/scanned-ips') {
      try {
        const { keys } = await env.KV.list({ prefix: 'scan:' });
        const ips = [];
        for (const key of keys) {
          const data = await env.KV.get(key.name, 'json');
          if (data) ips.push(data);
        }
        ips.sort((a, b) => (a.latency || 999) - (b.latency || 999));
        return new Response(JSON.stringify(ips.slice(0, 50)), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify([]), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // ============ API: Clear Scans ============
    if (url.pathname === '/api/clear-scans' && request.method === 'POST') {
      try {
        const { keys } = await env.KV.list({ prefix: 'scan:' });
        for (const key of keys) {
          await env.KV.delete(key.name);
        }
        return new Response(JSON.stringify({ status: 'cleared' }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // Serve static files (panel)
    return env.ASSETS.fetch(request);
  }
};

// ============ WebSocket Proxy Handler ============
async function handleWebSocket(request, url, env) {
  // Create WebSocket pair
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);
  
  // Accept the WebSocket connection
  server.accept();
  
  // Get the path from URL - this is the UUID/password
  const path = url.pathname;
  
  // Find matching config in KV
  let targetConfig = null;
  try {
    const { keys } = await env.KV.list({ prefix: 'config:' });
    for (const key of keys) {
      const config = await env.KV.get(key.name, 'json');
      if (config && (config.path === path || config.uuid === path.replace('/', '') || config.password === path.replace('/', ''))) {
        targetConfig = config;
        break;
      }
    }
  } catch (e) {}
  
  // Handle WebSocket messages - proxy to internet
  server.addEventListener('message', async (event) => {
    try {
      const data = event.data;
      
      // Try to parse as HTTP request for proxying
      let targetUrl;
      try {
        const parsed = JSON.parse(data);
        if (parsed.url) {
          targetUrl = parsed.url;
        }
      } catch (e) {
        // Raw data - just echo back or try to proxy
        targetUrl = data;
      }
      
      if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
        // Proxy the request
        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': '*/*'
          }
        });
        
        const responseBody = await response.text();
        server.send(JSON.stringify({
          status: response.status,
          headers: Object.fromEntries(response.headers),
          body: responseBody
        }));
      } else {
        // Echo back for testing
        server.send(JSON.stringify({
          status: 'connected',
          message: 'SaTurn Gate Proxy Active',
          path: path,
          timestamp: Date.now()
        }));
      }
    } catch (e) {
      server.send(JSON.stringify({
        error: e.message
      }));
    }
  });
  
  server.addEventListener('close', () => {
    // Cleanup
  });
  
  server.addEventListener('error', (e) => {
    // Handle error
  });
  
  return new Response(null, {
    status: 101,
    webSocket: client,
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// ============ VLESS Generator ============
async function generateVLESS(body, userDomain, env) {
  const {
    remark = '',
    address = '',
    port = 443,
    uuid = '',
    sni = '',
    fp = 'chrome',
    alpn = '',
    host = '',
    path = ''
  } = body;
  
  const configUUID = uuid || uuidv4();
  const configRemark = remark || 'SaTurn-VLESS';
  const configAddress = address || userDomain;
  const configPort = parseInt(port) || 443;
  const configSNI = sni || userDomain;
  const configHost = host || userDomain;
  const configPath = path || '/' + configUUID;
  const configFingerprint = fp || 'chrome';
  const configAlpn = alpn || '';
  
  let vlessLink = 'vless://' + configUUID + '@' + configAddress + ':' + configPort;
  vlessLink += '?encryption=none';
  vlessLink += '&security=tls';
  vlessLink += '&sni=' + configSNI;
  vlessLink += '&fp=' + configFingerprint;
  vlessLink += '&type=ws';
  vlessLink += '&path=' + encodeURIComponent(configPath);
  vlessLink += '&host=' + configHost;
  
  if (configAlpn) {
    vlessLink += '&alpn=' + encodeURIComponent(configAlpn);
  }
  
  vlessLink += '#' + encodeURIComponent(configRemark);
  
  try {
    await env.KV.put('config:' + configUUID, JSON.stringify({
      type: 'vless',
      uuid: configUUID,
      address: configAddress,
      port: configPort,
      sni: configSNI,
      host: configHost,
      path: configPath,
      fp: configFingerprint,
      alpn: configAlpn,
      remark: configRemark,
      created: Date.now()
    }));
  } catch (e) {}
  
  return {
    config: vlessLink,
    uuid: configUUID,
    remark: configRemark,
    address: configAddress,
    port: configPort,
    sni: configSNI,
    host: configHost,
    path: configPath
  };
}

// ============ Trojan Generator ============
async function generateTrojan(body, userDomain, env) {
  const {
    remark = '',
    address = '',
    port = 443,
    password = '',
    sni = '',
    fp = 'chrome',
    alpn = '',
    host = '',
    path = ''
  } = body;
  
  const configPassword = password || uuidv4().substring(0, 16);
  const configRemark = remark || 'SaTurn-Trojan';
  const configAddress = address || userDomain;
  const configPort = parseInt(port) || 443;
  const configSNI = sni || userDomain;
  const configHost = host || userDomain;
  const configPath = path || '/' + configPassword;
  const configFingerprint = fp || 'chrome';
  const configAlpn = alpn || '';
  
  let trojanLink = 'trojan://' + configPassword + '@' + configAddress + ':' + configPort;
  trojanLink += '?security=tls';
  trojanLink += '&sni=' + configSNI;
  trojanLink += '&fp=' + configFingerprint;
  trojanLink += '&type=ws';
  trojanLink += '&path=' + encodeURIComponent(configPath);
  trojanLink += '&host=' + configHost;
  
  if (configAlpn) {
    trojanLink += '&alpn=' + encodeURIComponent(configAlpn);
  }
  
  trojanLink += '#' + encodeURIComponent(configRemark);
  
  try {
    await env.KV.put('config:' + configPassword, JSON.stringify({
      type: 'trojan',
      password: configPassword,
      address: configAddress,
      port: configPort,
      sni: configSNI,
      host: configHost,
      path: configPath,
      fp: configFingerprint,
      alpn: configAlpn,
      remark: configRemark,
      created: Date.now()
    }));
  } catch (e) {}
  
  return {
    config: trojanLink,
    password: configPassword,
    remark: configRemark,
    address: configAddress,
    port: configPort,
    sni: configSNI,
    host: configHost,
    path: configPath
  };
}

// ============ IP Scanner ============
async function scanIPs(body, env) {
  const ports = body.ports || [443];
  const range = body.range || 'cf-all';
  
  let ipList = [];
  
  const cfRanges = {
    'cf-all': [
      '104.16.0.0', '104.17.0.0', '104.18.0.0', '104.19.0.0',
      '104.20.0.0', '104.21.0.0', '104.22.0.0', '104.24.0.0',
      '104.26.0.0', '104.27.0.0', '104.28.0.0', '104.30.0.0',
      '104.31.0.0', '172.64.0.0', '131.0.72.0'
    ],
    'cf-popular': [
      '104.21.0.0', '104.16.0.0', '172.64.0.0',
      '104.26.0.0', '104.24.0.0', '104.20.0.0'
    ],
    'cf-iran': [
      '104.21.0.0', '104.16.0.0', '172.64.0.0',
      '104.26.0.0', '104.17.0.0'
    ],
    'gcore': [
      '92.223.0.0', '92.38.0.0', '93.123.0.0'
    ],
    'fastly': [
      '151.101.0.0', '151.101.128.0'
    ]
  };
  
  const selectedRange = cfRanges[range] || cfRanges['cf-all'];
  
  for (let i = 0; i < 30; i++) {
    const base = selectedRange[Math.floor(Math.random() * selectedRange.length)];
    const parts = base.split('.');
    parts[3] = Math.floor(Math.random() * 254) + 1;
    ipList.push(parts.join('.'));
  }
  
  const results = [];
  
  for (const ip of ipList) {
    for (const port of ports) {
      try {
        const start = Date.now();
        const response = await fetch('https://' + ip + ':' + port, {
          signal: AbortSignal.timeout(2500),
          headers: {
            'Host': 'speed.cloudflare.com',
            'User-Agent': 'Mozilla/5.0'
          }
        });
        
        const latency = Date.now() - start;
        
        if (latency < 1000) {
          const cfRay = response.headers.get('cf-ray') || '';
          const ipData = {
            ip: ip,
            port: port,
            latency: latency,
            datacenter: cfRay.split('-')[1] || 'Unknown',
            clean: latency < 250,
            status: 'open',
            scannedAt: Date.now()
          };
          
          try {
            await env.KV.put('scan:' + ip + ':' + port, JSON.stringify(ipData));
          } catch (e) {}
          
          results.push(ipData);
        }
      } catch (e) {}
    }
  }
  
  results.sort((a, b) => a.latency - b.latency);
  
  return {
    status: 'done',
    results: results,
    total: results.length,
    clean: results.filter(r => r.clean).length,
    bestLatency: results.length > 0 ? results[0].latency : null
  };
}
