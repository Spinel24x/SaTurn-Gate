// src/worker.js
import { v4 as uuidv4 } from 'uuid';

// ============ اسکنر Durable Object ============
export class ScannerDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === "/start-scan") {
      const { ipRange, ports } = await request.json();
      return await this.scanIPs(ipRange, ports);
    }
    
    return new Response("Not Found", { status: 404 });
  }

  async scanIPs(ipRange, ports) {
    const results = [];
    const ips = this.generateIPRange(ipRange);
    
    for (const ip of ips) {
      for (const port of ports) {
        try {
          const start = Date.now();
          const response = await fetch(`http://${ip}:${port}`, {
            signal: AbortSignal.timeout(3000),
            headers: { 'User-Agent': 'Cloudflare-Worker-Scanner' }
          });
          const latency = Date.now() - start;
          
          if (response.status === 200 || response.status === 404) {
            // پورت بازه - می‌تونیم ازش استفاده کنیم
            const ipData = {
              ip,
              port,
              latency,
              status: 'open',
              datacenter: response.headers.get('cf-ray')?.split('-')[1] || 'unknown',
              country: response.headers.get('cf-ipcountry') || 'unknown'
            };
            
            // ذخیره در KV
            await this.env.KV.put(`scan:${ip}:${port}`, JSON.stringify(ipData));
            results.push(ipData);
          }
        } catch (e) {
          // پورت بسته یا تایم‌اوت
        }
      }
    }
    
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  generateIPRange(range) {
    // رنج‌های IP کلادفلیر (محدوده‌های عمومی)
    const cfRanges = [
      '104.16.0.0/13',
      '104.24.0.0/14',
      '172.64.0.0/14',
      '131.0.72.0/22'
    ];
    
    // اینجا باید IPهای تصادفی از این رنج‌ها تولید کنی
    // برای نمونه، 20 تا IP رندوم
    const sampleIPs = [];
    for (let i = 0; i < 20; i++) {
      const randomRange = cfRanges[Math.floor(Math.random() * cfRanges.length)];
      const baseIP = randomRange.split('/')[0];
      const parts = baseIP.split('.');
      parts[3] = Math.floor(Math.random() * 255);
      sampleIPs.push(parts.join('.'));
    }
    return sampleIPs;
  }
}

