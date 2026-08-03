const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

// CF IP ranges with good performance
const CF_IP_RANGES = [
  { subnet: '104.21.0.0', mask: 16, name: 'Cloudflare Main' },
  { subnet: '104.16.0.0', mask: 13, name: 'Cloudflare CDN 1' },
  { subnet: '104.24.0.0', mask: 14, name: 'Cloudflare CDN 2' },
  { subnet: '172.64.0.0', mask: 14, name: 'Cloudflare CDN 3' },
  { subnet: '104.26.0.0', mask: 15, name: 'Cloudflare CDN 4' },
  { subnet: '104.20.0.0', mask: 14, name: 'Cloudflare CDN 5' },
  { subnet: '104.31.0.0', mask: 16, name: 'Cloudflare CDN 6' },
  { subnet: '104.17.0.0', mask: 16, name: 'Cloudflare CDN 7' },
  { subnet: '104.18.0.0', mask: 16, name: 'Cloudflare CDN 8' },
  { subnet: '104.19.0.0', mask: 16, name: 'Cloudflare CDN 9' },
  { subnet: '104.22.0.0', mask: 15, name: 'Cloudflare CDN 10' },
  { subnet: '104.27.0.0', mask: 16, name: 'Cloudflare CDN 11' },
  { subnet: '104.28.0.0', mask: 15, name: 'Cloudflare CDN 12' },
  { subnet: '104.30.0.0', mask: 16, name: 'Cloudflare CDN 13' },
  { subnet: '141.101.0.0', mask: 16, name: 'Cloudflare Edge' },
  { subnet: '188.114.0.0', mask: 15, name: 'Cloudflare EU' },
  { subnet: '162.158.0.0', mask: 15, name: 'Cloudflare US' },
  { subnet: '173.245.0.0', mask: 16, name: 'Cloudflare Legacy' },
  { subnet: '190.93.0.0', mask: 16, name: 'Cloudflare LATAM' },
  { subnet: '197.234.0.0', mask: 16, name: 'Cloudflare AFR' }
];

