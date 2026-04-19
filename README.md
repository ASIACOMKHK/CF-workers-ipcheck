下面是**整套完整文件内容**，你直接新建对应文件复制进去即可上传 GitHub：

---

# 1. `README.md`
```markdown
# CF-workers-ipcheck
![GitHub](https://img.shields.io/github/license/ASIACOMKHK/CF-workers-ipcheck)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020)
![IPv4/IPv6](https://img.shields.io/badge/IP-IPv4%2FIPv6-blue)
![Language](https://img.shields.io/badge/Language-JavaScript-yellow)

基于 Cloudflare Workers 构建的轻量级 IP 信息查询工具，支持 IPv4/IPv6 双栈，自带网页展示与多格式 API 接口，一键部署、全球节点加速。

## ✨ 功能特性
- 自动获取访客真实出口 IP（IPv4 / IPv6 自动识别）
- 显示国家、地区、城市、时区、Cloudflare 节点
- 响应式网页界面，自动适配深色/浅色模式
- 提供网页、纯文本、JSON 三种访问格式
- 零依赖、无服务器、部署即用
- 全球边缘节点响应，延迟极低

## 🖼️ 演示截图
![演示截图](https://raw.githubusercontent.com/ASIACOMKHK/CF-workers-ipcheck/main/screenshot.png)

## 🚀 快速部署

### 方式 1：Cloudflare 控制台部署（推荐）
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 Workers & Pages → 创建应用 → 创建 Worker
3. 将 `_workers.js` 代码全部粘贴
4. 保存并部署

### 方式 2：Wrangler CLI 部署
```bash
git clone https://github.com/ASIACOMKHK/CF-workers-ipcheck.git
cd CF-workers-ipcheck
npm install
npm run deploy
```

## 📡 接口说明
- `/`          网页展示 IP 信息
- `/ip`        仅返回 IP 地址（纯文本）
- `/json`      返回完整 JSON 信息

调用示例：
```bash
curl https://your-worker.workers.dev/json
```

## 📁 项目结构
```
CF-workers-ipcheck/
├── _workers.js       # Workers 主脚本
├── README.md         # 项目说明
├── wrangler.toml     # Wrangler 配置
├── LICENSE           # 开源协议
```

## 📌 FAQ 常见问题
### 1. 获取到的是 IPv6 而非 IPv4？
由你的网络环境自动决定，设备优先使用 IPv6 时会显示 IPv6。

### 2. 地区信息不准确？
IP 库来自 Cloudflare 内置数据，部分代理、内网环境会影响精度。

### 3. 可以绑定自定义域名吗？
可以，在 Workers → 触发器 → 添加自定义域名即可。

### 4. 有无请求限制？
遵循 Cloudflare Workers 免费套餐额度，个人日常使用完全足够。

### 5. 可用于商业项目吗？
可以，本项目基于 MIT 协议，可自由使用、修改、分发。

## 🎯 适用场景
- 快速查看本机出口 IP
- 脚本/程序自动获取公网 IP
- 网站访客 IP 统计展示
- 网络调试与双栈连通性测试
- Cloudflare Workers 入门学习

## 📄 License
[MIT License](LICENSE)
```

---

# 2. `_workers.js`
```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname

  const ip = request.headers.get('CF-Connecting-IP') || 'Unknown'
  const country = request.cf?.country || 'Unknown'
  const region = request.cf?.region || 'Unknown'
  const city = request.cf?.city || 'Unknown'
  const colo = request.cf?.colo || 'Unknown'
  const timezone = request.cf?.timezone || 'Unknown'
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: timezone })

  if (path === '/ip') {
    return new Response(ip, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  }

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

  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>IP Check</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
@media(prefers-color-scheme:dark){body{background:#0f172a;color:#e2e8f0}}
.container{background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 10px 25px -5px rgba(0,0,0,.1);padding:32px;max-width:500px;width:100%}
@media(prefers-color-scheme:dark){.container{background:#1e293b;border-color:#334155}}
h1{font-size:24px;margin-bottom:24px;text-align:center;color:#0ea5e9}
.item{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #e2e8f0}
@media(prefers-color-scheme:dark){.item{border-color:#334155}}
.item:last-child{border-bottom:none}
.label{opacity:.8}
.value{font-weight:600;word-break:break-all}
.footer{margin-top:24px;text-align:center;font-size:12px;opacity:.6}
</style>
</head>
<body>
<div class="container">
<h1>🌐 IP 信息查询</h1>
<div class="item"><span class="label">IP 地址</span><span class="value">${ip}</span></div>
<div class="item"><span class="label">国家/地区</span><span class="value">${country}</span></div>
<div class="item"><span class="label">地区</span><span class="value">${region}</span></div>
<div class="item"><span class="label">城市</span><span class="value">${city}</span></div>
<div class="item"><span class="label">CF 节点</span><span class="value">${colo}</span></div>
<div class="item"><span class="label">时间</span><span class="value">${timestamp}</span></div>
<div class="footer">Powered by Cloudflare Workers</div>
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
```

---

# 3. `wrangler.toml`
```toml
name = "cf-workers-ipcheck"
main = "_workers.js"
compatibility_date = "2024-04-01"

[vars]
# 这里可放环境变量，本项目无需
```

---

# 4. `LICENSE` (MIT)
```
MIT License

Copyright (c) 2026 ASIACOMKHK

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

# 5. `.gitignore`
```
node_modules/
.DS_Store
*.log
.wrangler/
dist/
```

---

## 最终文件夹结构
```
CF-workers-ipcheck/
├── _workers.js
├── README.md
├── wrangler.toml
├── LICENSE
└── .gitignore
