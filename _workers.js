addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const cf = request.cf || {};
  const acceptLang = request.headers.get('accept-language') || '';
  
  // 語言判定
  let lang = 'en';
  if (acceptLang.match(/zh-(CN|SG|MY)/i)) {
    lang = 'zh-CN';
  } else if (acceptLang.match(/zh-(TW|HK|MO)/i) || acceptLang.includes('zh')) {
    lang = 'zh-TW';
  }

  const i18n = {
    'zh-CN': {
      title: '终端 - 双栈 IP 诊断',
      status: '系统状态: 正常运行',
      ipv4: 'IPv4 地址',
      ipv6: 'IPv6 地址',
      geo: '地理位置',
      coords: '经纬度坐标',
      isp: '网络服务供应商',
      protocol: '协议栈',
      connStatus: '连接状态',
      secured: '安全加密连接',
      live: '实时追踪',
      loading: '正在检测...',
      noSupport: '未检测到 / 不支持'
    },
    'zh-TW': {
      title: '終端 - 雙棧 IP 診斷',
      status: '系統狀態: 正常運行',
      ipv4: 'IPv4 地址',
      ipv6: 'IPv6 地址',
      geo: '地理位置',
      coords: '經緯度座標',
      isp: '網絡服務供應商',
      protocol: '協議棧',
      connStatus: '連線狀態',
      secured: '安全加密連線',
      live: '實時追蹤',
      loading: '正在檢測...',
      noSupport: '未檢測到 / 不支持'
    },
    'en': {
      title: 'TERMINAL - DUAL-STACK DIAG',
      status: 'SYSTEM STATUS: OPERATIONAL',
      ipv4: 'IPv4 Address',
      ipv6: 'IPv6 Address',
      geo: 'Geolocation',
      coords: 'Coordinates',
      isp: 'ISP',
      protocol: 'Protocol Stack',
      connStatus: 'Connection Status',
      secured: 'SECURED / ENCRYPTED',
      live: 'LIVE_TRACE',
      loading: 'Detecting...',
      noSupport: 'Not Detected'
    }
  };

  const text = i18n[lang] || i18n['en'];

  const html = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${text.title}</title>
    <style>
        :root {
            --bg-color: #0a0b0d;
            --accent-color: #00e676;
            --text-color: #d1d1d1;
            --grid-color: rgba(0, 230, 118, 0.05);
        }
        body {
            background-color: var(--bg-color);
            color: var(--text-color);
            font-family: 'Consolas', 'Monaco', 'PingFang SC', 'Microsoft YaHei', monospace;
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        body::before {
            content: "";
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background-image: linear-gradient(var(--grid-color) 1px, transparent 1px),
                              linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
            background-size: 30px 30px;
            z-index: -1;
        }
        .terminal {
            width: 90%;
            max-width: 750px;
            background: rgba(16, 18, 22, 0.95);
            border: 1px solid var(--accent-color);
            box-shadow: 0 0 30px rgba(0, 230, 118, 0.15);
            padding: 30px;
            position: relative;
        }
        .header {
            border-bottom: 1px solid var(--accent-color);
            padding-bottom: 10px;
            margin-bottom: 25px;
            display: flex;
            justify-content: space-between;
            font-size: 0.75rem;
            color: var(--accent-color);
        }
        .ip-row { margin-bottom: 20px; }
        .ip-large {
            font-size: clamp(1.2rem, 4.5vw, 2.2rem);
            font-weight: bold;
            color: var(--accent-color);
            text-shadow: 0 0 10px rgba(0, 230, 118, 0.3);
            word-break: break-all;
            min-height: 1.2em;
        }
        .data-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            border-top: 1px solid #333;
            padding-top: 20px;
        }
        @media (max-width: 600px) { .data-grid { grid-template-columns: 1fr; } }
        .label { color: #888; font-size: 0.7rem; text-transform: uppercase; margin-bottom: 4px; }
        .value { color: #fff; margin-bottom: 15px; font-size: 0.9rem; border-left: 2px solid var(--accent-color); padding-left: 10px; }
        .status-bar {
            margin-top: 30px;
            font-size: 0.7rem;
            background: rgba(0, 230, 118, 0.08);
            padding: 10px;
            display: flex;
            justify-content: space-between;
        }
    </style>
</head>
<body>
    <div class="terminal">
        <div class="header">
            <span>${text.status}</span>
            <span>NODE: ${cf.colo || 'XXX'}</span>
        </div>

        <div class="ip-section">
            <div class="ip-row">
                <div class="label">${text.ipv4}</div>
                <div id="ipv4" class="ip-large">${text.loading}</div>
            </div>
            <div class="ip-row">
                <div class="label">${text.ipv6}</div>
                <div id="ipv6" class="ip-large">${text.loading}</div>
            </div>
        </div>

        <div class="data-grid">
            <div class="col">
                <div class="label">${text.geo}</div>
                <div class="value">${cf.city || 'Unknown'}, ${cf.country || 'Unknown'}</div>
                <div class="label">${text.coords}</div>
                <div class="value">${cf.latitude}N / ${cf.longitude}E</div>
                <div class="label">${text.isp}</div>
                <div class="value">${cf.asOrganization || 'Unknown'}</div>
            </div>
            <div class="col">
                <div class="label">${text.protocol}</div>
                <div class="value">${request.cf.httpProtocol} / ${request.cf.tlsVersion}</div>
                <div class="label">RAY ID</div>
                <div class="value" style="font-size: 0.8rem;">${request.headers.get('cf-ray')}</div>
                <div class="label">${text.connStatus}</div>
                <div class="value" style="color: var(--accent-color); font-weight: bold;">${text.secured}</div>
            </div>
        </div>

        <div class="status-bar">
            <span style="max-width: 70%; overflow: hidden; text-overflow: ellipsis;">UA: ${request.headers.get('user-agent')}</span>
            <span style="color: var(--accent-color); font-weight: bold;">${text.live}</span>
        </div>
    </div>

    <script>
        async function getIP(version) {
            const el = document.getElementById('ip' + version);
            // 使用不同的公共 API 源以增加成功率
            const sources = version === 'v4' 
                ? ['https://api4.ipify.org', 'https://ipv4.icanhazip.com', 'https://v4.ident.me']
                : ['https://api6.ipify.org', 'https://ipv6.icanhazip.com', 'https://v6.ident.me'];

            for (let src of sources) {
                try {
                    const resp = await fetch(src, { mode: 'cors', timeout: 3000 });
                    if (resp.ok) {
                        const ip = await resp.text();
                        if (ip.trim()) {
                            el.innerText = ip.trim();
                            el.style.color = 'var(--accent-color)';
                            return;
                        }
                    }
                } catch (e) { continue; }
            }
            el.innerText = "${text.noSupport}";
            el.style.color = "#555";
        }

        getIP('v4');
        getIP('v6');
    </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  })
}
