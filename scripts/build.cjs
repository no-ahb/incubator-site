const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const esbuild = require('esbuild');
const sharp = require('sharp');
const { JSDOM } = require('jsdom');
const React = require('react');
const { renderToString } = require('react-dom/server');
const { publicRoutes, pageMetadata, pagePath } = require('../js/site-utils.js');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '_site');
const hash = value => crypto.createHash('sha256').update(value).digest('hex').slice(0,16);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');

async function build() {
  await fs.rm(out, { recursive:true, force:true });
  await fs.mkdir(path.join(out, 'build'), { recursive:true });
  const raw = JSON.parse(await fs.readFile(path.join(root,'data/shows.json'),'utf8'));
  const data = {...raw, exhibitions:(raw.exhibitions || []).filter(e => !e.hidden), archive:(raw.archive || []).filter(e => !e.hidden)};
  // Publish only the website, never development tools, tests or Worker source.
  for (const item of ['assets','css','data','favicon.ico','favicon.svg','apple-touch-icon.png','icon-192.png','icon-512.png','CNAME','_headers']) {
    await fs.cp(path.join(root,item), path.join(out,item), {recursive:true});
  }
  const manifest = JSON.parse(await fs.readFile(path.join(root,'site.webmanifest'),'utf8'));
  manifest.start_url = '/'; manifest.icons.forEach(i => {i.src = '/' + i.src.replace(/^\//,'');});
  await fs.writeFile(path.join(out,'site.webmanifest'),json(manifest));
  await fs.writeFile(path.join(out,'.nojekyll'),'');

  // Content-addressed responsive WebP variants, cached across content rebuilds.
  const refs = new Set();
  function collect(value) {
    if (typeof value === 'string' && /^assets\/.*\.(jpe?g|png|webp)$/i.test(value)) refs.add(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  }
  collect(data);
  const images = {};
  await fs.mkdir(path.join(root,'.cache/images'),{recursive:true});
  await fs.mkdir(path.join(out,'images'),{recursive:true});
  for (const ref of refs) {
    const full = path.resolve(root,ref);
    if (!full.startsWith(path.join(root,'assets') + path.sep)) throw new Error('Invalid image path: ' + ref);
    const input = await fs.readFile(full);
    const meta = await sharp(input).metadata();
    const originalWidth = meta.autoOrient?.width || meta.width;
    const widths = [...new Set([320,640,960,1600,Math.min(originalWidth,1600)].filter(w => w <= originalWidth))].sort((a,b)=>a-b);
    images[ref] = [];
    for (const width of widths) {
      const name = hash(Buffer.concat([input,Buffer.from(`webp-82-${width}-${sharp.versions.sharp}`)])) + '.webp';
      const cached = path.join(root,'.cache/images',name);
      try { await fs.access(cached); } catch {
        await sharp(input).rotate().resize({width,withoutEnlargement:true}).webp({quality:82}).toFile(cached);
      }
      await fs.copyFile(cached,path.join(out,'images',name));
      images[ref].push({width,url:'/images/' + name});
    }
  }
  const renderDate = new Date().toISOString();
  const boot = `window.__SITE_DATA__=${json(data)};window.__IMAGE_MANIFEST__=${json(images)};window.__RENDER_DATE__=${json(renderDate)};window.REPORT_ISSUE_ENDPOINT="https://incubator-report-issue.noahberrie7.workers.dev";`;
  const bootFile = `content-${hash(boot)}.js`;
  await fs.writeFile(path.join(out,'build',bootFile),boot);
  const files = ['site-utils.js','data.jsx','components.jsx','screens.jsx','admin.jsx','app.jsx'];
  const source = (await Promise.all(files.map(f => fs.readFile(path.join(root,'js',f),'utf8')))).join('\n');
  const browserSource = `import React from 'react'; import * as ReactClient from 'react-dom/client'; import {flushSync} from 'react-dom'; const ReactDOM={...ReactClient,flushSync};\n` + source;
  const compiled = await esbuild.build({stdin:{contents:browserSource,loader:'jsx',resolveDir:root},bundle:true,minify:true,write:false,format:'iife',target:['es2020'],define:{'process.env.NODE_ENV':'"production"'}});
  const code = compiled.outputFiles[0].contents;
  const appFile = `app-${hash(code)}.js`;
  await fs.writeFile(path.join(out,'build',appFile),code);
  const serverCode = await esbuild.transform(source,{loader:'jsx',target:'node22'});
  const dom = new JSDOM('<!doctype html><html><body></body></html>',{url:'https://www.incubatorart.com/'});
  Object.assign(dom.window,{__SERVER_RENDER__:true,__SITE_DATA__:data,__IMAGE_MANIFEST__:images,__RENDER_DATE__:renderDate,REPORT_ISSUE_ENDPOINT:'https://incubator-report-issue.noahberrie7.workers.dev'});
  const context = vm.createContext({window:dom.window,document:dom.window.document,DOMParser:dom.window.DOMParser,navigator:dom.window.navigator,sessionStorage:dom.window.sessionStorage,URL,URLSearchParams,React:{...React,useLayoutEffect:React.useEffect},ReactDOM:{},console});
  vm.runInContext(serverCode.code,context);
  const template = await fs.readFile(path.join(root,'index.html'),'utf8');
  const routes = [...new Set(publicRoutes(data))];
  for (const route of [...routes,'/admin','/404']) {
    dom.reconfigure({url:'https://www.incubatorart.com' + pagePath(route)});
    const meta = pageMetadata(route,data);
    const html = renderToString(dom.window.renderSite());
    const head = `<title>${escape(meta.title)}</title>
<meta name="description" content="${escape(meta.description)}">
<link rel="canonical" href="${escape(meta.url)}">
<meta name="robots" content="${meta.noindex ? 'noindex, follow' : 'index, follow'}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Incubator">
<meta property="og:title" content="${escape(meta.title)}"><meta property="og:description" content="${escape(meta.description)}">
<meta property="og:url" content="${escape(meta.url)}"><meta property="og:image" content="${escape(meta.image)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(meta.title)}">
<meta name="twitter:description" content="${escape(meta.description)}"><meta name="twitter:image" content="${escape(meta.image)}">
<script id="site-schema" type="application/ld+json">${json(meta.jsonld)}</script>`;
    const result = template.replace('<!-- PAGE_HEAD -->',head).replace('<!-- PAGE_CONTENT -->',html)
      .replace('<!-- PAGE_SCRIPTS -->',`<script defer src="/build/${bootFile}"></script><script defer src="/build/${appFile}"></script>`);
    const destination = route === '/404' ? path.join(out,'404.html') : path.join(out,route,'index.html');
    await fs.mkdir(path.dirname(destination),{recursive:true});
    await fs.writeFile(destination,result);
  }
  await fs.writeFile(path.join(out,'artists/index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, follow"><meta http-equiv="refresh" content="0;url=/"><title>Incubator</title><link rel="canonical" href="https://www.incubatorart.com/"></head><body><a href="/">Continue to Incubator</a></body></html>');
  await fs.writeFile(path.join(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + routes.map(r => `  <url><loc>https://www.incubatorart.com${escape(pagePath(r))}</loc></url>`).join('\n') + '\n</urlset>\n');
  await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nAllow: /\n\nSitemap: https://www.incubatorart.com/sitemap.xml\n');
  await fs.writeFile(path.join(out,'build-info.json'),json({builtAt:renderDate,routes:routes.length,images:refs.size,appBytes:code.length}));
  console.log(`Built ${routes.length} public pages, ${refs.size} responsive images; app ${Math.round(code.length/1024)} KB.`);
  dom.window.close();
}
build().catch(error => { console.error(error); process.exitCode = 1; });
