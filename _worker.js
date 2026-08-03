function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getHTML() {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SaTurn Gate | پنل کانفیگ</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, sans-serif;
            background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #0a0a1a 100%);
            color: #e0e0e0;
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            text-align: center;
            padding: 30px;
            background: rgba(255,255,255,0.03);
            border-radius: 24px;
            border: 1px solid rgba(255,255,255,0.05);
            margin-bottom: 30px;
        }
        .header h1 {
            font-size: 3em;
            font-weight: 900;
            background: linear-gradient(135deg, #f39c12, #e74c3c, #f39c12);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }
        .header .subtitle {
            color: #666;
            font-size: 1.1em;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
            gap: 24px;
        }
        .card {
            background: rgba(255,255,255,0.03);
            border-radius: 20px;
            padding: 28px;
            border: 1px solid rgba(255,255,255,0.06);
            backdrop-filter: blur(20px);
            transition: all 0.3s;
        }
        .card:hover { border-color: rgba(243, 156, 18, 0.3); }
        .card h2 {
            font-size: 1.4em;
            margin-bottom: 24px;
            color: #f39c12;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .card h2 .icon { font-size: 1.3em; }
        .form-group { margin-bottom: 18px; }
        label {
            display: block;
            margin-bottom: 8px;
            color: #999;
            font-size: 0.9em;
            font-weight: 500;
        }
        input, select {
            width: 100%;
            padding: 14px 16px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            color: #fff;
            font-size: 1em;
            transition: all 0.3s;
        }
        input:focus, select:focus {
            outline: none;
            border-color: #f39c12;
            background: rgba(255,255,255,0.08);
            box-shadow: 0 0 20px rgba(243, 156, 18, 0.15);
        }
        button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #f39c12, #e67e22);
            border: none;
            border-radius: 12px;
            color: #1a1a3a;
            font-size: 1em;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s;
            letter-spacing: 0.5px;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(243, 156, 18, 0.3);
        }
        button:active { transform: scale(0.98); }
        button.secondary {
            background: rgba(255,255,255,0.05);
            color: #f39c12;
            border: 1px solid rgba(243, 156, 18, 0.3);
        }
        button.danger {
            background: rgba(231, 76, 60, 0.2);
            color: #e74c3c;
            border: 1px solid rgba(231, 76, 60, 0.3);
        }
        .result-box {
            background: rgba(0,0,0,0.3);
            padding: 16px;
            border-radius: 12px;
            margin-top: 16px;
            border: 1px solid rgba(255,255,255,0.05);
        }
        .config-text {
            width: 100%;
            min-height: 80px;
            background: rgba(0,0,0,0.4);
            color: #27ae60;
            border: 1px solid rgba(39, 174, 96, 0.3);
            border-radius: 10px;
            padding: 14px;
            font-family: 'Courier New', monospace;
            font-size: 0.8em;
            word-break: break-all;
            line-height: 1.6;
            resize: vertical;
        }
        .ip-list { max-height: 500px; overflow-y: auto; margin-top: 16px; }
        .ip-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 16px;
            background: rgba(255,255,255,0.03);
            border-radius: 12px;
            margin-bottom: 10px;
            border: 1px solid rgba(255,255,255,0.05);
            transition: all 0.2s;
        }
        .ip-item:hover { background: rgba(255,255,255,0.06); }
        .ip-info { display: flex; flex-direction: column; gap: 4px; }
        .ip-address { font-family: monospace; font-size: 1em; font-weight: 600; color: #f39c12; }
        .ip-details { font-size: 0.8em; color: #888; }
        .ip-status { font-weight: 700; }
        .status-open { color: #27ae60; }
        .status-checking { color: #f39c12; }
        .loading {
            text-align: center;
            padding: 30px;
            color: #888;
        }
        .spinner {
            border: 3px solid rgba(255,255,255,0.1);
            border-top: 3px solid #f39c12;
            border-radius: 50%;
            width: 35px;
            height: 35px;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .tabs { display: flex; gap: 8px; margin-bottom: 20px; background: rgba(255,255,255,0.03); padding: 6px; border-radius: 14px; }
        .tab {
            flex: 1;
            text-align: center;
            padding: 10px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.9em;
            transition: all 0.3s;
            color: #888;
        }
        .tab.active { background: rgba(243, 156, 18, 0.2); color: #f39c12; }
        .tab:hover { color: #f39c12; }
        .btn-row { display: flex; gap: 10px; margin-top: 10px; }
        .btn-row button { flex: 1; }
        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.75em;
            font-weight: 700;
        }
        .badge-clean { background: rgba(39, 174, 96, 0.2); color: #27ae60; }
        .badge-cf { background: rgba(243, 156, 18, 0.2); color: #f39c12; }
        .stats { display: flex; gap: 15px; margin-top: 15px; }
        .stat { flex: 1; text-align: center; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 10px; }
        .stat-value { font-size: 1.5em; font-weight: 700; color: #f39c12; }
        .stat-label { font-size: 0.8em; color: #888; margin-top: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🪐 SaTurn Gate</h1>
            <p class="subtitle">اسکنر IP تمیز + تولید کانفیگ Xray | VLESS Reality + Trojan</p>
        </div>

        <div class="grid">
            <!-- اسکنر -->
            <div class="card">
                <h2><span class="icon">🔍</span> اسکنر IP تمیز کلادفلیر</h2>
                <div class="form-group">
                    <label>رنج IP هدف</label>
                    <select id="scanRange">
                        <option value="cf">Cloudflare (عمومی)</option>
                        <option value="cf-iran">Cloudflare (ایران بهینه)</option>
                        <option value="gcore">Gcore CDN</option>
                        <option value="fastly">Fastly CDN</option>
                        <option value="custom">دستی وارد کن</option>
                    </select>
                </div>
                <div class="form-group" id="customRangeBox" style="display:none;">
                    <label>رنج IP سفارشی (مثال: 104.21.0.0/16)</label>
                    <input type="text" id="customRange" placeholder="104.21.0.0/16">
                </div>
                <div class="form-group">
                    <label>پورت‌ها</label>
                    <select id="scanPorts">
                        <option value="443">443 (HTTPS/Reality)</option>
                        <option value="8443">8443</option>
                        <option value="2053">2053</option>
                        <option value="443,8443,2053,2083,2087,2096">همه پورت‌های CF</option>
                    </select>
                </div>
                <button onclick="startScan()">🚀 شروع اسکن هوشمند</button>
                <div class="stats" id="scanStats" style="display:none;">
                    <div class="stat"><div class="stat-value" id="totalChecked">0</div><div class="stat-label">بررسی شده</div></div>
                    <div class="stat"><div class="stat-value" id="totalOpen">0</div><div class="stat-label">باز</div></div>
                    <div class="stat"><div class="stat-value" id="totalClean">0</div><div class="stat-label">تمیز</div></div>
                </div>
                <div id="scanStatus" class="result-box" style="display:none;"></div>
                <div id="scanResults" class="ip-list"></div>
            </div>

            <!-- تولید کانفیگ -->
            <div class="card">
                <h2><span class="icon">⚙️</span> تولید کانفیگ Xray</h2>
                <div class="tabs">
                    <div class="tab active" onclick="switchTab('vless')">VLESS Reality</div>
                    <div class="tab" onclick="switchTab('trojan')">Trojan Reality</div>
                </div>
                <div class="form-group">
                    <label>IP سرور</label>
                    <input type="text" id="configIP" placeholder="از اسکنر انتخاب کنید یا دستی وارد کنید">
                </div>
                <div class="form-group">
                    <label>پورت</label>
                    <input type="number" id="configPort" value="443">
                </div>
                <div class="form-group">
                    <label>SNI (دامنه فیلتر نشده)</label>
                    <input type="text" id="configSNI" value="www.google.com" placeholder="مثال: www.google.com">
                </div>
                <div class="form-group">
                    <label>UUID (اختیاری)</label>
                    <input type="text" id="configUUID" placeholder="خالی بذارید تا خودکار ساخته شود">
                </div>
                <div class="form-group">
                    <label>Short ID (هگز ۲-۸ کاراکتری)</label>
                    <input type="text" id="configSID" value="6ba85179" maxlength="16">
                </div>
                <button onclick="generateConfig()">🎯 تولید کانفیگ</button>
                <div id="configResult" class="result-box" style="display:none;">
                    <textarea class="config-text" id="configOutput" readonly></textarea>
                    <div class="btn-row" style="margin-top:12px;">
                        <button onclick="copyConfig()" class="secondary">📋 کپی</button>
                        <button onclick="downloadConfig()" class="secondary">💾 دانلود</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- IPهای ذخیره شده -->
        <div class="card" style="margin-top: 24px;">
            <h2><span class="icon">📊</span> IPهای اسکن شده قبلی</h2>
            <div class="btn-row" style="margin-bottom: 20px; max-width: 400px;">
                <button onclick="loadSavedIPs()" class="secondary">🔄 بارگذاری</button>
                <button onclick="clearIPs()" class="danger">🗑 پاک کردن همه</button>
            </div>
            <div id="savedIPs" class="ip-list"></div>
        </div>
    </div>

    <script>
        let activeTab = 'vless';
        let scanInterval = null;

        document.getElementById('scanRange').addEventListener('change', function() {
            document.getElementById('customRangeBox').style.display = this.value === 'custom' ? 'block' : 'none';
        });

        function switchTab(type) {
            activeTab = type;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
        }

        async function startScan() {
            const scanStatus = document.getElementById('scanStatus');
            const scanResults = document.getElementById('scanResults');
            const stats = document.getElementById('scanStats');
            
            scanStatus.style.display = 'block';
            stats.style.display = 'flex';
            scanStatus.innerHTML = '<div class="loading"><div class="spinner"></div><p>در حال اسکن IPهای کلادفلیر...</p><p style="font-size:0.8em;color:#666;">این عملیات ممکن است ۱۰-۲۰ ثانیه طول بکشد</p></div>';
            
            const range = document.getElementById('scanRange').value;
            const customRange = document.getElementById('customRange').value;
            const ports = document.getElementById('scanPorts').value.split(',').map(p => parseInt(p.trim()));
            
            try {
                const response = await fetch('/api/scan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        range: range === 'custom' ? customRange : range,
                        ports 
                    })
                });
                
                const data = await response.json();
                
                if (data.status === 'scanning') {
                    scanStatus.innerHTML = '<div class="loading"><div class="spinner"></div><p>' + data.message + '</p></div>';
                    // Poll for results
                    pollResults();
                } else {
                    displayResults(data.results || []);
                }
            } catch (error) {
                scanStatus.innerHTML = '<p style="color: #e74c3c;">✗ خطا: ' + error.message + '</p>';
            }
        }

        async function pollResults() {
            try {
                const response = await fetch('/api/scan-results');
                const data = await response.json();
                
                document.getElementById('totalChecked').textContent = data.total || 0;
                document.getElementById('totalOpen').textContent = data.open || 0;
                document.getElementById('totalClean').textContent = data.clean || 0;
                
                if (data.results && data.results.length > 0) {
                    displayResults(data.results);
                    document.getElementById('scanStatus').style.display = 'none';
                } else if (data.status === 'scanning') {
                    setTimeout(pollResults, 3000);
                }
            } catch (error) {
                setTimeout(pollResults, 3000);
            }
        }

        function displayResults(ips) {
            const scanResults = document.getElementById('scanResults');
            scanResults.innerHTML = ips.map(ip => 
                '<div class="ip-item">' +
                '<div class="ip-info">' +
                '<span class="ip-address">' + ip.ip + ':' + ip.port + '</span>' +
                '<span class="ip-details">' +
                '<span class="badge ' + (ip.clean ? 'badge-clean' : 'badge-cf') + '">' + (ip.clean ? 'تمیز' : 'CF') + '</span> ' +
                'پینگ: ' + (ip.latency || '?') + 'ms | ' + (ip.datacenter || 'Unknown') +
                '</span>' +
                '</div>' +
                '<div style="display:flex; gap:8px;">' +
                '<button onclick="useIP(\'' + ip.ip + '\', ' + ip.port + ')" class="secondary" style="padding:6px 12px;font-size:0.8em;">VLESS</button>' +
                '<button onclick="useIPForTrojan(\'' + ip.ip + '\', ' + ip.port + ')" class="secondary" style="padding:6px 12px;font-size:0.8em;">Trojan</button>' +
                '</div>' +
                '</div>'
            ).join('') || '<p style="color:#888;">IP تمیزی یافت نشد. دوباره تلاش کنید.</p>';
        }

        function useIP(ip, port) {
            document.getElementById('configIP').value = ip;
            document.getElementById('configPort').value = port;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab')[0].classList.add('active');
            activeTab = 'vless';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function useIPForTrojan(ip, port) {
            document.getElementById('configIP').value = ip;
            document.getElementById('configPort').value = port;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab')[1].classList.add('active');
            activeTab = 'trojan';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        async function generateConfig() {
            const ip = document.getElementById('configIP').value;
            const port = document.getElementById('configPort').value;
            const sni = document.getElementById('configSNI').value;
            const uuid = document.getElementById('configUUID').value;
            const sid = document.getElementById('configSID').value;
            
            if (!ip || !port) {
                alert('لطفاً IP و پورت را وارد کنید');
                return;
            }
            
            const endpoint = activeTab === 'vless' ? '/api/generate-vless' : '/api/generate-trojan';
            
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip, port: parseInt(port), sni, uuid, sid })
                });
                
                const data = await response.json();
                document.getElementById('configResult').style.display = 'block';
                document.getElementById('configOutput').value = data.config;
                
                // Display Xray server config too
                if (data.serverConfig) {
                    document.getElementById('configResult').innerHTML += 
                        '<details style="margin-top:12px;"><summary style="color:#f39c12;cursor:pointer;">📝 کانفیگ سرور Xray</summary>' +
                        '<textarea class="config-text" style="margin-top:8px;color:#888;" readonly>' + data.serverConfig + '</textarea></details>';
                }
            } catch (error) {
                alert('خطا در تولید کانفیگ: ' + error.message);
            }
        }

        function copyConfig() {
            const textarea = document.getElementById('configOutput');
            textarea.select();
            document.execCommand('copy');
            alert('✅ کانفیگ کپی شد!');
        }

        function downloadConfig() {
            const config = document.getElementById('configOutput').value;
            const blob = new Blob([config], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'saturn-config-' + Date.now() + '.txt';
            a.click();
        }

        async function loadSavedIPs() {
            try {
                const response = await fetch('/api/scanned-ips');
                const ips = await response.json();
                
                document.getElementById('savedIPs').innerHTML = ips.length > 0 
                    ? ips.map(ip => 
                        '<div class="ip-item">' +
                        '<div class="ip-info">' +
                        '<span class="ip-address">' + ip.ip + ':' + ip.port + '</span>' +
                        '<span class="ip-details">پینگ: ' + (ip.latency || '?') + 'ms</span>' +
                        '</div>' +
                        '<button onclick="useIP(\'' + ip.ip + '\', ' + ip.port + ')" class="secondary" style="padding:6px 12px;font-size:0.8em;">استفاده</button>' +
                        '</div>'
                    ).join('')
                    : '<p style="color:#888;">هنوز هیچ IP اسکن نشده است.</p>';
            } catch (error) {
                console.error(error);
            }
        }

        async function clearIPs() {
            if (confirm('آیا مطمئن هستید؟')) {
                await fetch('/api/clear-scans', { method: 'POST' });
                document.getElementById('savedIPs').innerHTML = '<p style="color:#888;">همه IPها پاک شدند.</p>';
            }
        }

        loadSavedIPs();
    </script>
</body>
</html>`;
}

// ============ Backend Logic ============

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

    // API: Scan IPs (smart scanner)
    if (url.pathname === '/api/scan' && request.method === 'POST') {
      const { range, ports } = await request.json();
      const scanPorts = ports || [443];
      
      // Generate IPs based on range
      let ipList = [];
      
      if (range === 'cf' || range === 'cf-iran') {
        // Cloudflare IP ranges (popular ones)
        const cfRanges = [
          '104.16.0.0/12',
          '104.24.0.0/13', 
          '172.64.0.0/14',
          '131.0.72.0/22',
          '104.26.0.0/15',
          '104.20.0.0/14',
          '104.31.0.0/16',
          '1.1.1.0/24',
          '104.21.0.0/16'
        ];
        
        // Generate 25 random IPs from these ranges
        for (let i = 0; i < 25; i++) {
          const randomRange = cfRanges[Math.floor(Math.random() * cfRanges.length)];
          const base = randomRange.split('/')[0];
          const parts = base.split('.');
          parts[3] = Math.floor(Math.random() * 254) + 1;
          ipList.push(parts.join('.'));
        }
      } else if (range === 'gcore') {
        // Gcore ranges
        for (let i = 0; i < 15; i++) {
          ipList.push('92.223.' + Math.floor(Math.random() * 255) + '.' + (Math.floor(Math.random() * 254) + 1));
        }
      } else if (range === 'fastly') {
        for (let i = 0; i < 15; i++) {
          ipList.push('151.101.' + Math.floor(Math.random() * 255) + '.' + (Math.floor(Math.random() * 254) + 1));
        }
      } else {
        // Custom range
        const [baseIP, subnet] = range.split('/');
        const parts = baseIP.split('.');
        for (let i = 0; i < 15; i++) {
          parts[3] = Math.floor(Math.random() * 254) + 1;
          ipList.push(parts.join('.'));
        }
      }
      
      // Start scanning (async)
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
    }

    // API: Get saved IPs
    if (url.pathname === '/api/scanned-ips') {
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
    }

    // API: Generate VLESS config
    if (url.pathname === '/api/generate-vless' && request.method === 'POST') {
      const { ip, port, sni, uuid, sid } = await request.json();
      const configUuid = uuid || uuidv4();
      const shortId = sid || '6ba85179';
      const configSNI = sni || 'www.google.com';
      
      // VLESS Reality config
      const vlessConfig = 'vless://' + configUuid + '@' + ip + ':' + port + 
        '?encryption=none&security=reality&sni=' + configSNI + 
        '&fp=chrome&pbk=your-public-key-here&sid=' + shortId + 
        '&type=tcp&flow=xtls-rprx-vision&spx=%2F#SaTurn-Gate-VLESS';
      
      // Xray server config
      const serverConfig = JSON.stringify({
        "inbounds": [{
          "port": port,
          "protocol": "vless",
          "settings": {
            "clients": [{
              "id": configUuid,
              "flow": "xtls-rprx-vision"
            }],
            "decryption": "none"
          },
          "streamSettings": {
            "network": "tcp",
            "security": "reality",
            "realitySettings": {
              "dest": configSNI + ":443",
              "serverNames": [configSNI, "www.microsoft.com"],
              "privateKey": "your-private-key-here",
              "shortIds": [shortId]
            }
          }
        }]
      }, null, 2);
      
      // Save to KV
      await env.KV.put('config:' + configUuid, JSON.stringify({
        type: 'vless', ip, port, sni: configSNI, uuid: configUuid, sid: shortId, created: Date.now()
      }));
      
      return new Response(JSON.stringify({ 
        config: vlessConfig,
        serverConfig: serverConfig
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // API: Generate Trojan config
    if (url.pathname === '/api/generate-trojan' && request.method === 'POST') {
      const { ip, port, sni, uuid, sid } = await request.json();
      const password = uuid || uuidv4().substring(0, 16);
      const shortId = sid || '6ba85179';
      const configSNI = sni || 'www.google.com';
      
      const trojanConfig = 'trojan://' + password + '@' + ip + ':' + port + 
        '?security=reality&sni=' + configSNI + 
        '&fp=chrome&pbk=your-public-key-here&sid=' + shortId + 
        '&type=tcp&flow=xtls-rprx-vision&spx=%2F#SaTurn-Gate-Trojan';
      
      const serverConfig = JSON.stringify({
        "inbounds": [{
          "port": port,
          "protocol": "trojan",
          "settings": {
            "clients": [{
              "password": password
            }]
          },
          "streamSettings": {
            "network": "tcp",
            "security": "reality",
            "realitySettings": {
              "dest": configSNI + ":443",
              "serverNames": [configSNI],
              "privateKey": "your-private-key-here",
              "shortIds": [shortId]
            }
          }
        }]
      }, null, 2);
      
      await env.KV.put('config:trojan:' + password, JSON.stringify({
        type: 'trojan', ip, port, sni: configSNI, password, sid: shortId, created: Date.now()
      }));
      
      return new Response(JSON.stringify({ 
        config: trojanConfig,
        serverConfig: serverConfig
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // API: Clear scans
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

// Smart IP scanner function
async function scanIPs(ipList, ports, env) {
  const results = [];
  
  for (const ip of ipList) {
    for (const port of ports) {
      try {
        const start = Date.now();
        
        // Try HTTPS request to check if port is open on CDN
        const response = await fetch('https://' + ip + ':' + port, {
          signal: AbortSignal.timeout(2000),
          headers: { 
            'Host': 'cloudflare.com',
            'User-Agent': 'Mozilla/5.0'
          }
        });
        
        const latency = Date.now() - start;
        const cfRay = response.headers.get('cf-ray');
        const datacenter = cfRay ? cfRay.split('-')[1] : 'Unknown';
        
        // Check if it's a clean IP (responds correctly)
        const isClean = response.status === 200 || response.status === 403 || response.status === 404;
        
        if (isClean && latency < 1000) {
          const ipData = {
            ip,
            port,
            latency,
            datacenter,
            clean: latency < 300,
            status: 'open',
            scannedAt: Date.now()
          };
          
          // Save to KV
          await env.KV.put('scan:' + ip + ':' + port, JSON.stringify(ipData));
          results.push(ipData);
        }
      } catch (e) {
        // Port closed or timeout - skip
      }
    }
  }
  
  // Sort by latency
  results.sort((a, b) => (a.latency || 999) - (b.latency || 999));
  
  return results;
}
