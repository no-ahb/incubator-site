const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(process.argv[2] || '_site');
const port = Number(process.env.PORT || 8003);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.xml':'application/xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://localhost');
    let file = path.resolve(root,'.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep) && file !== root) {res.writeHead(403).end(); return;}
    let status = 200;
    try { if ((await fs.stat(file)).isDirectory()) file = path.join(file,'index.html'); await fs.access(file); }
    catch { file = path.join(root,'404.html'); status = 404; }
    const body = await fs.readFile(file);
    res.writeHead(status,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'});
    res.end(body);
  } catch { res.writeHead(500).end('Preview error'); }
}).listen(port,'127.0.0.1',() => console.log(`Preview http://127.0.0.1:${port}`));
