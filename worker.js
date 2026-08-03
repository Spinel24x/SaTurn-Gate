// _worker.js - بدون Durable Objects
import { v4 as uuidv4 } from 'uuid';

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

    // API: دریافت IPهای ذخیره شده
    if (url.pathname === '/api/scanned-ips') {
      const { keys } = await env.KV.list({ prefix: 'scan:' });
      const ips = [];
      for (const key of keys) {
        const data = await env.KV.get(key.name, 'json');
        if (data) ips.push(data);
      }
      return new Response(JSON.stringify(ips), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // API: اسکن سریع (مستقیم بدون Durable Objects)
    if (url.pathname === '/api/start-scan' && request.method === 'POST') {
      const { ports } = await request.json();
      const scanPorts = ports || [443, 8443, 2053, 2083, 2087, 2096];
      
      // اسکن فقط 10 تا IP (محدودیت زمانی Workers)
      const cfRanges = ['104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/14'];
      const results = [];
      
      for (let i = 0; i < 10; i++) {
        const randomRange = cfRanges[Math.floor(Math.random() * cfRanges.length)];
        const parts = randomRange.split('/')[0].split('.');
        parts[3] = Math.floor(Math.random() * 255);
        const ip = parts.join('.');
        
        for (const port of scanPorts) {
          try {
            const start = Date.now();
            const response = await fetch(`http://${ip}:${port}`, {
              signal: AbortSignal.timeout(2000)
            });
            const latency = Date.now() - start;
            
            if (response.ok || response.status === 404) {
              const ipData = { ip, port, latency, status: 'open' };
              await env.KV.put(`scan:${ip}:${port}`, JSON.stringify(ipData));
              results.push(ipData);
            }
          } catch (e) {}
        }
      }
      
      // ذخیره نتایج
      await env.KV.put('scan:results', JSON.stringify(results));
      
      return new Response(JSON.stringify({ 
        status: 'done', 
        count: results.length,
        results 
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // API: تولید VLESS
    if (url.pathname === '/api/generate-vless' && request.method === 'POST') {
      const { ip, port, sni, uuid } = await request.json();
      const configUuid = uuid || uuidv4();
      
      const vlessConfig = `vless://${configUuid}@${ip}:${port}?encryption=none&security=reality&sni=${sni || 'www.google.com'}&fp=chrome&type=tcp&flow=xtls-rprx-vision#CF-Panel`;
      
      await env.KV.put(`config:${configUuid}`, JSON.stringify({
        type: 'vless', ip, port, sni, uuid: configUuid, created: Date.now()
      }));
      
      return new Response(JSON.stringify({ config: vlessConfig }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // API: تولید Trojan
    if (url.pathname === '/api/generate-trojan' && request.method === 'POST') {
      const { ip, port, password, sni } = await request.json();
      const trojanPassword = password || uuidv4().substring(0, 16);
      
      const trojanConfig = `trojan://${trojanPassword}@${ip}:${port}?security=reality&sni=${sni || 'www.google.com'}&type=tcp&flow=xtls-rprx-vision#CF-Panel`;
      
      await env.KV.put(`config:trojan:${trojanPassword}`, JSON.stringify({
        type: 'trojan', ip, port, password: trojanPassword, sni, created: Date.now()
      }));
      
      return new Response(JSON.stringify({ config: trojanConfig }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // API: پاک کردن اسکن‌ها
    if (url.pathname === '/api/clear-scans' && request.method === 'POST') {
      const { keys } = await env.KV.list({ prefix: 'scan:' });
      for (const key of keys) {
        await env.KV.delete(key.name);
      }
      return new Response(JSON.stringify({ status: 'cleared' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // DOH
    if (url.pathname === '/doh') {
      const dnsQuery = url.searchParams.get('dns');
      if (!dnsQuery) return new Response('Missing dns', { status: 400 });
      
      const dnsResponse = await fetch(`https://cloudflare-dns.com/dns-query?dns=${dnsQuery}`, {
        headers: { 'Accept': 'application/dns-message' }
      });
      
      return new Response(dnsResponse.body, {
        headers: { 'Content-Type': 'application/dns-message', ...corsHeaders }
      });
    }

    // بقیه درخواست‌ها → فایل‌های استاتیک (index.html)
    return env.ASSETS.fetch(request);
  }
};
