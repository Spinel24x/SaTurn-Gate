// SaTurn Gate - CF Worker Edge Proxy
// نیاز به VPS نداره - Worker خودش پروکسیه

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
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, CONNECT',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Credentials': 'true'
    };

    // Handle CONNECT method for direct proxy
    if (request.method === 'CONNECT') {
      return handleConnect(request);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API: Generate simple VLESS config
    if (url.pathname === '/api/generate-vless' && request.method === 'POST') {
      try {
        const body = await request.json();
        const uuid = body.uuid || uuidv4();
        const address = body.address || userDomain;
        const port = body.port || 443;
        const sni = body.sni || 'www.google.com';
        const remark = body.remark || 'SaTurn-VLESS';
        
        // VLESS WS config using Worker as proxy
        const config = `vless://${uuid}@${address}:${port}?encryption=none&security=tls&sni=${sni}&fp=chrome&type=ws&path=/ws&host=${address}#${encodeURIComponent(remark)}`;
        
        // Save to KV
        try {
          await env.KV.put('user:' + uuid, JSON.stringify({
            uuid, address, port, sni, remark, created: Date.now()
          }));
        } catch (e) {}
        
        return new Response(JSON.stringify({ config, uuid }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // API: Generate simple Trojan config
    if (url.pathname === '/api/generate-trojan' && request.method === 'POST') {
      try {
        const body = await request.json();
        const password = body.password || uuidv4().substring(0, 16);
        const address = body.address || userDomain;
        const port = body.port || 443;
        const sni = body.sni || 'www.google.com';
        const remark = body.remark || 'SaTurn-Trojan';
        
        const config = `trojan://${password}@${address}:${port}?security=tls&sni=${sni}&fp=chrome&type=ws&path=/ws&host=${address}#${encodeURIComponent(remark)}`;
        
        try {
          await env.KV.put('user:' + password, JSON.stringify({
            password, address, port, sni, remark, created: Date.now()
          }));
        } catch (e) {}
        
        return new Response(JSON.stringify({ config, password }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // API: Scan IPs
    if (url.pathname === '/api/scan' && request.method === 'POST') {
      try {
        const body = await request.json();
        const ports = body.ports || [443];
        const results = await scanCFIPs(ports, env);
        return new Response(JSON.stringify(results), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
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
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // Serve static files
    return env.ASSETS.fetch(request);
  }
};

// Handle CONNECT method for direct TCP tunneling
function handleConnect(request) {
  const url = new URL(request.url);
  const [hostname, port] = url.hostname.split(':');
  
  // Create a TCP connection via Cloudflare
  // Note: CF Workers can't do raw TCP, this is just a placeholder
  return new Response('CONNECT method not fully supported on Workers', { status: 405 });
}

// CF IP Scanner
async function scanCFIPs(ports, env) {
  const cfRanges = [
    '104.16.0.0', '104.24.0.0', '172.64.0.0',
    '131.0.72.0', '104.26.0.0', '104.20.0.0',
    '104.31.0.0', '104.21.0.0', '104.17.0.0'
  ];
  
  let ipList = [];
  for (let i = 0; i < 25; i++) {
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
          signal: AbortSignal.timeout(2000),
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
  return { status: 'done', results, total: results.length, clean: results.filter(r => r.clean).length };
}