// Valid ports for Cloudflare
const VALID_PORTS = [443, 8443, 2053, 2083, 2087, 2096];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userDomain = url.hostname;
    
    // ========== WebSocket Proxy Handler ==========
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
      return handleWSSProxy(request, url, env);
    }
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ============ API: Professional Scan ============
    if (url.pathname === '/api/scan' && request.method === 'POST') {
      try {
        const body = await request.json();
        const results = await professionalScan(body, env, ctx);
        return new Response(JSON.stringify(results), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, results: [] }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // ============ API: Quick Test IP ============
    if (url.pathname === '/api/test-ip' && request.method === 'POST') {
      try {
        const body = await request.json();
        const result = await testSingleIP(body.ip, body.port || 443);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
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

    // ============ API: Get Saved IPs ============
    if (url.pathname === '/api/saved-ips') {
      try {
        const { keys } = await env.KV.list({ prefix: 'scan:' });
        const ips = [];
        for (const key of keys) {
          const data = await env.KV.get(key.name, 'json');
          if (data) ips.push(data);
        }
        ips.sort((a, b) => (a.latency || 999) - (b.latency || 999));
        return new Response(JSON.stringify(ips.slice(0, 100)), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify([]), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // ============ API: Clear ============
    if (url.pathname === '/api/clear' && request.method === 'POST') {
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

    // Serve panel
    return env.ASSETS.fetch(request);
  }
};

// ============ WebSocket Proxy ============
async function handleWSSProxy(request, url, env) {
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);
  
  server.accept();
  
  const path = url.pathname;
  
  server.addEventListener('message', async (event) => {
    try {
      let targetUrl;
      let requestData;
      
      try {
        requestData = JSON.parse(event.data);
        targetUrl = requestData.url || requestData.target;
      } catch (e) {
        targetUrl = event.data;
      }
      
      if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
        const fetchOptions = {
          headers: {
            'User-Agent': requestData?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': requestData?.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': requestData?.acceptLanguage || 'en-US,en;q=0.5'
          }
        };
        
        if (requestData?.method) fetchOptions.method = requestData.method;
        if (requestData?.body) fetchOptions.body = requestData.body;
        if (requestData?.headers) fetchOptions.headers = { ...fetchOptions.headers, ...requestData.headers };
        
        const response = await fetch(targetUrl, fetchOptions);
        const body = await response.text();
        
        server.send(JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers),
          body: body,
          url: targetUrl
        }));
      } else {
        // Echo response for connectivity test
        server.send(JSON.stringify({
          status: 'connected',
          message: 'SaTurn Gateway Active',
          path: path,
          timestamp: Date.now(),
          ip: request.headers.get('CF-Connecting-IP')
        }));
      }
    } catch (e) {
      server.send(JSON.stringify({
        status: 'error',
        error: e.message
      }));
    }
  });
  
  server.addEventListener('close', () => {});
  server.addEventListener('error', (e) => {});
  
  return new Response(null, {
    status: 101,
    webSocket: client,
    headers: { 'Access-Control-Allow-Origin': '*' }
  });
}

// ============ Professional Scanner ============
async function professionalScan(body, env, ctx) {
  const ports = body.ports || [443];
  const count = body.count || 50;
  const timeout = body.timeout || 3000;
  
  // Generate IPs
  const ipList = [];
  for (let i = 0; i < count; i++) {
    const range = CF_IP_RANGES[Math.floor(Math.random() * CF_IP_RANGES.length)];
    const parts = range.subnet.split('.');
    const hostBits = 32 - range.mask;
    const maxHost = Math.pow(2, hostBits) - 2;
    
    // Generate random IP within range
    let offset = Math.floor(Math.random() * maxHost) + 1;
    parts[3] = (parseInt(parts[3]) + (offset % 256)) % 256;
    if (offset > 256) {
      parts[2] = (parseInt(parts[2]) + Math.floor(offset / 256)) % 256;
    }
    
    ipList.push({
      ip: parts.join('.'),
      range: range.name
    });
  }
  
  // Scan with concurrency
  const results = [];
  const scanPromises = [];
  
  for (const { ip, range } of ipList) {
    for (const port of ports) {
      scanPromises.push(
        scanSingleIP(ip, port, timeout, range, env)
          .then(result => {
            if (result && result.open) {
              results.push(result);
            }
          })
          .catch(() => {})
      );
    }
  }
  
  await Promise.allSettled(scanPromises);
  
  // Sort by latency
  results.sort((a, b) => a.latency - b.latency);
  
  // Mark clean IPs (low latency + specific conditions)
  const cleanResults = results.map(r => ({
    ...r,
    clean: r.latency < 200 && r.httpStatus === 200,
    veryClean: r.latency < 100 && r.httpStatus === 200 && r.cfRay
  }));
  
  return {
    status: 'done',
    results: cleanResults,
    total: cleanResults.length,
    clean: cleanResults.filter(r => r.clean).length,
    veryClean: cleanResults.filter(r => r.veryClean).length,
    bestLatency: cleanResults.length > 0 ? cleanResults[0].latency : null,
    scannedAt: Date.now()
  };
}

async function scanSingleIP(ip, port, timeout, range, env) {
  try {
    const start = Date.now();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch('https://' + ip + ':' + port, {
      signal: controller.signal,
      headers: {
        'Host': 'speed.cloudflare.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
      }
    });
    
    clearTimeout(timeoutId);
    
    const latency = Date.now() - start;
    const cfRay = response.headers.get('cf-ray') || '';
    const cfCacheStatus = response.headers.get('cf-cache-status') || '';
    const server = response.headers.get('server') || '';
    const contentType = response.headers.get('content-type') || '';
    
    const result = {
      ip,
      port,
      latency,
      range,
      httpStatus: response.status,
      cfRay,
      cfCacheStatus,
      server,
      contentType,
      datacenter: cfRay.split('-')[1] || 'Unknown',
      open: response.status >= 200 && response.status < 500,
      scannedAt: Date.now()
    };
    
    // Save best results to KV
    if (result.open && latency < 300) {
      try {
        await env.KV.put('scan:' + ip + ':' + port, JSON.stringify(result), {
          expirationTtl: 3600
        });
      } catch (e) {}
    }
    
    return result;
  } catch (e) {
    return {
      ip,
      port,
      open: false,
      error: e.message,
      scannedAt: Date.now()
    };
  }
}

async function testSingleIP(ip, port) {
  return await scanSingleIP(ip, port, 5000, 'Manual Test', null);
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
