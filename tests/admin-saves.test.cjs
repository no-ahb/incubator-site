const test = require('node:test');
const assert = require('node:assert/strict');
const { workerHarness, read } = require('./helpers.cjs');
const initial = JSON.parse(read('data/shows.json'));

test('creating repeated untitled solo shows never overwrites an existing exhibition or biography', async () => {
  const h = workerHarness();
  const original = structuredClone(h.data);
  const show = { artist: 'Amelia Cross', title: '', startISO: '2027-03-01', endISO: '2027-03-31' };
  const ids = [];
  for (let n = 0; n < 2; n++) {
    const response = await h.save(show, undefined, n === 0 ? {} : { artistBio: '' });
    assert.equal(response.status, 200);
    ids.push((await response.json()).id);
  }
  assert.equal(new Set(ids).size, 2);
  assert.equal(h.data.exhibitions.length, original.exhibitions.length + 2);
  for (const ex of original.exhibitions) assert.deepEqual(h.data.exhibitions.find(e => e.id === ex.id), ex);
  assert.deepEqual(h.data.artists, original.artists);
});

test('new group shows avoid hidden and archived IDs, and edits keep their original ID', async () => {
  const data = structuredClone(initial);
  data.exhibitions.push({ id: 'test-group', isGroup: true, title: 'Test Group', hidden: true });
  data.archive.push({ id: 'test-group-2', title: 'Test Group', isGroup: true });
  const h = workerHarness(data);
  const group = { title: 'Test Group', isGroup: true, groupArtists: ['Amelia Cross'] };
  const response = await h.save(group);
  assert.equal(response.status, 200);
  const { id } = await response.json();
  assert.equal(id, 'test-group-3');
  assert.equal((await h.save({ ...group, id, title: 'Renamed Group' })).status, 200);
  assert.equal(h.data.exhibitions.filter(e => e.id === id).length, 1);
  assert.equal(h.data.exhibitions.find(e => e.id === id).title, 'Renamed Group');
  assert.deepEqual(h.data.archive, data.archive);
  assert.equal(h.data.exhibitions.find(e => e.id === 'test-group').hidden, true);
});

test('concurrent create retries select a fresh ID without overwriting the intervening save', async () => {
  const other = { id: 'amelia-cross-2', artist: 'Amelia Cross', title: 'Another editor saved this' };
  const h = workerHarness(initial, { conflictOnce: data => data.exhibitions.push(other) });
  const response = await h.save({ artist: 'Amelia Cross', title: '' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).id, 'amelia-cross-3');
  assert.deepEqual(h.data.exhibitions.find(e => e.id === other.id), other);
});

test('an edit of a missing show cannot silently create or resurrect it', async () => {
  const h = workerHarness();
  const response = await h.save({ id: 'no-longer-exists', artist: 'Amelia Cross', title: 'New' });
  assert.equal(response.status, 404);
  assert.equal(h.writes, 0);
});

test('explicitly clearing hero and biography persists; omitted fields preserve content', async () => {
  const h = workerHarness();
  const original = structuredClone(h.data.exhibitions.find(e => e.id === 'amelia-cross'));
  const originalBio = structuredClone(h.data.artists.find(a => a.id === original.artistId).bio);
  const omitted = { ...original }; delete omitted.heroImage;
  assert.equal((await h.save(omitted)).status, 200);
  assert.equal(h.data.exhibitions.find(e => e.id === original.id).heroImage, original.heroImage);
  assert.deepEqual(h.data.artists.find(a => a.id === original.artistId).bio, originalBio);
  const cleared = await h.save({ ...original, heroImage: '' }, undefined, { artistBio: '<p><br></p>' });
  assert.equal(cleared.status, 200);
  assert.equal((await cleared.json()).artistBio, '');
  assert.equal(h.data.exhibitions.find(e => e.id === original.id).heroImage, undefined);
  assert.equal(h.data.artists.find(a => a.id === original.artistId).bio, '');
  assert.equal((await h.save(omitted)).status, 200);
  assert.equal(h.data.exhibitions.find(e => e.id === original.id).heroImage, undefined);
  assert.equal(h.data.artists.find(a => a.id === original.artistId).bio, '');
});
