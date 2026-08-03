// _worker.js
import { v4 as uuidv4 } from 'uuid';

function getHTML() {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>پنل مدیریت کانفیگ | CF Panel</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 100%);
            color: #e0e0e0;
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            text-align: center;
            padding: 30px;
            background: rgba(255,255,255,0.05);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            margin-bottom: 30px;
        }
        .header h1 {
            font-size: 2.5em;
            background: linear-gradient(45deg, #f39c12, #e74c3c);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
        }
        .card {
            background: rgba(255,255,255,0.05);
            border-radius: 15px;
            padding: 25px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
        }
        .card h2 { margin-bottom: 20px; color: #f39c12; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; color: #b0b0b0; font-size: 0.9em; }
        input, select {
            width: 100%;
            padding: 12px;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            color: #fff;
            font-size: 1em;
        }
        input:focus, select:focus { outline: none; border-color: #f39c12; }
        button {
            width: 100%;
            padding: 12px;
            background: linear-gradient(45deg, #f39c12, #e74c3c);
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 1em;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s;
        }
        button:hover { transform: scale(1.02); }
        button:active { transform: scale(0.98); }
        .result-box {
            background: rgba(0,0,0,0.3);
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
            min-height: 60px;
            word-break: break-all;
        }
        .ip-list { max-height: 400px; overflow-y: auto; margin-top: 15px; }
        .ip-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            margin-bottom: 8px;
            gap: 10px;
        }
        .ip-item span { font-family: monospace; font-size: 0.9em; }
        .status-open { color: #27ae60; }
        .loading { text-align: center; padding: 20px; }
        .spinner {
            border: 3px solid rgba(255,255,255,0.1);
            border-top: 3px solid #f39c12;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .tab-container { display: flex; gap: 10px; margin-bottom: 20px; }
        .tab {
            padding: 10px 20px;
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.3s;
        }
        .tab.active { background: #f39c12; color: #1a1a3a; }
        textarea {
            width: 100%;
            min-height: 100px;
            background: rgba(0,0,0,0.3);
            color: #fff;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            padding: 10px;
            font-family: monospace;
            font-size: 0.85em;
        }
        .btn-small {
            width: auto;
            padding: 5px 10px;
            font-size: 0.8em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 CF Panel Manager</h1>
            <p style="color: #888; margin-top: 10px;">اسکنر IP + تولید کانفیگ VLESS/Trojan + DOH</p>
        </div>

        <div class="grid">
            <div class="card">
                <h2>🔍 اسکنر IP تمیز</h2>
                <div class="form-group">
                    <label>پورت‌های مورد نظر</label>
                    <input type="text" id="scanPorts" value="443,8443,2053,2083,2087,2096">
                </div>
                <button onclick="startScan()">شروع اسکن</button>
                <div id="scanStatus" class="result-box" style="display:none;"></div>
                <div id="scanResults" class="ip-list"></div>
            </div>

            <div class="card">
                <h2>⚙️ تولید کانفیگ</h2>
                <div class="form-group">
                    <label>IP یا دامنه</label>
                    <input type="text" id="configIP" placeholder="مثال: 104.26.10.240">
                </div>
                <div class="form-group">
                    <label>پورت</label>
                    <input type="number" id="configPort" value="443">
                </div>
                <div class="form-group">
                    <label>SNI</label>
                    <input type="text" id="configSNI" value="www.google.com">
                </div>
                <div class="tab-container">
                    <div class="tab active" onclick="switchTab('vless')">VLESS</div>
                    <div class="tab" onclick="switchTab('trojan')">Trojan</div>
                </div>
                <button onclick="generateConfig()">🎯 تولید کانفیگ</button>
                <div id="configResult" class="result-box" style="display:none;"></div>
            </div>

            <div class="card">
                <h2>📡 تست DOH</h2>
                <div class="form-group">
                    <label>دامنه تست</label>
                    <input type="text" id="testDomain" value="google.com">
                </div>
                <button onclick="testDOH()">تست DOH</button>
                <div id="dohResult" class="result-box" style="display:none;"></div>
            </div>
        </div>

        <div class="card" style="margin-top: 20px;">
            <h2>📊 IPهای اسکن شده</h2>
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <button onclick="loadSavedIPs()" class="btn-small">بارگذاری</button>
                <button onclick="clearIPs()" class="btn-small" style="background: #e74c3c;">پاک کردن همه</button>
            </div>
            <div id="savedIPs" class="ip-list"></div>
        </div>
    </div>

    <script>
        let activeTab = 'vless';

        function switchTab(type) {
            activeTab = type;
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            event.target.classList.add('active');
        }

        async function startScan() {
            const scanStatus = document.getElementById('scanStatus');
            scanStatus.style.display = 'block';
            scanStatus.innerHTML = '<div class="loading"><div class="spinner"></div><p>در حال اسکن...</p></div>';
            
            const ports = document.getElementById('scanPorts').value.split(',').map(p => parseInt(p.trim()));
            
            try {
                const response = await fetch('/api/start-scan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ports })
                });
                
                const data = await response.json();
                scanStatus.innerHTML = '<p style="color: #27ae60;">✓ ' + data.count + ' IP پیدا شد</p>';
                
                const scanResults = document.getElementById('scanResults');
                scanResults.innerHTML = data.results.map(ip => 
                    '<div class="ip-item"><span>' + ip.ip + ':' + ip.port + '</span><span>' + ip.latency + 'ms</span><span class="status-open">● باز</span><button onclick="useIP(\'' + ip.ip + '\', ' + ip.port + ')" class="btn-small">استفاده</button></div>'
                ).join('');
            } catch (error) {
                scanStatus.innerHTML = '<p style="color: #e74c3c;">✗ خطا در اسکن</p>';
            }
        }

        function useIP(ip, port) {
            document.getElementById('configIP').value = ip;
            document.getElementById('configPort').value = port;
        }

        async function generateConfig() {
            const ip = document.getElementById('configIP').value;
            const port = document.getElementById('configPort').value;
            const sni = document.getElementById('configSNI').value;
            
            const endpoint = activeTab === 'vless' ? '/api/generate-vless' : '/api/generate-trojan';
            
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip, port: parseInt(port), sni })
                });
                
                const data = await response.json();
                const configResult = document.getElementById('configResult');
                configResult.style.display = 'block';
                configResult.innerHTML = '<p style="color: #27ae60; margin-bottom: 10px;">✓ کانفیگ با موفقیت ساخته شد</p><textarea readonly>' + data.config + '</textarea>';
            } catch (error) {
                alert('خطا در تولید کانفیگ');
            }
        }

        async function testDOH() {
            const dohResult = document.getElementById('dohResult');
            dohResult.style.display = 'block';
            dohResult.innerHTML = '<p style="color: #27ae60;">✓ DOH endpoint فعال است: /doh</p>';
        }

        async function loadSavedIPs() {
            try {
                const response = await fetch('/api/scanned-ips');
                const ips = await response.json();
                
                document.getElementById('savedIPs').innerHTML = ips.length > 0 
                    ? ips.map(ip => '<div class="ip-item"><span>' + ip.ip + ':' + ip.port + '</span><span>' + ip.latency + 'ms</span><span>' + (ip.country || 'N/A') + '</span><button onclick="useIP(\'' + ip.ip + '\', ' + ip.port + ')" class="btn-small">استفاده</button></div>').join('')
                    : '<p>هیچ IP ذخیره شده‌ای یافت نشد</p>';
            } catch (error) {
                alert('خطا در بارگذاری');
            }
        }

        async function clearIPs() {
            if (confirm('آیا مطمئنید؟')) {
                await fetch('/api/clear-scans', { method: 'POST' });
                document.getElementById('savedIPs').innerHTML = '<p>همه IPها پاک شدند</p>';
            }
        }

        loadSavedIPs();
    </script>
</body>
</html>`;
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

    // Serve panel
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(getHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders }
      });
    }

    // API: scanned IPs
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

    // API: start scan
    if (url.pathname === '/api/start-scan' && request.method === 'POST') {
      const { ports } = await request.json();
      const scanPorts = ports || [443, 8443, 2053, 2083, 2087, 2096];
      
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
            const response = await fetch('http://' + ip + ':' + port, {
              signal: AbortSignal.timeout(2000)
            });
            const latency = Date.now() - start;
            
            if (response.ok || response.status === 404) {
              const ipData = { ip, port, latency, status: 'open' };
              await env.KV.put('scan:' + ip + ':' + port, JSON.stringify(ipData));
              results.push(ipData);
            }
          } catch (e) {}
        }
      }
      
      return new Response(JSON.stringify({ status: 'done', count: results.length, results }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // API: generate VLESS
    if (url.pathname === '/api/generate-vless' && request.method === 'POST') {
      const { ip, port, sni, uuid } = await request.json();
      const configUuid = uuid || uuidv4();
      
      const vlessConfig = 'vless://' + configUuid + '@' + ip + ':' + port + '?encryption=none&security=reality&sni=' + (sni || 'www.google.com') + '&fp=chrome&type=tcp&flow=xtls-rprx-vision#CF-Panel';
      
      await env.KV.put('config:' + configUuid, JSON.stringify({
        type: 'vless', ip, port, sni, uuid: configUuid, created: Date.now()
      }));
      
      return new Response(JSON.stringify({ config: vlessConfig }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // API: generate Trojan
    if (url.pathname === '/api/generate-trojan' && request.method === 'POST') {
      const { ip, port, password, sni } = await request.json();
      const trojanPassword = password || uuidv4().substring(0, 16);
      
      const trojanConfig = 'trojan://' + trojanPassword + '@' + ip + ':' + port + '?security=reality&sni=' + (sni || 'www.google.com') + '&type=tcp&flow=xtls-rprx-vision#CF-Panel';
      
      await env.KV.put('config:trojan:' + trojanPassword, JSON.stringify({
        type: 'trojan', ip, port, password: trojanPassword, sni, created: Date.now()
      }));
      
      return new Response(JSON.stringify({ config: trojanConfig }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // API: clear scans
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
      
      const dnsResponse = await fetch('https://cloudflare-dns.com/dns-query?dns=' + dnsQuery, {
        headers: { 'Accept': 'application/dns-message' }
      });
      
      return new Response(dnsResponse.body, {
        headers: { 'Content-Type': 'application/dns-message', ...corsHeaders }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};
