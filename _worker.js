// SaTurn Gate - Worker Proxy + Config Generator
const uuidv4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0;
  return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
});

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

    // Handle WebSocket upgrade for VLESS/Trojan proxy
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
      return handleWebSocket(request, env);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API: Generate config
    if (url.pathname === '/api/generate' && request.method === 'POST') {
      try {
        const body = await request.json();
        const config = await generateConfig(body, userDomain, env);
        return new Response(JSON.stringify(config), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // API: Scan IPs
    if (url.pathname === '/api/scan' && request.method === 'POST') {
      try {
        const body = await request.json();
        const results = await scanIPs(body, env);
        return new Response(JSON.stringify(results), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // API: Get saved IPs
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

    // API: Clear scans
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
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // Serve static files (panel)
    return env.ASSETS.fetch(request);
  }
};

// ============ WebSocket Proxy Handler ============
async function handleWebSocket(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Get saved config for this path
  let targetServer = null;
  
  try {
    const { keys } = await env.KV.list({ prefix: 'config:' });
    for (const key of keys) {
      const config = await env.KV.get(key.name, 'json');
      if (config && config.path === path) {
        targetServer = config;
        break;
      }
    }
  } catch (e) {}
  
  // Default target - user should set their VPS IP
  const target = targetServer?.address || env.TARGET_SERVER || 'your-vps-ip';
  const targetPort = targetServer?.port || env.TARGET_PORT || '8080';
  
  // Create WebSocket pair
  const [client, server] = Object.values(new WebSocketPair());
  
  // Connect to backend Xray server
  const backendURL = `http://${target}:${targetPort}${path}`;
  
  server.accept();
  
  // Forward to backend
  try {
    const backendResponse = await fetch(backendURL, {
      method: 'GET',
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
        'X-Real-IP': request.headers.get('CF-Connecting-IP') || ''
      }
    });
    
    // If backend supports WebSocket
    if (backendResponse.status === 101) {
      // Create a relay between client and backend
      ctx.waitUntil(relayWebSocket(server, backendResponse));
    }
  } catch (e) {
    server.close(1011, 'Backend connection failed');
  }
  
  return new Response(null, {
    status: 101,
    webSocket: client,
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function relayWebSocket(clientWS, backendResponse) {
  // This is a simplified relay
  // In production, use proper WebSocket relay
  const backendWS = backendResponse.webSocket;
  
  if (!backendWS) return;
  
  backendWS.addEventListener('message', (event) => {
    try {
      clientWS.send(event.data);
    } catch (e) {}
  });
  
  backendWS.addEventListener('close', () => {
    try { clientWS.close(); } catch (e) {}
  });
  
  backendWS.addEventListener('error', () => {
    try { clientWS.close(); } catch (e) {}
  });
}

// ============ Config Generator ============
async function generateConfig(body, userDomain, env) {
  const {
    type = 'vless',
    address = userDomain,
    port = 443,
    sni = 'www.google.com',
    uuid = '',
    network = 'ws',
    security = 'tls',
    fp = 'chrome',
    alpn = '',
    sid = '',
    host = '',
    path = '',
    remark = ''
  } = body;
  
  const configUUID = uuid || uuidv4();
  const configSid = sid || Math.random().toString(16).substring(2, 10);
  const configHost = host || userDomain;
  const configPath = path || '/' + configUUID.substring(0, 8);
  const configRemark = remark || 'SaTurn-' + type.toUpperCase();
  const configAddress = address || userDomain;
  
  let configLink = '';
  
  if (type === 'vless') {
    configLink = buildVlessLink({
      uuid: configUUID,
      address: configAddress,
      port,
      sni,
      network,
      security,
      fp,
      alpn,
      sid: configSid,
      host: configHost,
      path: configPath,
      remark: configRemark
    });
  } else {
    configLink = buildTrojanLink({
      password: configUUID.substring(0, 16),
      address: configAddress,
      port,
      sni,
      network,
      security,
      fp,
      alpn,
      sid: configSid,
      host: configHost,
      path: configPath,
      remark: configRemark
    });
  }
  
  const serverConfig = buildServerConfig({
    type,
    uuid: configUUID,
    port,
    sni,
    network,
    security,
    host: configHost,
    path: configPath,
    shortId: configSid
  });
  
  // Save config
  try {
    await env.KV.put('config:' + configUUID, JSON.stringify({
      type,
      address: configAddress,
      port,
      sni,
      uuid: configUUID,
      network,
      security,
      host: configHost,
      path: configPath,
      sid: configSid,
      created: Date.now()
    }));
  } catch (e) {}
  
  return {
    config: configLink,
    serverConfig,
    uuid: configUUID,
    shortId: configSid,
    path: configPath
  };
}

function buildVlessLink(opts) {
  let url = `vless://${opts.uuid}@${opts.address}:${opts.port}`;
  const params = [
    `encryption=none`,
    `security=${opts.security}`,
    `sni=${opts.sni}`,
    `fp=${opts.fp}`,
    `type=${opts.network}`
  ];
  
  if (opts.security === 'reality') {
    params.push(`sid=${opts.sid}`);
    params.push(`flow=xtls-rprx-vision`);
  }
  
  if (opts.alpn) params.push(`alpn=${encodeURIComponent(opts.alpn)}`);
  
  if (opts.network === 'ws') {
    params.push(`path=${encodeURIComponent(opts.path)}`);
    params.push(`host=${opts.host}`);
  }
  
  return url + '?' + params.join('&') + '#' + encodeURIComponent(opts.remark);
}

function buildTrojanLink(opts) {
  let url = `trojan://${opts.password}@${opts.address}:${opts.port}`;
  const params = [
    `security=${opts.security}`,
    `sni=${opts.sni}`,
    `fp=${opts.fp}`,
    `type=${opts.network}`
  ];
  
  if (opts.security === 'reality') {
    params.push(`sid=${opts.sid}`);
    params.push(`flow=xtls-rprx-vision`);
  }
  
  if (opts.alpn) params.push(`alpn=${encodeURIComponent(opts.alpn)}`);
  
  if (opts.network === 'ws') {
    params.push(`path=${encodeURIComponent(opts.path)}`);
    params.push(`host=${opts.host}`);
  }
  
  return url + '?' + params.join('&') + '#' + encodeURIComponent(opts.remark);
}

function buildServerConfig(opts) {
  const config = {
    log: { loglevel: 'warning' },
    inbounds: [{
      port: 8080,
      listen: '127.0.0.1',
      protocol: 'vless',
      tag: 'worker-in',
      settings: {
        clients: [],
        decryption: 'none'
      },
      streamSettings: {
        network: 'ws',
        wsSettings: {
          path: opts.path,
          headers: { Host: opts.host }
        }
      },
      sniffing: { enabled: true, destOverride: ['http', 'tls'] }
    }, {
      port: opts.port,
      protocol: opts.type,
      tag: 'direct-in',
      settings: {},
      streamSettings: {
        network: 'tcp',
        security: opts.security
      },
      sniffing: { enabled: true, destOverride: ['http', 'tls'] }
    }],
    outbounds: [{
      protocol: 'freedom',
      tag: 'direct'
    }]
  };
  
  if (opts.type === 'vless') {
    config.inbounds[0].settings.clients = [{ id: opts.uuid, flow: 'xtls-rprx-vision' }];
    config.inbounds[1].settings = {
      clients: [{ id: opts.uuid, flow: 'xtls-rprx-vision' }],
      decryption: 'none'
    };
  } else {
    config.inbounds[0].settings.clients = [{ password: opts.uuid.substring(0, 16) }];
    config.inbounds[1].settings = {
      clients: [{ password: opts.uuid.substring(0, 16) }]
    };
    config.inbounds[0].protocol = 'trojan';
  }
  
  if (opts.security === 'reality') {
    config.inbounds[1].streamSettings.realitySettings = {
      dest: opts.sni + ':443',
      serverNames: [opts.sni],
      privateKey: 'YOUR_PRIVATE_KEY_HERE',
      shortIds: [opts.shortId]
    };
  } else if (opts.security === 'tls') {
    config.inbounds[1].streamSettings.tlsSettings = {
      serverName: opts.sni,
      certificates: [{ certificateFile: '/etc/xray/fullchain.pem', keyFile: '/etc/xray/privkey.pem' }]
    };
  }
  
  return JSON.stringify(config, null, 2);
}

// ============ IP Scanner ============
async function scanIPs(body, env) {
  const ports = body.ports || [443];
  const range = body.range || 'cf';
  
  let ipList = [];
  
  const cfRanges = [
    '104.16.0.0', '104.24.0.0', '172.64.0.0',
    '131.0.72.0', '104.26.0.0', '104.20.0.0',
    '104.31.0.0', '104.21.0.0', '104.17.0.0',
    '104.18.0.0', '104.19.0.0', '104.22.0.0'
  ];
  
  for (let i = 0; i < 30; i++) {
    const base = cfRanges[Math.floor(Math.random() * cfRanges.length)];
    const parts = base.split('.');
    parts[3] = Math.floor(Math.random() * 254) + 1;
    ipList.push(parts.join('.'));
  }
  
  const results = [];
  
  for (const ip of ipList) {
    for (const port of ports) {
      try {
        const start = Date.now();
        const response = await fetch(`https://${ip}:${port}`, {
          signal: AbortSignal.timeout(2500),
          headers: { 'Host': 'speed.cloudflare.com', 'User-Agent': 'Mozilla/5.0' }
        });
        const latency = Date.now() - start;
        
        if (latency < 1000) {
          const ipData = {
            ip, port, latency,
            datacenter: (response.headers.get('cf-ray') || '').split('-')[1] || 'Unknown',
            clean: latency < 250,
            status: 'open',
            scannedAt: Date.now()
          };
          
          try { await env.KV.put('scan:' + ip + ':' + port, JSON.stringify(ipData)); } catch (e) {}
          results.push(ipData);
        }
      } catch (e) {}
    }
  }
  
  results.sort((a, b) => a.latency - b.latency);
  
  return {
    status: 'done',
    results,
    total: results.length,
    clean: results.filter(r => r.clean).length
  };
}
