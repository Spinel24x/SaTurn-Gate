function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function randomShortId() {
  return Math.random().toString(16).substring(2, 10);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userDomain = url.hostname;
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API: Generate Smart Config
    if (url.pathname === '/api/generate' && request.method === 'POST') {
      try {
        const body = await request.json();
        
        // Extract all params with smart defaults
        const configType = body.type || 'vless';
        const configAddress = body.address || '';
        const configPort = parseInt(body.port) || 443;
        const configSNI = body.sni || 'www.google.com';
        const configUUID = body.uuid || uuidv4();
        const configNetwork = body.network || 'ws';
        const configSecurity = body.security || 'reality';
        const configFingerprint = body.fp || 'chrome';
        const configAlpn = body.alpn || '';
        const configShortId = body.sid || randomShortId();
        const configRemark = body.remark || 'SaTurn-' + configType.toUpperCase();
        
        // WS settings - Auto-fill with user domain
        const configHost = body.host || userDomain;
        const configPath = body.path || '/' + configUUID.substring(0, 8);
        
        // Reality public key (optional)
        const configPublicKey = body.pbk || '';
        
        // SpiderX
        const configSpiderX = body.spx || '/';
        
        // Build config based on type
        let finalConfig = '';
        
        if (configType === 'vless') {
          finalConfig = buildVlessLink({
            uuid: configUUID,
            address: configAddress,
            port: configPort,
            sni: configSNI,
            network: configNetwork,
            security: configSecurity,
            fp: configFingerprint,
            alpn: configAlpn,
            sid: configShortId,
            pbk: configPublicKey,
            spx: configSpiderX,
            host: configHost,
            path: configPath,
            remark: configRemark
          });
        } else if (configType === 'trojan') {
          finalConfig = buildTrojanLink({
            password: configUUID.substring(0, 16),
            address: configAddress,
            port: configPort,
            sni: configSNI,
            network: configNetwork,
            security: configSecurity,
            fp: configFingerprint,
            alpn: configAlpn,
            sid: configShortId,
            pbk: configPublicKey,
            spx: configSpiderX,
            host: configHost,
            path: configPath,
            remark: configRemark
          });
        }
        
        // Build Xray server config
        const serverConfig = buildXrayConfig({
          type: configType,
          uuid: configUUID,
          port: configPort,
          sni: configSNI,
          network: configNetwork,
          security: configSecurity,
          host: configHost,
          path: configPath,
          shortId: configShortId
        });
        
        // Save to KV
        try {
          await env.KV.put('config:' + configUUID, JSON.stringify({
            type: configType,
            address: configAddress,
            port: configPort,
            sni: configSNI,
            uuid: configUUID,
            network: configNetwork,
            security: configSecurity,
            host: configHost,
            path: configPath,
            created: Date.now()
          }));
        } catch (e) {}
        
        return new Response(JSON.stringify({
          config: finalConfig,
          serverConfig: serverConfig,
          uuid: configUUID,
          shortId: configShortId
        }), {
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
        const scanPorts = body.ports || [443];
        const range = body.range || 'cf';
        
        let ipList = [];
        
        if (range === 'cf') {
          // Full Cloudflare IP ranges
          const cfRanges = [
            { base: '104.16.0.0', mask: 12 },
            { base: '104.24.0.0', mask: 13 },
            { base: '172.64.0.0', mask: 14 },
            { base: '131.0.72.0', mask: 22 },
            { base: '104.26.0.0', mask: 15 },
            { base: '104.20.0.0', mask: 14 },
            { base: '104.31.0.0', mask: 16 },
            { base: '104.21.0.0', mask: 16 },
            { base: '104.17.0.0', mask: 16 },
            { base: '104.18.0.0', mask: 16 },
            { base: '104.19.0.0', mask: 16 },
            { base: '104.22.0.0', mask: 15 },
            { base: '104.27.0.0', mask: 16 },
            { base: '104.28.0.0', mask: 15 },
            { base: '104.30.0.0', mask: 16 }
          ];
          
          for (let i = 0; i < 30; i++) {
            const randRange = cfRanges[Math.floor(Math.random() * cfRanges.length)];
            const parts = randRange.base.split('.');
            parts[3] = Math.floor(Math.random() * 254) + 1;
            ipList.push(parts.join('.'));
          }
        } else if (range === 'custom' && body.customRange) {
          const [baseIP, mask] = body.customRange.split('/');
          const parts = baseIP.split('.');
          const subnetMask = parseInt(mask) || 24;
          const hosts = Math.pow(2, 32 - subnetMask);
          
          for (let i = 0; i < Math.min(20, hosts); i++) {
            const newParts = [...parts];
            newParts[3] = Math.floor(Math.random() * 254) + 1;
            ipList.push(newParts.join('.'));
          }
        }
        
        const results = await scanIPs(ipList, scanPorts, env);
        
        return new Response(JSON.stringify({
          status: 'done',
          results: results,
          total: results.length,
          clean: results.filter(r => r.clean).length
        }), {
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

    // Serve static files
    return env.ASSETS.fetch(request);
  }
};

// ============ Config Link Builders ============

function buildVlessLink(opts) {
  let url = 'vless://' + opts.uuid + '@' + opts.address + ':' + opts.port;
  
  let params = [];
  
  // Core params
  params.push('encryption=none');
  params.push('type=' + opts.network);
  params.push('security=' + opts.security);
  params.push('sni=' + opts.sni);
  params.push('fp=' + opts.fp);
  
  // Reality params
  if (opts.security === 'reality') {
    if (opts.pbk) params.push('pbk=' + opts.pbk);
    params.push('sid=' + opts.sid);
    params.push('spx=' + encodeURIComponent(opts.spx));
    params.push('flow=xtls-rprx-vision');
  }
  
  // ALPN
  if (opts.alpn) {
    params.push('alpn=' + encodeURIComponent(opts.alpn));
  }
  
  // WS params
  if (opts.network === 'ws') {
    params.push('path=' + encodeURIComponent(opts.path));
    params.push('host=' + opts.host);
  }
  
  url += '?' + params.join('&');
  url += '#' + encodeURIComponent(opts.remark);
  
  return url;
}

function buildTrojanLink(opts) {
  let url = 'trojan://' + opts.password + '@' + opts.address + ':' + opts.port;
  
  let params = [];
  
  params.push('type=' + opts.network);
  params.push('security=' + opts.security);
  params.push('sni=' + opts.sni);
  params.push('fp=' + opts.fp);
  
  if (opts.security === 'reality') {
    if (opts.pbk) params.push('pbk=' + opts.pbk);
    params.push('sid=' + opts.sid);
    params.push('spx=' + encodeURIComponent(opts.spx));
    params.push('flow=xtls-rprx-vision');
  }
  
  if (opts.alpn) {
    params.push('alpn=' + encodeURIComponent(opts.alpn));
  }
  
  if (opts.network === 'ws') {
    params.push('path=' + encodeURIComponent(opts.path));
    params.push('host=' + opts.host);
  }
  
  url += '?' + params.join('&');
  url += '#' + encodeURIComponent(opts.remark);
  
  return url;
}

// ============ Xray Server Config Builder ============

function buildXrayConfig(opts) {
  const config = {
    log: { loglevel: 'warning' },
    inbounds: [{
      port: opts.port,
      protocol: opts.type,
      tag: 'SaTurn-inbound',
      settings: {},
      streamSettings: {
        network: opts.network,
        security: opts.security
      },
      sniffing: {
        enabled: true,
        destOverride: ['http', 'tls']
      }
    }],
    outbounds: [{
      protocol: 'freedom',
      tag: 'direct'
    }]
  };
  
  // Protocol-specific settings
  if (opts.type === 'vless') {
    config.inbounds[0].settings = {
      clients: [{
        id: opts.uuid,
        flow: 'xtls-rprx-vision'
      }],
      decryption: 'none'
    };
  } else if (opts.type === 'trojan') {
    config.inbounds[0].settings = {
      clients: [{
        password: opts.uuid.substring(0, 16)
      }]
    };
  }
  
  // Network settings
  if (opts.network === 'ws') {
    config.inbounds[0].streamSettings.wsSettings = {
      path: opts.path,
      headers: {
        Host: opts.host
      }
    };
  } else if (opts.network === 'grpc') {
    config.inbounds[0].streamSettings.grpcSettings = {
      serviceName: opts.path.replace('/', '')
    };
  }
  
  // Security settings
  if (opts.security === 'reality') {
    config.inbounds[0].streamSettings.realitySettings = {
      dest: opts.sni + ':443',
      serverNames: [opts.sni],
      privateKey: 'YOUR_PRIVATE_KEY_HERE',
      shortIds: [opts.shortId || '6ba85179']
    };
  } else if (opts.security === 'tls') {
    config.inbounds[0].streamSettings.tlsSettings = {
      serverName: opts.sni
    };
  }
  
  return JSON.stringify(config, null, 2);
}

// ============ Smart IP Scanner ============

async function scanIPs(ipList, ports, env) {
  const results = [];
  const scannedIPs = new Set();
  
  for (const ip of ipList) {
    if (scannedIPs.has(ip)) continue;
    scannedIPs.add(ip);
    
    for (const port of ports) {
      try {
        const start = Date.now();
        
        // Try HTTPS connection
        const response = await fetch('https://' + ip + ':' + port, {
          signal: AbortSignal.timeout(2500),
          headers: {
            'Host': 'speed.cloudflare.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const latency = Date.now() - start;
        const cfRay = response.headers.get('cf-ray');
        const datacenter = cfRay ? cfRay.split('-')[1] : 'Unknown';
        const server = response.headers.get('server') || '';
        
        // Only accept if latency is reasonable
        if (latency < 1000) {
          const ipData = {
            ip,
            port,
            latency,
            datacenter,
            server,
            clean: latency < 250,
            status: 'open',
            scannedAt: Date.now()
          };
          
          // Save to KV (best effort)
          try {
            await env.KV.put('scan:' + ip + ':' + port, JSON.stringify(ipData));
          } catch (e) {}
          
          results.push(ipData);
        }
      } catch (e) {
        // Timeout or connection refused - skip
      }
    }
  }
  
  // Sort by latency (fastest first)
  results.sort((a, b) => a.latency - b.latency);
  
  return results;
}
