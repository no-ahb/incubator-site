const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { read, workerHarness } = require('./helpers.cjs');
const Babel = require('../js/vendor/babel-standalone-7.29.0.min.js');
const context = vm.createContext({ React: {}, window: {} });
for (const file of ['js/screens.jsx', 'js/admin.jsx']) {
  vm.runInContext(Babel.transform(read(file), { presets: ['react'] }).code, context);
}
const data = JSON.parse(read('data/shows.json'));
const shows = data.exhibitions;
const select = day => context.homeExhibition(shows, day)?.id;

test('homepage changes on the closing date and stays on the next show through the gap', () => {
  assert.equal(select('2026-09-25'), 'amelia-cross');
  for (const day of ['2026-09-26', '2026-09-27', '2026-10-07', '2026-10-08', '2026-10-31']) {
    assert.equal(select(day), 'kirubel-mandefro', day);
  }
  assert.equal(select('2026-11-01'), 'valentina-attolini');
  assert.equal(select('2026-11-04'), 'valentina-attolini');
  assert.equal(select('2026-11-30'), 'valentina-attolini');
});

test('homepage handles unordered, future-only, hidden, empty and overlapping shows', () => {
  const a = { id: 'a', startISO: '2026-09-01', endISO: '2026-09-26' };
  const b = { id: 'b', startISO: '2026-10-08', endISO: '2026-11-01' };
  const c = { id: 'c', startISO: '2026-11-05', endISO: '2026-11-29' };
  const pick = (list, day) => context.homeExhibition(list, day)?.id;
  assert.equal(pick([c, b], '2026-09-26'), 'b');
  assert.equal(pick([c, a, { ...b, hidden: true }], '2026-09-26'), 'c');
  assert.equal(pick([{ ...b, hidden: true }], '2026-09-26'), undefined);
  assert.equal(pick([], '2026-09-26'), undefined);
  assert.equal(pick([a], '2026-09-26'), 'a');
  assert.equal(pick([a], '2026-10-01'), 'a');
  assert.equal(pick([b, { ...a, endISO: '2026-10-20' }], '2026-10-09'), 'b');
});

test('London midnight and daylight-saving boundaries are independent of visitor timezone', () => {
  const cases = [
    ['2026-09-25T22:59:59Z', '2026-09-25'],
    ['2026-09-25T23:00:00Z', '2026-09-26'],
    ['2026-10-07T23:00:00Z', '2026-10-08'],
    ['2026-10-31T23:59:59Z', '2026-10-31'],
    ['2026-11-01T00:00:00Z', '2026-11-01'],
  ];
  for (const [timestamp, day] of cases) assert.equal(context.todayISO(new Date(timestamp)), day);
});

test('homepage promotion does not change the public opening and closing dates', () => {
  const kirubel = shows.find(e => e.id === 'kirubel-mandefro');
  const amelia = shows.find(e => e.id === 'amelia-cross');
  assert.equal(context.exhibitionStatus(kirubel, { today: '2026-09-26' }), 'Forthcoming');
  assert.equal(context.exhibitionStatus(kirubel, { today: '2026-10-07' }), 'Forthcoming');
  assert.equal(context.exhibitionStatus(kirubel, { today: '2026-10-08' }), 'Current exhibition');
  assert.equal(context.exhibitionStatus(amelia, { today: '2026-09-26' }), 'Current exhibition');
  assert.equal(context.exhibitionStatus(amelia, { today: '2026-09-27' }), 'Past exhibition');
  assert.equal(context.exhibitionStatus(kirubel, { today: '2026-12-01', heroFallback: true }), 'Most recent exhibition');
});

test('Amelia has both requested articles and normal body paragraphs', () => {
  const amelia = shows.find(e => e.id === 'amelia-cross');
  assert.deepEqual(amelia.press.map(it => new URL(it.href).hostname), ['www.selvedge.org', 'www.wallpaper.com']);
  assert.doesNotMatch(amelia.pressRelease, /class="attrib"|&amp;amp;/);
});

test('press save, edit, reload, remove and an older admin all preserve the intended data', async () => {
  const h = workerHarness();
  const original = structuredClone(h.data.exhibitions.find(e => e.id === 'amelia-cross'));
  const article = { pub: ' Magazine ', title: ' New article ', href: 'example.com/article' };
  const show = { ...original, press: [...original.press, article] };
  const saved = await h.save(show);
  assert.equal(saved.status, 200);
  assert.deepEqual((await saved.json()).press[2], { pub: 'Magazine', title: 'New article', href: 'https://example.com/article' });
  assert.equal(h.data.exhibitions.find(e => e.id === show.id).press.length, 3);
  const oldClient = { ...original }; delete oldClient.press;
  await h.save(oldClient);
  assert.equal(h.data.exhibitions.find(e => e.id === show.id).press.length, 3);
  show.press = [{ ...article, title: 'Edited article' }];
  await h.save(show);
  assert.equal(h.data.exhibitions.find(e => e.id === show.id).press[0].title, 'Edited article');
  await h.save({ ...show, press: [] });
  assert.deepEqual(h.data.exhibitions.find(e => e.id === show.id).press, []);
  assert.deepEqual(h.data.press, data.press);
  assert.deepEqual(h.data.exhibitions.find(e => e.id === 'kirubel-mandefro'), shows.find(e => e.id === 'kirubel-mandefro'));
});

test('invalid press and unauthenticated saves cannot write content', async () => {
  const h = workerHarness();
  const show = { id: 'test', artist: 'Test', press: [] };
  for (const href of ['javascript:alert(1)', 'data:text/html,test', 'https://', 'not a link', '']) {
    const res = await h.save({ ...show, press: [{ title: 'Test', href }] });
    assert.equal(res.status, 400, href);
    assert.equal(context.adNormalizeUrl(href), '');
  }
  assert.equal((await h.save({ ...show, press: [{ href: 'https://example.com' }] })).status, 400);
  assert.equal((await h.save({ ...show, press: 'invalid' })).status, 400);
  assert.equal((await h.save(show, 'wrong')).status, 401);
  assert.equal(h.writes, 0);
});

test('rich-text saves keep entities stable and remove executable markup and pasted sizes', () => {
  const { context: worker } = workerHarness();
  let html = '<p>A &amp; B &quot;sewn paintings&quot; &#8217; &lt;script&gt; plain & text</p>';
  const expected = html.replace('plain & text', 'plain &amp; text');
  for (let i = 0; i < 5; i++) {
    html = worker.sanitizeRichHtml(html);
    assert.equal(html, expected);
  }
  const cleaned = worker.sanitizeRichHtml('<p style="font-size:72px" onclick="alert(1)"><img src=x onerror=alert(1)><strong>Bold</strong></p>');
  assert.equal(cleaned, '<p><strong>Bold</strong></p>');
});
