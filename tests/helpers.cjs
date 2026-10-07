const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// The production Worker runs unchanged apart from its Cloudflare-only import.
// Its GitHub fetches use an in-memory repository: tests cannot write to GitHub.
function workerHarness(initial = JSON.parse(read('data/shows.json')), { conflictOnce } = {}) {
  let data = structuredClone(initial), writes = 0;
  const context = vm.createContext({
    Request, Response, Headers, URL, TextEncoder, TextDecoder, atob, btoa, console,
    fetch: async (url, init) => {
      if (!url.startsWith('https://api.github.com/repos/test/site')) throw new Error('Unexpected URL: ' + url);
      if (!url.includes('/contents/')) return Response.json({});
      if (init.method === 'PUT') {
        if (conflictOnce) {
          conflictOnce(data);
          conflictOnce = null;
          return new Response('Concurrent update', { status: 409 });
        }
        data = JSON.parse(Buffer.from(JSON.parse(init.body).content, 'base64').toString());
        writes++;
        return Response.json({});
      }
      return Response.json({ sha: String(writes), content: Buffer.from(JSON.stringify(data)).toString('base64') });
    },
  });
  vm.runInContext(read('worker/worker.js').replace('import { EmailMessage } from "cloudflare:email";', '')
    .replace('export default {', 'this.worker = {'), context);
  const env = { ADMIN_PASSWORD: 'local-test', GITHUB_TOKEN: 'test-only', REPO: 'test/site', ALLOWED_ORIGINS: 'http://127.0.0.1:8001' };
  return { context, env, get data() { return data; }, get writes() { return writes; },
    fetch: request => context.worker.fetch(request, env),
    save: (show, password = env.ADMIN_PASSWORD, fields = {}) => context.worker.fetch(new Request('http://127.0.0.1:8001/admin/save-show', {
      method: 'POST', headers: { Origin: env.ALLOWED_ORIGINS, 'X-Admin-Password': password, 'Content-Type': 'application/json' },
      body: JSON.stringify({ show, ...fields }),
    }), env),
  };
}
module.exports = { root, read, workerHarness };
