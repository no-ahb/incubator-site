const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const esbuild = require('esbuild');
const React = require('react');

async function viewer(t, { reducedMotion = false } = {}) {
  const dom = new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
  global.window = dom.window; global.document = dom.window.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.matchMedia = () => ({matches:reducedMotion});
  dom.window.HTMLDialogElement.prototype.showModal = function(){ this.setAttribute('open',''); };
  dom.window.HTMLDialogElement.prototype.close = function(){ this.removeAttribute('open'); };
  const pending = [];
  class ControlledImage {
    decode() { return new Promise((resolve,reject) => pending.push({src:this.src,resolve,reject})); }
  }
  const {createRoot} = require('react-dom/client');
  const context = vm.createContext({React,window:dom.window,document:dom.window.document,Image:ControlledImage});
  const read = f => fs.readFileSync(path.join(__dirname,'../js',f),'utf8');
  vm.runInContext((await esbuild.transform(read('site-utils.js')+'\n'+read('components.jsx'),{loader:'jsx'})).code,context);
  const root = createRoot(document.getElementById('root'));
  const frames = ['/landscape.jpg','/portrait.jpg','/square.jpg','/wide.jpg'];
  const click = selector => React.act(() => document.querySelector(selector).dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
  const settle = (src, fail = false) => React.act(async () => {
    const idx = pending.findIndex(p => p.src === src);
    assert.notEqual(idx,-1,'expected a pending decode for '+src);
    const request = pending.splice(idx,1)[0];
    if (fail) request.reject(new Error('Image unavailable')); else request.resolve();
    await Promise.resolve();
  });
  const finish = () => React.act(() => {
    const incoming = document.querySelector('.inc-lightbox__slide--incoming');
    assert.ok(incoming,'a transition should be active');
    incoming.dispatchEvent(new dom.window.Event('animationend',{bubbles:true}));
  });
  t.after(async () => {
    await React.act(() => root.unmount()); dom.window.close();
    delete global.window;delete global.document;delete global.IS_REACT_ACT_ENVIRONMENT;
  });
  await React.act(() => root.render(React.createElement(context.InstallationStrip,{frames})));
  await click('.inc-strip__btn');
  return {click,settle,finish,dom,frames,pending,images:() => [...document.querySelectorAll('dialog img')],caption:() => document.querySelector('figcaption').textContent};
}

test('rapid navigation preserves the current fade, follows the latest choice, and removes the outgoing photograph', async t => {
  const v = await viewer(t);
  const first = v.images()[0];
  await v.click('[aria-label="Next view"]');
  assert.deepEqual(v.images(),[first],'keep the current photograph until the next is decoded');
  assert.equal(v.caption(),'1 / 4');
  await v.settle('/portrait.jpg');
  const incoming = document.querySelector('.inc-lightbox__slide--incoming');
  const portrait = v.images()[1];
  assert.equal(v.images().length,2);
  assert.equal(v.caption(),'2 / 4');
  for (let i=0;i<10;i++) await v.click('[aria-label="Next view"]');
  assert.equal(document.querySelector('.inc-lightbox__slide--incoming'),incoming,'rapid clicks must not restart the fade');
  assert.deepEqual(v.images(),[first,portrait]);
  assert.equal(v.pending.length,0,'do not queue a separate dissolve for every click');
  await v.finish();
  assert.deepEqual(v.images(),[portrait],'remove the outgoing image after the dissolve');
  await v.settle('/wide.jpg');
  assert.equal(v.caption(),'4 / 4','land on the latest requested index');
  await v.finish();
  assert.equal(v.images().length,1);
  assert.equal(v.images()[0].getAttribute('src'),'/wide.jpg');
  assert.equal([...document.querySelectorAll('dialog *')].some(el => el.style.backgroundImage.includes('url(')),false);
  await v.click('[aria-label="Next view"]');
  await v.settle('/landscape.jpg');
  await v.finish();
  assert.equal(v.caption(),'1 / 4','wrap around correctly');
});

test('late or failed image loads never replace the current photograph or survive closing the viewer', async t => {
  const v = await viewer(t);
  const first = v.images()[0];
  await v.click('[aria-label="Next view"]');
  await v.click('[aria-label="Next view"]');
  await v.settle('/portrait.jpg');
  assert.deepEqual(v.images(),[first],'ignore an earlier request that decoded late');
  await v.settle('/square.jpg',true);
  assert.deepEqual(v.images(),[first],'retain the photo if the requested image fails');
  assert.match(document.querySelector('[role="status"]').textContent,/could not load/);
  await v.click('[aria-label="Previous view"]');
  assert.equal(document.querySelector('[role="status"]'),null);
  await v.click('[aria-label="Close"]');
  await v.settle('/portrait.jpg');
  assert.equal(document.querySelector('dialog'),null,'decoding after close cannot reopen the viewer');
  await v.click('.inc-strip__btn');
  assert.equal(v.images().length,1);
  assert.equal(v.caption(),'1 / 4');
});

test('reduced-motion keyboard navigation waits for loading, switches without animation', async t => {
  const v = await viewer(t,{reducedMotion:true});
  const first = v.images()[0];
  await React.act(() => document.querySelector('dialog').dispatchEvent(new v.dom.window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));
  assert.deepEqual(v.images(),[first]);
  await v.settle('/wide.jpg');
  assert.equal(document.querySelector('.inc-lightbox__slide--incoming'),null);
  assert.equal(v.images().length,1);
  assert.equal(v.caption(),'4 / 4');
  await v.click('[aria-label="Close"]');
  assert.equal(document.querySelector('dialog'),null);
});
