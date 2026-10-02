/**
 * 网剧编剧制作小组 · 后端服务（零依赖，纯 Node.js 内置模块）
 *
 * 功能：
 *   1. 托管前端静态文件（index.html / css / js / manifest / sw / icon）
 *   2. 提供共享数据接口 GET/PUT /api/state（数据存 data.json，整份 last-write-wins）
 *
 * 运行：  node server.js
 * 端口：  默认 8080，可用环境变量 PORT 覆盖（云平台会自动注入）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const DATA_FILE = path.join(__dirname, 'data.json');
const MAX_BODY = 8 * 1024 * 1024; // 8MB 上限

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad path' });
  }

  /* -------- 数据接口 -------- */
  if (pathname === '/api/state') {
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    if (req.method === 'GET') {
      if (fs.existsSync(DATA_FILE)) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        return fs.createReadStream(DATA_FILE).pipe(res);
      }
      return sendJson(res, 200, null);
    }

    if (req.method === 'PUT') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > MAX_BODY) req.destroy();
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!data || typeof data !== 'object') throw new Error('bad payload');
          fs.writeFileSync(DATA_FILE, JSON.stringify(data));
          sendJson(res, 200, { ok: true });
        } catch (e) {
          sendJson(res, 400, { ok: false, error: 'invalid json' });
        }
      });
      return;
    }

    return sendJson(res, 405, { ok: false, error: 'method not allowed' });
  }

  /* -------- 静态文件 -------- */
  const rel = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    return fs.createReadStream(filePath).pipe(res);
  }

  // SPA 回退到 index.html
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  return fs.createReadStream(path.join(ROOT, 'index.html')).pipe(res);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ✅ 编剧制作小组已启动');
  console.log('  ➜  本机访问: http://localhost:' + PORT);
  console.log('  ➜  部署到公网后，团队成员即可用手机打开并「添加到主屏幕」');
  console.log('');
});
