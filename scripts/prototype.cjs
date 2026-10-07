// Local-only review of the two UX ideas awaiting approval. Never copied to _site.
const fs = require('node:fs/promises');
const path = require('node:path');
const {JSDOM} = require('jsdom');
async function main() {
  const target = path.resolve('.cache/ux-preview');
  await fs.mkdir(target,{recursive:true});
  for (const dir of ['assets','css','images']) {
    try { await fs.symlink(path.resolve('_site',dir),path.join(target,dir),'dir'); } catch(e) {if(e.code !== 'EEXIST') throw e;}
  }
  const data = JSON.parse(await fs.readFile('data/shows.json','utf8'));
  const c = data.contact;
  const dom = new JSDOM(await fs.readFile('_site/index.html','utf8'));
  const doc = dom.window.document;
  doc.querySelectorAll('script').forEach(s => s.remove());
  doc.querySelector('meta[name=robots]').content = 'noindex, nofollow';
  doc.title = 'Preview: visitor information and direct signup — Incubator';
  const badge = doc.createElement('div');
  badge.className = 'prototype-badge'; badge.textContent = 'Preview only · Visitor information and direct signup';
  doc.body.prepend(badge);
  const meta = doc.querySelector('.inc-hero__meta');
  const detail = doc.createElement('div');
  while(meta.firstChild) detail.append(meta.firstChild);
  meta.append(detail);
  const visit = doc.createElement('aside'); visit.className = 'prototype-visit'; visit.setAttribute('aria-label','Plan your visit');
  const heading = doc.createElement('h2'); heading.textContent = 'Plan your visit'; visit.append(heading);
  for(const text of [c.addressLines.join(', '), ...c.hours]) {const p=doc.createElement('p');p.textContent=text;visit.append(p);}
  const directions=doc.createElement('a'); directions.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(c.mapQuery); directions.textContent='Directions ↗'; directions.target='_blank';directions.rel='noopener';visit.append(directions);
  const appointment=doc.createElement('a');appointment.href='mailto:'+c.enquiriesEmail+'?subject=Gallery%20visit';appointment.textContent='Arrange an appointment →';visit.append(appointment);
  meta.append(visit);
  for(const a of doc.querySelectorAll('a')) {
    if (a.textContent === 'Subscribe to mailing list') {a.href=c.mailingListUrl;a.target='_blank';a.rel='noopener';}
    else if(a.getAttribute('href')?.startsWith('/')) a.href='http://127.0.0.1:8003'+a.getAttribute('href');
  }
  const styles=doc.createElement('style');styles.textContent=`
    .prototype-badge{background:#e9eee6;padding:10px 24px;text-align:center;font:12px/1.4 sans-serif;color:#355b32}
    .inc-hero__meta{display:grid;grid-template-columns:1.5fr 1fr;gap:48px}
    .prototype-visit{border-left:1px solid var(--hairline);padding-left:32px}
    .prototype-visit h2{font-size:18px;font-weight:400;margin:0 0 14px;color:var(--green)}
    .prototype-visit p{font-size:13px;line-height:1.6;margin:0 0 4px}
    .prototype-visit a{display:inline-block;font-size:13px;margin:14px 20px 0 0}
    @media(max-width:700px){.inc-hero__meta{grid-template-columns:1fr;gap:24px}.prototype-visit{border-left:0;border-top:1px solid var(--hairline);padding:24px 0 0}}
  `;doc.head.append(styles);
  const menu=doc.createElement('script');menu.textContent=`document.querySelector('.inc-menu-btn').addEventListener('click',function(){const open=this.getAttribute('aria-expanded')!=='true';this.setAttribute('aria-expanded',String(open));this.classList.toggle('is-open',open);const panel=document.querySelector('.inc-overlay');panel.classList.toggle('is-open',open);panel.setAttribute('aria-hidden',String(!open));});`;doc.body.append(menu);
  const artistNav = doc.createElement('li'); artistNav.innerHTML = '<a href="/artists/">Artists</a>'; doc.querySelector('.inc-header__nav ul').children[0].after(artistNav);
  await fs.mkdir(path.join(target,'artists'),{recursive:true});
  await fs.copyFile('prototypes/artists.html',path.join(target,'artists/index.html'));
  await fs.writeFile(path.join(target,'index.html'),dom.serialize());
  dom.window.close();
  console.log('Prototype generated in .cache/ux-preview (not published).');
}
main().catch(e=>{console.error(e);process.exitCode=1});
