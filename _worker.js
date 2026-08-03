function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API: Scan IPs
    if (url.pathname === '/api/scan' && request.method === 'POST') {
      try {
        const { ports } = await request.json();
        const scanPorts = ports || [443];
        
        const cfRanges = [
          '104.16.0.0/12', '104.24.0.0/13', '172.64.0.0/14',
          '131.0.72.0/22', '104.26.0.0/15', '104.20.0.0/14',
          '104.31.0.0/16', '104.21.0.0/16'
        ];
        
        let ipList = [];
        for (let i = 0; i < 20; i++) {
          const randomRange = cfRanges[Math.floor(Math.random() * cfRanges.length)];
          const base = randomRange.split('/')[0];
          const parts = base.split('.');
          parts[3] = Math.floor(Math.random() * 254) + 1;
          ipList.push(parts.join('.'));
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

    // API: Generate Config (Smart Core)
    if (url.pathname === '/api/generate' && request.method === 'POST') {
      try {
        const body = await request.json();
        const {
          type,
          address,
          port,
          sni,
          uuid,
          network,
          security,
          fp,
          alpn,
          pbk,
          sid,
          spx,
          path,
          host,
          remark
        } = body;

        // Generate UUID if empty
        const configUuid = uuid || uuidv4();
        
        // Set defaults
        const configAddress = address || '';
        const configPort = port || 443;
        const configSNI = sni || 'www.google.com';
        const configNetwork = network || 'ws';
        const configSecurity = security || 'reality';
        const configFingerprint = fp || 'chrome';
        const configAlpn = alpn || 'h2,http/1.1';
        const configPublicKey = pbk || '';
        const configShortId = sid || '6ba85179';
        const configSpiderX = spx || '/';
        const configPath = path || '/' + configUuid;
        const configHost = host || '';
        const configRemark = remark || 'SaTurn-' + type.toUpperCase();
        
        let finalConfig = '';
        let serverConfig = '';
        
        // Generate based on type
        if (type === 'vless') {
          finalConfig = buildVlessConfig({
            uuid: configUuid,
            address: configAddress,
            port: configPort,
            sni: configSNI,
            network: configNetwork,
            security: configSecurity,
            fp: configFingerprint,
            alpn: configAlpn,
            pbk: configPublicKey,
            sid: configShortId,
            spx: configSpiderX,
            path: configPath,
            host: configHost,
            remark: configRemark
          });
          
          serverConfig = buildXrayServerConfig({
            protocol: 'vless',
            uuid: configUuid,
            port: configPort,
            sni: configSNI,
            network: configNetwork,
            security: configSecurity,
            path: configPath,
            host: configHost,
            shortId: configShortId
          });
        } else if (type === 'trojan') {
          finalConfig = buildTrojanConfig({
            password: configUuid.substring(0, 16),
            address: configAddress,
            port: configPort,
            sni: configSNI,
            network: configNetwork,
            security: configSecurity,
            fp: configFingerprint,
            alpn: configAlpn,
            pbk: configPublicKey,
            sid: configShortId,
            spx: configSpiderX,
            path: configPath,
            host: configHost,
            remark: configRemark
          });
          
          serverConfig = buildXrayServerConfig({
            protocol: 'trojan',
            password: configUuid.substring(0, 16),
            port: configPort,
            sni: configSNI,
            network: configNetwork,
            security: configSecurity,
            path: configPath,
            host: configHost,
            shortId: configShortId
          });
        }
        
        // Save to KV
        await env.KV.put('config:' + configUuid, JSON.stringify({
          type,
          address: configAddress,
          port: configPort,
          sni: configSNI,
          uuid: configUuid,
          network: configNetwork,
          security: configSecurity,
          created: Date.now()
        }));
        
        return new Response(JSON.stringify({
          config: finalConfig,
          serverConfig: serverConfig,
          uuid: configUuid
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

    // Fallback: Serve static files
    return env.ASSETS.fetch(request);
  }
};

// ============ Config Builders ============

function buildVlessConfig(opts) {
  let url = 'vless://' + opts.uuid + '@' + opts.address + ':' + opts.port;
  
  let params = [];
  params.push('encryption=none');
  params.push('security=' + opts.security);
  params.push('sni=' + opts.sni);
  params.push('fp=' + opts.fp);
  params.push('type=' + opts.network);
  
  if (opts.security === 'reality') {
    if (opts.pbk) params.push('pbk=' + opts.pbk);
    params.push('sid=' + opts.sid);
    params.push('spx=' + encodeURIComponent(opts.spx));
  }
  
  if (opts.alpn) params.push('alpn=' + encodeURIComponent(opts.alpn));
  
  if (opts.network === 'ws') {
    if (opts.host) params.push('host=' + opts.host);
    params.push('path=' + encodeURIComponent(opts.path));
  }
  
  url += '?' + params.join('&');
  url += '#' + encodeURIComponent(opts.remark);
  
  return url;
}

function buildTrojanConfig(opts) {
  let url = 'trojan://' + opts.password + '@' + opts.address + ':' + opts.port;
  
  let params = [];
  params.push('security=' + opts.security);
  params.push('sni=' + opts.sni);
  params.push('fp=' + opts.fp);
  params.push('type=' + opts.network);
  
  if (opts.security === 'reality') {
    if (opts.pbk) params.push('pbk=' + opts.pbk);
    params.push('sid=' + opts.sid);
    params.push('spx=' + encodeURIComponent(opts.spx));
  }
  
  if (opts.alpn) params.push('alpn=' + encodeURIComponent(opts.alpn));
  
  if (opts.network === 'ws') {
    if (opts.host) params.push('host=' + opts.host);
    params.push('path=' + encodeURIComponent(opts.path));
  }
  
  url += '?' + params.join('&');
  url += '#' + encodeURIComponent(opts.remark);
  
  return url;
}

function buildXrayServerConfig(opts) {
  const config = {
    inbounds: [{
      port: opts.port,
      protocol: opts.protocol,
      settings: {},
      streamSettings: {
        network: opts.network,
        security: opts.security
      }
    }]
  };
  
  if (opts.protocol === 'vless') {
    config.inbounds[0].settings = {
      clients: [{ id: opts.uuid, flow: 'xtls-rprx-vision' }],
      decryption: 'none'
    };
  } else if (opts.protocol === 'trojan') {
    config.inbounds[0].settings = {
      clients: [{ password: opts.password }]
    };
  }
  
  if (opts.network === 'ws') {
    config.inbounds[0].streamSettings.wsSettings = {
      path: opts.path
    };
    if (opts.host) {
      config.inbounds[0].streamSettings.wsSettings.headers = {
        Host: opts.host
      };
    }
  }
  
  if (opts.security === 'reality') {
    config.inbounds[0].streamSettings.realitySettings = {
      dest: opts.sni + ':443',
      serverNames: [opts.sni],
      privateKey: 'YOUR_PRIVATE_KEY_HERE',
      shortIds: [opts.shortId || '6ba85179']
    };
  }
  
  return JSON.stringify(config, null, 2);
}

// ============ IP Scanner ============

async function scanIPs(ipList, ports, env) {
  const results = [];
  
  for (const ip of ipList) {
    for (const port of ports) {
      try {
        const start = Date.now();
        
        const response = await fetch('https://' + ip + ':' + port, {
          signal: AbortSignal.timeout(3000),
          headers: {
            'Host': 'cloudflare.com',
            'User-Agent': 'Mozilla/5.0'
          }
        });
        
        const latency = Date.now() - start;
        const cfRay = response.headers.get('cf-ray');
        const datacenter = cfRay ? cfRay.split('-')[1] : 'Unknown';
        
        if (latency < 1000) {
          const ipData = {
            ip,
            port,
            latency,
            datacenter,
            clean: latency < 300,
            status: 'open',
            scannedAt: Date.now()
          };
          
          await env.KV.put('scan:' + ip + ':' + port, JSON.stringify(ipData));
          results.push(ipData);
        }
      } catch (e) {}
    }
  }
  
  results.sort((a, b) => (a.latency || 999) - (b.latency || 999));
  return results;
}
