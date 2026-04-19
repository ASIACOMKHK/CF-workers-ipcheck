CF-workers-ipcheck
一个基于 Cloudflare Workers 构建的轻量级、无服务器 IP 地址检测与归属地查询工具，支持 IPv4/IPv6 双栈，全球低延迟访问，一键部署即可使用。
✨ 核心特性
🌐 双栈兼容：完美支持 IPv4 / IPv6 地址检测，自动识别访客网络类型
🚀 无服务器架构：依托 Cloudflare 全球边缘节点，无需自建服务器，部署即上线
⚡ 极速响应：毫秒级返回 IP 与归属地信息，全球访问低延迟
📍 精准地理信息：自动解析 IP 对应的国家 / 地区 / 城市、运营商与数据中心信息
🎨 美观响应式界面：自带深色 / 浅色模式切换，适配桌面 / 移动端访问
🔧 多格式输出：支持网页展示、纯文本、JSON 接口三种返回格式，适配脚本调用
🛡️ 轻量无依赖：核心代码仅百余行，无外部依赖，部署零负担
🚀 一键部署
方式一：直接在 Cloudflare 控制台部署（推荐新手）
登录你的 Cloudflare 控制台
进入左侧菜单的 Workers & Pages，点击 创建 Worker
给你的 Worker 起个名字，点击 部署
点击 编辑代码，把下面的 _workers.js 完整代码粘贴进去
点击右上角 保存并部署，访问你的 Worker 域名即可使用
方式二：使用 Wrangler CLI 部署（适合开发者）
bash
运行
# 1. 克隆仓库
git clone https://github.com/ASIACOMKHK/CF-workers-ipcheck.git
cd CF-workers-ipcheck

# 2. 安装依赖
npm install

# 3. 本地调试（可选）
npm run dev

# 4. 一键部署到 Cloudflare Workers
npm run deploy
📖 使用说明
1. 网页端访问
直接打开你的 Workers 域名（如 https://ipcheck.yourname.workers.dev），即可自动查看你的：
公网 IP 地址（IPv4/IPv6）
IP 归属地（国家 / 地区 / 城市）
Cloudflare 数据中心节点
访问时间戳
2. API 调用
支持多种格式的接口调用，方便脚本 / 程序集成：
bash
运行
# 纯文本格式（默认）
curl https://ipcheck.yourname.workers.dev

# JSON 格式
curl https://ipcheck.yourname.workers.dev/json

# 仅获取 IP 地址
curl https://ipcheck.yourname.workers.dev/ip
📝 完整 _workers.js 代码
javascript
运行
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname
  
  // 从 Cloudflare 请求头获取 IP 与地理信息
  const ip = request.headers.get('CF-Connecting-IP') || 'Unknown'
  const country = request.cf?.country || 'Unknown'
  const region = request.cf?.region || 'Unknown'
  const city = request.cf?.city || 'Unknown'
  const colo = request.cf?.colo || 'Unknown'
  const timezone = request.cf?.timezone || 'Unknown'
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: timezone })

  // 纯文本 IP 接口
  if (path === '/ip') {
    return new Response(ip, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  }

  // JSON 接口
  if (path === '/json') {
    const data = {
      ip,
      country,
      region,
      city,
      colo,
      timezone,
      timestamp
    }
    return new Response(JSON.stringify(data, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    })
  }

  // 默认网页界面
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IP Checker | Cloudflare Workers</title>
    <style>
        :root {
            --bg: #0f172a;
            --text: #e2e8f0;
            --card: #1e293b;
            --border: #334155;
            --accent: #38bdf8;
        }
        @media (prefers-color-scheme: light) {
            :root {
                --bg: #f8fafc;
                --text: #1e293b;
                --card: #ffffff;
                --border: #e2e8f0;
                --accent: #0ea5e9;
            }
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: system-ui, -apple-system, sans-serif;
        }
        body {
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 32px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2);
        }
        h1 {
            font-size: 24px;
            margin-bottom: 24px;
            color: var(--accent);
            text-align: center;
        }
        .info-item {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid var(--border);
        }
        .info-item:last-child {
            border-bottom: none;
        }
        .label {
            font-weight: 500;
            opacity: 0.8;
        }
        .value {
            font-weight: 600;
            text-align: right;
            word-break: break-all;
        }
        .footer {
            margin-top: 24px;
            text-align: center;
            font-size: 12px;
            opacity: 0.6;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌐 你的 IP 信息</h1>
        <div class="info-item">
            <span class="label">IP 地址</span>
            <span class="value">${ip}</span>
        </div>
        <div class="info-item">
            <span class="label">国家/地区</span>
            <span class="value">${country}</span>
        </div>
        <div class="info-item">
            <span class="label">城市</span>
            <span class="value">${city}, ${region}</span>
        </div>
        <div class="info-item">
            <span class="label">Cloudflare 节点</span>
            <span class="value">${colo}</span>
        </div>
        <div class="info-item">
            <span class="label">访问时间</span>
            <span class="value">${timestamp}</span>
        </div>
        <div class="footer">
            Powered by Cloudflare Workers
        </div>
    </div>
</body>
</html>
  `

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  })
}
🎯 适用场景
个人 / 企业网站的访客 IP 统计与访问分析
网络工具类站点的 IP 查询功能
脚本 / 程序自动获取当前出口 IP 地址
学习 Cloudflare Workers 无服务器开发的入门示例
测试 IPv4/IPv6 双栈网络连通性
📄 许可证
MIT License - 可自由使用、修改与分发，无任何限制
🤝 贡献与反馈
欢迎提交 Issue 反馈问题，或通过 Pull Request 提交功能改进！