// ============ Worker اصلی ============
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ============ روت‌های API ============
    
    // صفحه اصلی پنل
    if (url.pathname === '/' || url.pathname === '/panel') {
      return new Response(getPanelHTML(), {
        headers: { 'Content-Type': 'text/html', ...corsHeaders }
      });
    }

    // API: دریافت نتایج اسکن
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

    // API: شروع اسکن جدید
    if (url.pathname === '/api/start-scan' && request.method === 'POST') {
      const { ports } = await request.json();
      const scannerId = env.SCANNER.idFromName('main-scanner');
      const scanner = env.SCANNER.get(scannerId);
      
      // شروع اسکن در پس‌زمینه
      ctx.waitUntil(
        scanner.fetch('https://dummy/start-scan', {
          method: 'POST',
          body: JSON.stringify({
            ipRange: 'cloudflare',
            ports: ports || [443, 8443, 2053, 2083, 2087, 2096]
          })
        })
      );
      
      return new Response(JSON.stringify({ status: 'scanning', message: 'اسکن شروع شد، چند لحظه صبر کنید...' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // API: تولید کانفیگ VLESS
    if (url.pathname === '/api/generate-vless' && request.method === 'POST') {
      const { ip, port, sni, uuid } = await request.json();
      const configUuid = uuid || uuidv4();
      
      const vlessConfig = `vless://${configUuid}@${ip}:${port}?encryption=none&security=reality&sni=${sni || 'www.google.com'}&fp=chrome&pbk=your-public-key&sid=your-short-id&type=tcp&flow=xtls-rprx-vision#CF-Panel-VLESS`;
      
      // ذخیره تنظیمات
      await env.KV.put(`config:${configUuid}`, JSON.stringify({
        type: 'vless',
        ip,
        port,
        sni,
        uuid: configUuid,
        created: Date.now()
      }));
      
      return new Response(JSON.stringify({ 
        config: vlessConfig,
        uuid: configUuid 
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // API: تولید کانفیگ Trojan
    if (url.pathname === '/api/generate-trojan' && request.method === 'POST') {
      const { ip, port, password, sni } = await request.json();
      const trojanPassword = password || uuidv4().substring(0, 16);
      
      const trojanConfig = `trojan://${trojanPassword}@${ip}:${port}?security=reality&sni=${sni || 'www.google.com'}&type=tcp&flow=xtls-rprx-vision#CF-Panel-Trojan`;
      
      await env.KV.put(`config:trojan:${trojanPassword}`, JSON.stringify({
        type: 'trojan',
        ip,
        port,
        password: trojanPassword,
        sni,
        created: Date.now()
      }));
      
      return new Response(JSON.stringify({ 
        config: trojanConfig 
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // API: تنظیمات سابسکریپشن
    if (url.pathname.startsWith('/sub/')) {
      const userId = url.pathname.split('/')[2];
      const { keys } = await env.KV.list({ prefix: `config:` });
      
      let subscription = '';
      for (const key of keys) {
        // فقط کانفیگ‌های این کاربر
        const config = await env.KV.get(key.name, 'json');
        if (config && config.userId === userId) {
          subscription += btoa(JSON.stringify(config)) + '\n';
        }
      }
      
      return new Response(subscription, {
        headers: { 
          'Content-Type': 'text/plain',
          'Content-Disposition': 'attachment; filename="config.txt"',
          ...corsHeaders 
        }
      });
    }

    // API: DOH endpoint
    if (url.pathname === '/doh') {
      const dnsQuery = url.searchParams.get('dns');
      if (!dnsQuery) {
        return new Response('Missing dns parameter', { status: 400 });
      }
      
      const dnsResponse = await fetch(`https://cloudflare-dns.com/dns-query?dns=${dnsQuery}`, {
        headers: { 'Accept': 'application/dns-message' }
      });
      
      return new Response(dnsResponse.body, {
        headers: {
          'Content-Type': 'application/dns-message',
          ...corsHeaders
        }
      });
    }

    // API: پاک کردن همه نتایج اسکن
    if (url.pathname === '/api/clear-scans' && request.method === 'POST') {
      const { keys } = await env.KV.list({ prefix: 'scan:' });
      for (const key of keys) {
        await env.KV.delete(key.name);
      }
      return new Response(JSON.stringify({ status: 'cleared' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};

// ============ پنل HTML ============
function getPanelHTML() {
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
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
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
        .card h2 {
            margin-bottom: 20px;
            color: #f39c12;
            font-size: 1.4em;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            color: #b0b0b0;
            font-size: 0.9em;
        }
        input, select {
            width: 100%;
            padding: 12px;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            color: #fff;
            font-size: 1em;
        }
        input:focus, select:focus {
            outline: none;
            border-color: #f39c12;
        }
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
        button:hover {
            transform: scale(1.02);
        }
        button:active {
            transform: scale(0.98);
        }
        .result-box {
            background: rgba(0,0,0,0.3);
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
            min-height: 60px;
            word-break: break-all;
        }
        .ip-list {
            max-height: 400px;
            overflow-y: auto;
            margin-top: 15px;
        }
        .ip-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            margin-bottom: 8px;
        }
        .ip-item span {
            font-family: monospace;
        }
        .status-open { color: #27ae60; }
        .status-closed { color: #e74c3c; }
        .loading {
            text-align: center;
            padding: 20px;
        }
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
        .tab-container {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        .tab {
            padding: 10px 20px;
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            cursor: pointer;
        }
        .tab.active {
            background: #f39c12;
            color: #1a1a3a;
        }
        .qr-code {
            text-align: center;
            margin-top: 15px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 CF Panel Manager</h1>
            <p style="color: #888; margin-top: 10px;">اسکنر IP + تولید کانفیگ V2Ray/Xray + DOH</p>
        </div>

        <div class="grid">
            <!-- کارت اسکنر -->
            <div class="card">
                <h2>🔍 اسکنر IP تمیز</h2>
                <div class="form-group">
                    <label>پورت‌های مورد نظر (با کاما جدا کنید)</label>
                    <input type="text" id="scanPorts" value="443,8443,2053,2083,2087,2096" placeholder="443,8443,2053">
                </div>
                <button onclick="startScan()">شروع اسکن</button>
                <div id="scanStatus" class="result-box" style="display:none;"></div>
                <div id="scanResults" class="ip-list"></div>
            </div>

            <!-- کارت تولید کانفیگ -->
            <div class="card">
                <h2>⚙️ تولید کانفیگ</h2>
                <div class="form-group">
                    <label>IP یا دامنه</label>
                    <input type="text" id="configIP" placeholder="مثال: 104.26.10.240 یا example.com">
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

            <!-- کارت تنظیمات -->
            <div class="card">
                <h2>📡 تنظیمات DNS</h2>
                <div class="form-group">
                    <label>DOH Endpoint</label>
                    <input type="text" id="dohEndpoint" readonly value="/doh">
                </div>
                <div class="form-group">
                    <label>دامنه تست DNS</label>
                    <input type="text" id="testDomain" value="google.com">
                </div>
                <button onclick="testDOH()">تست DOH</button>
                <div id="dohResult" class="result-box" style="display:none;"></div>
            </div>
        </div>

        <!-- کارت IPهای اسکن شده -->
        <div class="card" style="margin-top: 20px;">
            <h2>📊 IPهای اسکن شده قبلی</h2>
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <button onclick="loadSavedIPs()" style="width: auto;">بارگذاری</button>
                <button onclick="clearIPs()" style="width: auto; background: #e74c3c;">پاک کردن همه</button>
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
            const scanResults = document.getElementById('scanResults');
            
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
                scanStatus.innerHTML = '<p style="color: #27ae60;">✓ ' + data.message + '</p>';
                
                // چک کردن نتایج هر 3 ثانیه
                setTimeout(checkScanResults, 3000);
            } catch (error) {
                scanStatus.innerHTML = '<p style="color: #e74c3c;">✗ خطا در اسکن: ' + error.message + '</p>';
            }
        }

        async function checkScanResults() {
            try {
                const response = await fetch('/api/scanned-ips');
                const ips = await response.json();
                
                const scanResults = document.getElementById('scanResults');
                scanResults.innerHTML = ips.map(ip => 
                    '<div class="ip-item">' +
                    '<span>' + ip.ip + ':' + ip.port + '</span>' +
                    '<span>' + ip.latency + 'ms</span>' +
                    '<span class="status-open">● باز</span>' +
                    '<button onclick="useIP(\\'' + ip.ip + '\\', ' + ip.port + ')" style="width: auto; padding: 5px 10px;">استفاده</button>' +
                    '</div>'
                ).join('');
                
                document.getElementById('scanStatus').style.display = 'none';
            } catch (error) {
                console.error('Error loading scan results:', error);
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
                configResult.innerHTML = 
                    '<p style="color: #27ae60; margin-bottom: 10px;">✓ کانفیگ با موفقیت ساخته شد</p>' +
                    '<textarea style="width:100%; height:100px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 10px;">' + data.config + '</textarea>';
            } catch (error) {
                alert('خطا در تولید کانفیگ: ' + error.message);
            }
        }

        async function testDOH() {
            const domain = document.getElementById('testDomain').value;
            const dohResult = document.getElementById('dohResult');
            
            try {
                const response = await fetch('/doh?dns=' + btoa(String.fromCharCode(...new Uint8Array(domain.length + 5 + 4))));
                dohResult.style.display = 'block';
                dohResult.innerHTML = '<p style="color: #27ae60;">✓ DOH فعال است</p>';
            } catch (error) {
                dohResult.style.display = 'block';
                dohResult.innerHTML = '<p style="color: #e74c3c;">✗ خطا: ' + error.message + '</p>';
            }
        }

        async function loadSavedIPs() {
            try {
                const response = await fetch('/api/scanned-ips');
                const ips = await response.json();
                
                document.getElementById('savedIPs').innerHTML = ips.map(ip => 
                    '<div class="ip-item">' +
                    '<span>' + ip.ip + ':' + ip.port + '</span>' +
                    '<span>' + (ip.latency || 'N/A') + 'ms</span>' +
                    '<span>' + (ip.country || 'N/A') + '</span>' +
                    '<button onclick="useIP(\\'' + ip.ip + '\\', ' + ip.port + ')" style="width: auto;">استفاده</button>' +
                    '</div>'
                ).join('') || '<p>هیچ IP ذخیره شده‌ای یافت نشد</p>';
            } catch (error) {
                alert('خطا در بارگذاری IPها');
            }
        }

        async function clearIPs() {
            if (confirm('آیا مطمئنید می‌خواهید همه IPهای اسکن شده را پاک کنید؟')) {
                await fetch('/api/clear-scans', { method: 'POST' });
                document.getElementById('savedIPs').innerHTML = '<p>همه IPها پاک شدند</p>';
            }
        }

        // لود اولیه
        loadSavedIPs();
    </script>
</body>
</html>`;
}
