addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);

  // 路由：Service Worker 脚本
  if (url.pathname === '/sw.js') {
    const swCode = `
const CACHE_NAME = 'cf-diag-v1';
const PRECACHE_URLS = ['/'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        const networked = fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || networked;
      })
  );
});
    `;
    return new Response(swCode.trim(), {
      headers: { 'content-type': 'application/javascript', 'cache-control': 'max-age=3600' }
    });
  }

  // 路由：Web App Manifest
  if (url.pathname === '/manifest.json') {
    const manifest = JSON.stringify({
      name: 'Network Diagnostics',
      short_name: 'NetDiag',
      start_url: '/',
      display: 'standalone',
      background_color: '#0a0b0d',
      theme_color: '#00e676',
      icons: [{
        src: '/favicon.ico',
        sizes: '64x64',
        type: 'image/x-icon'
      }]
    });
    return new Response(manifest, {
      headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' }
    });
  }

  // 主诊断页面
  const workerStart = Date.now();
  const cf = request.cf || {};
  
  function escapeForJS(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
  const lat = parseFloat(cf.latitude) || 0;
  const lon = parseFloat(cf.longitude) || 0;
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  const data = {
    colo: escapeForJS(cf.colo || 'NRT'),
    asn: escapeForJS(cf.asn || 'N/A'),
    asOrg: escapeForJS(cf.asOrganization || 'Unknown ISP'),
    city: escapeForJS(cf.city || 'Unknown'),
    country: escapeForJS(cf.country || 'Unknown'),
    region: escapeForJS(cf.region || 'Unknown'),
    lat: Math.abs(lat).toFixed(4),
    lon: Math.abs(lon).toFixed(4),
    latDir: escapeForJS(latDir),
    lonDir: escapeForJS(lonDir),
    rayId: escapeForJS(request.headers.get('cf-ray') || 'N/A'),
    proto: escapeForJS(cf.httpProtocol || 'N/A'),
    tlsVersion: escapeForJS(cf.tlsVersion || 'N/A'),
    tlsCipher: escapeForJS(cf.tlsCipher || 'N/A'),
    botScore: cf.botManagement?.score ?? 100,
    clientIp: escapeForJS(request.headers.get('cf-connecting-ip') || 'N/A'),
    httpProtocolRaw: cf.httpProtocol || 'N/A',
    latNum: lat,
    lonNum: lon,
    tlsClientHelloLength: cf.tlsClientHelloLength || 0          // 新增 ECH 探测
  };
  const acceptLang = request.headers.get('accept-language') || '';
  let defaultLang = 'en';
  if (acceptLang.match(/zh-(CN|SG|MY)/i)) defaultLang = 'zh-CN';
  else if (acceptLang.match(/zh/i)) defaultLang = 'zh-TW';
  const workerDuration = Date.now() - workerStart;
  const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TERMINAL DIAGNOSTICS</title>
    <link rel="manifest" href="/manifest.json">
    <style>
        :root { --green: #00e676; --bg: #0a0b0d; --dim: #666; --red: #ff5252; --orange: #ffa726; --yellow: #ffd600; }
        * { box-sizing: border-box; }
        body { 
            background: var(--bg); 
            color: #fff; 
            font-family: 'Consolas', 'Monaco', monospace; 
            margin: 0; 
            display: flex; 
            flex-direction: column; 
            justify-content: center; 
            align-items: center; 
            min-height: 100vh; 
            padding: 20px;
            position: relative;
        }
        body::before { 
            content: ""; 
            position: fixed; 
            top: 0; left: 0; 
            width: 100%; height: 100%; 
            background: linear-gradient(rgba(0,230,118,0.03) 1px, transparent 1px), 
                        linear-gradient(90deg, rgba(0,230,118,0.03) 1px, transparent 1px); 
            background-size: 30px 30px; 
            z-index: -1; 
        }
        .terminal { 
            width: 100%; 
            max-width: 900px; 
            background: rgba(16,18,22,0.98); 
            border: 1px solid var(--green); 
            padding: 30px; 
            box-shadow: 0 0 30px rgba(0,230,118,0.15); 
            position: relative; 
        }
        .lang-switcher { 
            position: absolute; 
            top: 15px; 
            right: 15px; 
            display: flex; 
            gap: 8px; 
        }
        .lang-btn { 
            background: rgba(255,255,255,0.05); 
            border: 1px solid var(--dim); 
            color: var(--dim); 
            font-size: 10px; 
            cursor: pointer; 
            padding: 3px 8px; 
            transition: 0.3s; 
            font-family: inherit;
        }
        .lang-btn.active { 
            border-color: var(--green); 
            color: var(--green); 
            box-shadow: 0 0 5px var(--green); 
        }
        .header { 
            display: flex; 
            justify-content: space-between; 
            font-size: 11px; 
            color: var(--green); 
            border-bottom: 1px solid var(--green); 
            padding-bottom: 10px; 
            margin-bottom: 25px; 
            margin-top: 10px; 
            flex-wrap: wrap;
            gap: 10px;
        }
        .ip-section {
            margin-bottom: 15px;
        }
        .ip-row {
            display: flex;
            align-items: baseline;
            gap: 10px;
            margin-bottom: 5px;
        }
        .ip-label {
            color: var(--dim);
            font-size: 10px;
            text-transform: uppercase;
            min-width: 45px;
        }
        .ip-val { 
            font-size: clamp(1.2rem, 5vw, 2.3rem); 
            font-weight: bold; 
            color: var(--green); 
            text-shadow: 0 0 10px rgba(0,230,118,0.3); 
            word-break: break-all; 
            flex: 1;
        }
        .ip-val-small {
            font-size: 1rem !important;
            color: var(--dim) !important;
        }
        .label { 
            color: var(--dim); 
            font-size: 10px; 
            text-transform: uppercase; 
            margin-bottom: 6px; 
            letter-spacing: 0.5px;
        }
        .grid { 
            display: grid; 
            grid-template-columns: 1fr 1.2fr; 
            gap: 30px; 
            border-top: 1px solid #222; 
            padding-top: 25px; 
        }
        .item-box { 
            background: rgba(255,255,255,0.03); 
            padding: 12px; 
            border-left: 2px solid var(--green); 
            margin-bottom: 15px; 
        }
        .row { 
            display: flex; 
            justify-content: space-between; 
            font-size: 11px; 
            margin-bottom: 4px; 
            border-bottom: 1px solid rgba(255,255,255,0.05); 
            padding-bottom: 4px; 
        }
        .chart-container {
            width: 100%;
            height: 50px;
            margin-top: 8px;
        }
        canvas { 
            display: block;
            width: 100% !important; 
            height: 50px !important; 
            background: rgba(0,230,118,0.02); 
        }
        .blink { animation: b 1.5s infinite; }
        @keyframes b { 50% { opacity: 0; } }
        .footer {
            margin-top: 30px; 
            font-size: 9px; 
            display: flex; 
            justify-content: space-between; 
            color: var(--green); 
            opacity: 0.6;
            flex-wrap: wrap;
            gap: 10px;
        }
        .copy-btn, .action-btn {
            background: transparent;
            border: 1px solid var(--dim);
            color: var(--dim);
            font-size: 9px;
            padding: 4px 8px;
            cursor: pointer;
            font-family: inherit;
            transition: 0.3s;
        }
        .copy-btn:hover, .action-btn:hover {
            border-color: var(--green);
            color: var(--green);
        }
        .loss-result {
            margin-top: 6px;
            font-size: 10px;
        }
        @media (max-width: 600px) { 
            .grid { grid-template-columns: 1fr; } 
            .terminal { padding: 20px; }
            .lang-switcher { position: static; justify-content: flex-end; margin-bottom: 10px; }
            .ip-row { flex-wrap: wrap; gap: 2px; }
        }
    </style>
</head>
<body>
    <div class="terminal">
        <div class="lang-switcher">
            <button class="lang-btn" data-lang="en" onclick="setLang('en')">EN</button>
            <button class="lang-btn" data-lang="zh-CN" onclick="setLang('zh-CN')">简体</button>
            <button class="lang-btn" data-lang="zh-TW" onclick="setLang('zh-TW')">繁體</button>
        </div>
        <div class="header">
            <span id="t-status">SYSTEM STATUS: OPERATIONAL</span>
            <span>NODE: ${data.colo}</span>
        </div>
        <div class="ip-section">
            <div class="ip-row">
                <span class="ip-label" id="t-ipv4-label">IPv4:</span>
                <span id="v4" class="ip-val">Detecting...</span>
            </div>
            <div class="ip-row">
                <span class="ip-label" id="t-ipv6-label">IPv6:</span>
                <span id="v6" class="ip-val ip-val-small">Detecting...</span>
            </div>
        </div>
        <div class="grid">
            <div class="col">
                <div class="label" id="t-sec">SECURITY & NETWORK</div>
                <div class="item-box">
                    <div class="row"><span id="t-dc-label">DC / PROXY</span><span id="s-dc">---</span></div>
                    <div class="row"><span id="t-risk">RISK LEVEL</span><span id="s-risk">---</span></div>
                    <div class="row"><span id="t-asn-label">ASN</span><span>${data.asn}</span></div>
                    <div class="row"><span id="t-proto-label">PROTOCOL</span><span id="proto-val">${data.proto}</span></div>
                    <div class="row"><span id="t-tls-label">TLS</span><span>${data.tlsVersion}</span></div>
                    <div class="row"><span id="t-cipher-label">CIPHER</span><span style="font-size:9px;">${data.tlsCipher}</span></div>
                    <div class="row"><span id="t-ech-label">ECH</span><span id="ech-val">---</span></div>
                    <div class="row"><span id="t-bot-label">BOT SCORE</span><span id="bot-score-val">${data.botScore}</span></div>
                    <div class="row"><span id="t-worker">WORKER TIME</span><span>${workerDuration}ms</span></div>
                </div>
                
                <div class="label" id="t-geo">LOCATION / ISP</div>
                <div class="item-box" style="font-size: 12px;">
                    ${data.city}, ${data.region}, ${data.country}<br>
                    <span style="color: var(--dim); font-size: 10px;">${data.lat}°${data.latDir} / ${data.lon}°${data.lonDir}</span><br>
                    <span style="color: var(--dim); font-size: 10px;">${data.asOrg}</span>
                </div>
            </div>
            
            <div class="col">
                <div class="label" style="display: flex; align-items: baseline; gap: 10px;">
                    <span id="t-rtt">LOCAL RTT</span>
                    <span id="rtt-num">--</span>ms
                    <span style="margin-left: 12px; color: var(--dim);" id="t-jitter">JITTER</span>
                    <span id="jitter-val">--</span>
                </div>
                <div class="chart-container">
                    <canvas id="chart"></canvas>
                </div>
                
                <div style="margin-top: 10px; display: flex; align-items: center; gap: 10px;">
                    <button class="action-btn" id="btn-loss-test"><span id="t-loss-btn">TEST PACKET LOSS</span></button>
                    <span id="loss-result" class="loss-result" style="color: var(--dim);"></span>
                </div>

                <div class="label" style="margin-top:20px" id="t-user-geo">USER IP LOCATION</div>
                <div class="item-box" style="font-size: 12px;" id="user-geo-info">
                    <span style="color: var(--dim);">Fetching...</span>
                </div>

                <div class="label" style="margin-top:20px" id="t-hw">HARDWARE INFO</div>
                <div id="hw-info" style="font-size: 10px; color: var(--dim); border-left: 2px solid var(--dim); padding-left: 10px;">Loading...</div>
            </div>
        </div>
        <div class="footer">
            <span>RAY: ${data.rayId} | IP: ${data.clientIp}</span>
            <span style="display: flex; gap: 15px;">
                <button class="copy-btn" id="copy-report">
                    <span id="t-copy">COPY REPORT</span>
                </button>
                <span><span class="blink">●</span> <span id="t-live">LIVE_TRACE</span></span>
            </span>
        </div>
    </div>
    <script>
        (function(){
            const i18n = {
                'en': { 
                    status: 'STATUS: OPERATIONAL',
                    ipv4Label: 'IPv4:',
                    ipv6Label: 'IPv6:',
                    geo: 'LOCATION / ISP',
                    rtt: 'LOCAL RTT',
                    live: 'LIVE_TRACE',
                    sec: 'SECURITY & NETWORK',
                    hw: 'HARDWARE INFO',
                    risk: 'RISK LEVEL',
                    clean: 'CLEAN',
                    high: 'RISK',
                    yes: 'YES',
                    no: 'NO',
                    unavailable: 'Unavailable',
                    worker: 'WORKER TIME',
                    copy: 'COPY REPORT',
                    copied: 'COPIED!',
                    reportTitle: 'NETWORK DIAGNOSTICS REPORT',
                    dcLabel: 'DC / PROXY',
                    asnLabel: 'ASN',
                    protoLabel: 'PROTOCOL',
                    tlsLabel: 'TLS',
                    cipherLabel: 'CIPHER',
                    echLabel: 'ECH',
                    echEnabled: 'ENABLED',
                    echDisabled: 'DISABLED',
                    botLabel: 'BOT SCORE',
                    botRisk: 'RISK LEVEL:',
                    lossBtn: 'TEST PACKET LOSS',
                    lossTesting: 'Testing...',
                    lossResult: 'Loss:',
                    lossNone: '0% (no loss)',
                    jitter: 'JITTER',
                    userGeo: 'USER IP LOCATION'
                },
                'zh-CN': { 
                    status: '系统状态: 正常运行',
                    ipv4Label: 'IPv4:',
                    ipv6Label: 'IPv6:',
                    geo: '地理位置 / 运营商',
                    rtt: '本地往返时延',
                    live: '实时监控中',
                    sec: '安全及协议',
                    hw: '硬件摘要',
                    risk: '风控评级',
                    clean: '极度纯净',
                    high: '风险',
                    yes: '是',
                    no: '否',
                    unavailable: '获取失败',
                    worker: '边缘耗时',
                    copy: '复制报告',
                    copied: '已复制!',
                    reportTitle: '网络诊断报告',
                    dcLabel: '数据中心/代理',
                    asnLabel: 'ASN',
                    protoLabel: '协议',
                    tlsLabel: 'TLS',
                    cipherLabel: '加密套件',
                    echLabel: 'ECH',
                    echEnabled: '已启用',
                    echDisabled: '未启用',
                    botLabel: '机器人评分',
                    botRisk: '风险等级:',
                    lossBtn: '测试丢包率',
                    lossTesting: '测试中...',
                    lossResult: '丢包率:',
                    lossNone: '0% (无丢包)',
                    jitter: '抖动',
                    userGeo: '真实IP位置'
                },
                'zh-TW': { 
                    status: '系統狀態: 正常運行',
                    ipv4Label: 'IPv4:',
                    ipv6Label: 'IPv6:',
                    geo: '地理位置 / 運營商',
                    rtt: '本地往返時延',
                    live: '實時監控中',
                    sec: '安全及協議',
                    hw: '硬體摘要',
                    risk: '風控評級',
                    clean: '極度純淨',
                    high: '風險',
                    yes: '是',
                    no: '否',
                    unavailable: '獲取失敗',
                    worker: '邊緣耗時',
                    copy: '複製報告',
                    copied: '已複製!',
                    reportTitle: '網路診斷報告',
                    dcLabel: '資料中心/代理',
                    asnLabel: 'ASN',
                    protoLabel: '協定',
                    tlsLabel: 'TLS',
                    cipherLabel: '加密套件',
                    echLabel: 'ECH',
                    echEnabled: '已啟用',
                    echDisabled: '未啟用',
                    botLabel: '機器人評分',
                    botRisk: '風險等級:',
                    lossBtn: '測試丟包率',
                    lossTesting: '測試中...',
                    lossResult: '丟包率:',
                    lossNone: '0% (無丟包)',
                    jitter: '抖動',
                    userGeo: '真實IP位置'
                }
            };
            const BACKEND_DATA = {
                asOrg: "${data.asOrg}",
                asn: "${data.asn}",
                colo: "${data.colo}",
                city: "${data.city}",
                region: "${data.region}",
                country: "${data.country}",
                lat: "${data.lat}\u00b0${data.latDir}",
                lon: "${data.lon}\u00b0${data.lonDir}",
                proto: "${data.proto}",
                tlsVersion: "${data.tlsVersion}",
                tlsCipher: "${data.tlsCipher}",
                botScore: "${data.botScore}",
                rayId: "${data.rayId}",
                clientIp: "${data.clientIp}",
                workerDuration: "${workerDuration}",
                httpProtocolRaw: "${data.httpProtocolRaw}",
                latNum: ${data.latNum},
                lonNum: ${data.lonNum},
                tlsClientHelloLength: ${data.tlsClientHelloLength}
            };
            
            const elements = {
                v4: document.getElementById('v4'),
                v6: document.getElementById('v6'),
                rttNum: document.getElementById('rtt-num'),
                chart: document.getElementById('chart'),
                ctx: document.getElementById('chart').getContext('2d'),
                sDc: document.getElementById('s-dc'),
                sRisk: document.getElementById('s-risk'),
                hwInfo: document.getElementById('hw-info'),
                copyBtn: document.getElementById('copy-report'),
                jitterVal: document.getElementById('jitter-val'),
                protoVal: document.getElementById('proto-val'),
                userGeoInfo: document.getElementById('user-geo-info'),
                echVal: document.getElementById('ech-val'),
                botScoreVal: document.getElementById('bot-score-val'),
                lossBtn: document.getElementById('btn-loss-test'),
                lossResult: document.getElementById('loss-result')
            };
            let currentLang = localStorage.getItem('pref-lang') || '${defaultLang}';
            const rttData = [];
            const MAX_RTT_POINTS = 40;
            const jitterHistory = [];
            const MAX_JITTER_HISTORY = 10;
            function isDataCenter() {
                const patterns = /data center|hosting|cloud|akamai|google|amazon|microsoft|aliyun|tencent|fastly|cloudflare|incapsula|leaseweb|ovh|digitalocean|vultr|linode/i;
                return patterns.test(BACKEND_DATA.asOrg);
            }
            function fetchWithTimeout(url, options = {}, timeout = 2000) {
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), timeout);
                return fetch(url, { ...options, signal: controller.signal })
                    .finally(() => clearTimeout(id));
            }
            function updateUI() {
                const t = i18n[currentLang];
                const textIds = {
                    't-status': t.status,
                    't-ipv4-label': t.ipv4Label,
                    't-ipv6-label': t.ipv6Label,
                    't-geo': t.geo,
                    't-sec': t.sec,
                    't-rtt': t.rtt,
                    't-hw': t.hw,
                    't-live': t.live,
                    't-risk': t.risk,
                    't-worker': t.worker,
                    't-copy': t.copy,
                    't-dc-label': t.dcLabel,
                    't-asn-label': t.asnLabel,
                    't-proto-label': t.protoLabel,
                    't-tls-label': t.tlsLabel,
                    't-cipher-label': t.cipherLabel,
                    't-ech-label': t.echLabel,
                    't-bot-label': t.botLabel,
                    't-jitter': t.jitter,
                    't-user-geo': t.userGeo,
                    't-loss-btn': t.lossBtn
                };
                Object.entries(textIds).forEach(([id, text]) => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = text;
                });
                document.querySelectorAll('.lang-btn').forEach(btn => {
                    const lang = btn.getAttribute('data-lang');
                    btn.classList.toggle('active', lang === currentLang);
                });
                const dc = isDataCenter();
                elements.sDc.textContent = dc ? t.yes : t.no;
                elements.sDc.style.color = dc ? 'var(--red)' : 'var(--green)';
                elements.sRisk.textContent = dc ? t.high : t.clean;
                elements.sRisk.style.color = dc ? 'var(--red)' : 'var(--green)';

                // 协议与 QUIC 标识
                if (elements.protoVal) {
                    const rawProto = BACKEND_DATA.httpProtocolRaw;
                    let displayText = rawProto;
                    if (rawProto.toUpperCase().includes('HTTP/3')) {
                        displayText += ' ⚡ QUIC';
                        elements.protoVal.style.color = 'var(--green)';
                        elements.protoVal.style.fontWeight = 'bold';
                    } else {
                        elements.protoVal.style.color = '';
                        elements.protoVal.style.fontWeight = '';
                    }
                    elements.protoVal.textContent = displayText;
                }

                // ECH 探测结果
                if (elements.echVal) {
                    const helloLen = BACKEND_DATA.tlsClientHelloLength;
                    if (helloLen > 0) {
                        elements.echVal.textContent = t.echEnabled + ' (len:' + helloLen + ')';
                        elements.echVal.style.color = 'var(--green)';
                    } else {
                        elements.echVal.textContent = t.echDisabled;
                        elements.echVal.style.color = 'var(--red)';
                    }
                }

                // Bot Score 风险解读 (颜色+文字)
                if (elements.botScoreVal) {
                    const score = parseInt(BACKEND_DATA.botScore, 10);
                    let levelText = '';
                    let color = '';
                    if (score >= 100) { levelText = ' 👤 HUMAN'; color = 'var(--green)'; }
                    else if (score >= 80) { levelText = ' ✓ LOW'; color = 'var(--yellow)'; }
                    else if (score >= 30) { levelText = ' ⚠ MEDIUM'; color = 'var(--orange)'; }
                    else { levelText = ' ❌ HIGH'; color = 'var(--red)'; }
                    elements.botScoreVal.innerHTML = score + '<span style="color:' + color + '; margin-left: 6px;">' + levelText + '</span>';
                }
            }
            window.setLang = function(lang) {
                currentLang = lang;
                localStorage.setItem('pref-lang', lang);
                updateUI();
                const t = i18n[currentLang];
                if (elements.v4.textContent.includes('Unavailable') || elements.v4.textContent.includes('获取失败') || elements.v4.textContent.includes('獲取失敗')) {
                    elements.v4.textContent = t.unavailable;
                }
                if (elements.v6.textContent.includes('Unavailable') || elements.v6.textContent.includes('获取失败') || elements.v6.textContent.includes('獲取失敗')) {
                    elements.v6.textContent = t.unavailable;
                }
                if (elements.v4.textContent && !elements.v4.textContent.includes('Detecting') && !elements.v4.textContent.includes(t.unavailable)) {
                    fetchUserGeo();
                }
            };
            function resizeCanvas() {
                const canvas = elements.chart;
                const container = canvas.parentElement;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                if (rect.width > 0) {
                    canvas.width = rect.width;
                    canvas.height = rect.height;
                    drawChart();
                }
            }
            function drawChart() {
                const canvas = elements.chart;
                const ctx = elements.ctx;
                if (canvas.width === 0 || canvas.height === 0) return;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (rttData.length === 0) return;
                ctx.beginPath();
                ctx.strokeStyle = '#00e676';
                ctx.lineWidth = 2;
                const stepX = canvas.width / (MAX_RTT_POINTS - 1);
                const maxRtt = 500;
                rttData.forEach((value, index) => {
                    const x = index * stepX;
                    const y = canvas.height - (Math.min(value, maxRtt) / maxRtt) * (canvas.height - 10);
                    if (index === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.stroke();
            }
            async function getIP(version) {
                const el = version === 'v4' ? elements.v4 : elements.v6;
                const urls = version === 'v4' 
                    ? ['https://api4.ipify.org', 'https://ipv4.icanhazip.com', 'https://ip4.seeip.org']
                    : ['https://api6.ipify.org', 'https://ipv6.icanhazip.com'];
                for (const url of urls) {
                    try {
                        const res = await fetchWithTimeout(url, {}, 2000);
                        if (res.ok) {
                            const ip = (await res.text()).trim();
                            if (ip) {
                                el.textContent = ip;
                                el.style.color = '';
                                return;
                            }
                        }
                    } catch (e) {}
                }
                el.textContent = i18n[currentLang].unavailable;
                el.style.color = 'var(--red)';
            }
            async function testRtt() {
                const start = performance.now();
                try {
                    await fetchWithTimeout(window.location.href + '?_=' + Date.now(), 
                        { method: 'HEAD', cache: 'no-store' }, 2000);
                    const diff = Math.round(performance.now() - start);
                    elements.rttNum.textContent = diff;
                    
                    if (rttData.length > 0) {
                        const jitter = Math.abs(diff - rttData[rttData.length - 1]);
                        jitterHistory.push(jitter);
                        if (jitterHistory.length > MAX_JITTER_HISTORY) jitterHistory.shift();
                        const avgJitter = Math.round(jitterHistory.reduce((a,b) => a+b, 0) / jitterHistory.length);
                        elements.jitterVal.textContent = avgJitter + 'ms';
                    }
                    
                    rttData.push(diff);
                    if (rttData.length > MAX_RTT_POINTS) rttData.shift();
                    drawChart();
                } catch (e) {}
                setTimeout(testRtt, 3000);
            }
            function calculateDistance(lat1, lon1, lat2, lon2) {
                const R = 6371;
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                          Math.sin(dLon/2) * Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                return Math.round(R * c);
            }
            async function fetchUserGeo() {
                const ip = elements.v4.textContent;
                if (!ip || ip.includes('Detecting') || ip.includes(i18n[currentLang].unavailable)) {
                    setTimeout(fetchUserGeo, 1000);
                    return;
                }
                try {
                    const res = await fetch(\`https://ipapi.co/\${ip}/json/\`);
                    const data = await res.json();
                    if (data.error) throw new Error(data.reason);
                    
                    const dist = calculateDistance(
                        BACKEND_DATA.latNum, BACKEND_DATA.lonNum,
                        data.latitude, data.longitude
                    );
                    
                    elements.userGeoInfo.innerHTML = \`
                        <div style="display: flex; justify-content: space-between;">
                            <span>\${data.city}, \${data.region}, \${data.country_name}</span>
                            <span style="color: var(--yellow);">\${dist} km</span>
                        </div>
                        <div style="color: var(--dim); font-size: 10px; margin-top: 4px;">
                            ISP: \${data.org} | IP: \${ip}
                        </div>
                    \`;
                } catch (e) {
                    elements.userGeoInfo.innerHTML = '<span style="color: var(--red);">Geo lookup failed</span>';
                }
            }
            function updateHardwareInfo() {
                const cores = navigator.hardwareConcurrency || 'N/A';
                const screenInfo = screen.width + 'x' + screen.height;
                const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                elements.hwInfo.textContent = [screenInfo, cores + ' CORE', timezone].join(' | ');
            }

            // 丢包率测试
            let lossTestRunning = false;
            async function runLossTest() {
                if (lossTestRunning) return;
                lossTestRunning = true;
                const t = i18n[currentLang];
                elements.lossResult.textContent = t.lossTesting;
                elements.lossResult.style.color = 'var(--yellow)';
                
                const total = 10;
                let failed = 0;
                for (let i = 0; i < total; i++) {
                    try {
                        await fetchWithTimeout(window.location.href + '?_loss=' + Date.now() + i, 
                            { method: 'HEAD', cache: 'no-store' }, 1500);
                    } catch (e) {
                        failed++;
                    }
                }
                const lossPercent = Math.round((failed / total) * 100);
                if (lossPercent === 0) {
                    elements.lossResult.textContent = t.lossNone;
                    elements.lossResult.style.color = 'var(--green)';
                } else {
                    elements.lossResult.textContent = t.lossResult + ' ' + lossPercent + '% (' + failed + '/' + total + ' lost)';
                    elements.lossResult.style.color = 'var(--red)';
                }
                lossTestRunning = false;
            }

            function generateReportText() {
                const t = i18n[currentLang];
                const now = new Date().toISOString();
                const ipv4 = elements.v4.textContent;
                const ipv6 = elements.v6.textContent;
                const dc = isDataCenter() ? t.yes : t.no;
                const risk = isDataCenter() ? t.high : t.clean;
                return \`[\${t.reportTitle}]
Generated: \${now}
Language: \${currentLang}
--- NODE INFO ---
Worker Node: \${BACKEND_DATA.colo}
Client IP: \${BACKEND_DATA.clientIp}
\${t.ipv4Label} \${ipv4}
\${t.ipv6Label} \${ipv6}
Ray ID: \${BACKEND_DATA.rayId}
--- SECURITY ---
\${t.dcLabel}: \${dc}
\${t.risk}: \${risk}
\${t.asnLabel}: \${BACKEND_DATA.asn}
AS Org: \${BACKEND_DATA.asOrg}
\${t.protoLabel}: \${BACKEND_DATA.proto}
\${t.tlsLabel}: \${BACKEND_DATA.tlsVersion}
\${t.cipherLabel}: \${BACKEND_DATA.tlsCipher}
\${t.echLabel}: \${elements.echVal.textContent}
\${t.botLabel}: \${BACKEND_DATA.botScore}
\${t.worker}: \${BACKEND_DATA.workerDuration}ms
--- LOCATION ---
City/Region/Country: \${BACKEND_DATA.city}, \${BACKEND_DATA.region}, \${BACKEND_DATA.country}
Coordinates: \${BACKEND_DATA.lat} / \${BACKEND_DATA.lon}
--- PERFORMANCE ---
\${t.rtt}: \${elements.rttNum.textContent}ms
\${t.jitter}: \${elements.jitterVal.textContent}
--- HARDWARE ---
\${elements.hwInfo.textContent}
\`;
            }
            async function copyReport() {
                const text = generateReportText();
                try {
                    await navigator.clipboard.writeText(text);
                    const copySpan = document.getElementById('t-copy');
                    const originalText = copySpan.textContent;
                    copySpan.textContent = i18n[currentLang].copied;
                    setTimeout(() => {
                        copySpan.textContent = originalText;
                    }, 1500);
                } catch (err) {
                    alert('Copy failed: ' + err);
                }
            }

            // 注册 Service Worker (PWA)
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js').catch(e => console.log('SW registration failed', e));
                });
            }

            function init() {
                updateUI();
                updateHardwareInfo();
                window.addEventListener('resize', resizeCanvas);
                const observer = new ResizeObserver(() => resizeCanvas());
                observer.observe(elements.chart.parentElement);
                resizeCanvas();
                getIP('v4').then(() => {
                    fetchUserGeo();
                });
                getIP('v6');
                testRtt();
                elements.copyBtn.addEventListener('click', copyReport);
                elements.lossBtn.addEventListener('click', runLossTest);
            }
            init();
        })();
    </script>
</body>
</html>`;
  return new Response(html, {
    headers: {
      'content-type': 'text/html;charset=UTF-8',
      'cache-control': 'no-cache, no-store, must-revalidate',
      'server-timing': `worker;dur=${workerDuration}`
    }
  });
}
