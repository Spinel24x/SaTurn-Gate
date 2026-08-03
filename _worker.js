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
          total: ipList.length * scanPorts.length,
          open: results.length,
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

    // API: Generate VLESS
    if (url.pathname === '/api/generate-vless' && request.method === 'POST') {
      try {
        const { ip, port, sni, uuid, sid } = await request.json();
        const configUuid = uuid || uuidv4();
        const shortId = sid || '6ba85179';
        const configSNI = sni || 'www.google.com';
        
        const vlessConfig = 'vless://' + configUuid + '@' + ip + ':' + port +
          '?encryption=none&security=reality&sni=' + configSNI +
          '&fp=chrome&pbk=your-public-key&sid=' + shortId +
          '&type=tcp&flow=xtls-rprx-vision&spx=%2F#SaTurn-VLESS';
        
        await env.KV.put('config:' + configUuid, JSON.stringify({
          type: 'vless', ip, port, sni: configSNI, uuid: configUuid, sid: shortId, created: Date.now()
        }));
        
        return new Response(JSON.stringify({ config: vlessConfig }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // API: Generate Trojan
    if (url.pathname === '/api/generate-trojan' && request.method === 'POST') {
      try {
        const { ip, port, sni, uuid, sid } = await request.json();
        const password = uuid || uuidv4().substring(0, 16);
        const shortId = sid || '6ba85179';
        const configSNI = sni || 'www.google.com';
        
        const trojanConfig = 'trojan://' + password + '@' + ip + ':' + port +
          '?security=reality&sni=' + configSNI +
          '&fp=chrome&pbk=your-public-key&sid=' + shortId +
          '&type=tcp&flow=xtls-rprx-vision&spx=%2F#SaTurn-Trojan';
        
        await env.KV.put('config:trojan:' + password, JSON.stringify({
          type: 'trojan', ip, port, sni: configSNI, password, sid: shortId, created: Date.now()
        }));
        
        return new Response(JSON.stringify({ config: trojanConfig }), {
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

    // Fallback: Serve static files (index.html)
    return env.ASSETS.fetch(request);
  }
};

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
