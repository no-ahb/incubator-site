const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const {publicRoutes, publicArtists, pageMetadata, pagePath} = require('../js/site-utils.js');
const data = require('../data/shows.json');
const root = path.join(__dirname,'../_site');

test('every public URL has meaningful HTML, unique metadata, valid local links and images', () => {
  assert.ok(fs.existsSync(path.join(root,'build-info.json')), 'Run npm run build before npm test');
  for (const route of publicRoutes(data)) {
    const dom = new JSDOM(fs.readFileSync(path.join(root,route,'index.html'),'utf8'));
    const doc = dom.window.document;
    assert.ok(doc.querySelector('main'),route);
    assert.ok(doc.querySelector('h1'),route);
    assert.ok(doc.querySelector('main').textContent.length > 50,route);
    assert.equal(doc.querySelector('link[rel=canonical]').href,'https://www.incubatorart.com' + pagePath(route));
    assert.equal(doc.title,pageMetadata(route,data).title);
    assert.equal(doc.querySelector('meta[name=robots]').content,'index, follow');
    assert.doesNotMatch(doc.documentElement.outerHTML,/text\/babel|babel-standalone/);
    const schema = JSON.parse(doc.querySelector('#site-schema').textContent);
    assert.equal(schema['@graph'][0]['@type'],'ArtGallery');
    for (const element of doc.querySelectorAll('[src],a[href],link[href]')) {
      const ref = element.getAttribute('src') || element.getAttribute('href');
      assert.ok(!ref.startsWith('#/'),`${route}: old internal hash route ${ref}`);
      if (ref.startsWith('/')) {
        const target = path.join(root,ref.split(/[?#]/)[0]);
        assert.ok(fs.existsSync(target),`${route}: missing local asset or page ${ref}`);
      }
    }
    dom.window.close();
  }
});
test('sitemap includes only public, resolvable pages and excludes admin', () => {
  const sitemap = new JSDOM(fs.readFileSync(path.join(root,'sitemap.xml'),'utf8'),{contentType:'application/xml'});
  const urls = [...sitemap.window.document.querySelectorAll('loc')].map(n => n.textContent);
  assert.equal(urls.length,new Set(urls).size);
  assert.deepEqual(urls,publicRoutes(data).map(r => 'https://www.incubatorart.com' + pagePath(r)));
  assert.ok(!urls.some(u => u.includes('/admin')));
  for (const file of ['404.html','admin/index.html']) assert.match(fs.readFileSync(path.join(root,file),'utf8'),/noindex, follow/);
  sitemap.window.close();
});
test('hidden exhibitions and artists without public exhibitions are excluded', () => {
  const fixture = {exhibitions:[{id:'hidden',artistId:'a',hidden:true},{id:'visible',artistId:'b',startISO:'2026-01-01'}],artists:[{id:'a',name:'Hidden Artist'},{id:'b',name:'Visible Artist'},{id:'c',name:'Unshown Artist'}]};
  assert.deepEqual(publicArtists(fixture).map(a => a.id),['b']);
  assert.ok(!publicRoutes(fixture).includes('/exhibitions/hidden'));
  assert.equal(pageMetadata('/exhibitions/hidden',fixture).noindex,true);
  assert.equal(pageMetadata('/artists/a',fixture).noindex,true);
});
test('exhibition schema preserves actual dates and unique artist/exhibition identities', () => {
  const ex = data.exhibitions.find(e => e.id === 'amelia-cross');
  const event = pageMetadata('/exhibitions/amelia-cross',data).jsonld['@graph'][1];
  assert.equal(event.startDate,ex.startISO);
  assert.equal(event.endDate,ex.endISO);
  assert.equal(event['@type'],'ExhibitionEvent');
  assert.equal(pageMetadata('/artists/amelia-cross',data).jsonld['@graph'][1]['@type'],'Person');
});
