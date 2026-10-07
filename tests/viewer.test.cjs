const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const esbuild = require('esbuild');
const React = require('react');

test('viewer navigation never retains a previous image behind the selected photograph', async () => {
  const dom = new JSDOM('<button id="trigger">Open</button><div id="root"></div>',{url:'http://localhost/'});
  global.window = dom.window; global.document = dom.window.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLDialogElement.prototype.showModal = function(){ this.setAttribute('open',''); };
  dom.window.HTMLDialogElement.prototype.close = function(){ this.removeAttribute('open'); };
  const {createRoot} = require('react-dom/client');
  const context = vm.createContext({React,window:dom.window,document:dom.window.document,Image:dom.window.Image});
  const read = f => fs.readFileSync(path.join(__dirname,'../js',f),'utf8');
  vm.runInContext((await esbuild.transform(read('site-utils.js')+'\n'+read('components.jsx'),{loader:'jsx'})).code,context);
  const root = createRoot(document.getElementById('root'));
  const frames = ['/landscape.jpg','/portrait.jpg','/square.jpg'];
  const click = selector => React.act(() => document.querySelector(selector).dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
  try {
    await React.act(() => root.render(React.createElement(context.InstallationStrip,{frames})));
    await click('.inc-strip__btn');
    for (let step=0;step<9;step++) {
      const dialog = document.querySelector('dialog[open]');
      assert.ok(dialog);
      const images = dialog.querySelectorAll('img');
      assert.equal(images.length,1);
      assert.equal(images[0].getAttribute('src'),frames[step%frames.length]);
      assert.equal([...dialog.querySelectorAll('*')].some(el => el.style.backgroundImage.includes('url(')),false);
      await click('[aria-label="Next view"]');
    }
    await click('[aria-label="Close"]');
    assert.equal(document.querySelector('dialog'),null);
  } finally {
    await React.act(() => root.unmount()); dom.window.close();
    delete global.window;delete global.document;delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
