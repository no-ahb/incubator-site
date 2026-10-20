# Gallery website

Static website with a small content editor.

## Run locally

Use Node.js 22.12 or later.

```sh
npm ci
npm run build
npm test
npm run preview
```

Open http://127.0.0.1:8003. The build writes the site to `_site/`. The content editor needs a separately configured backend.

See [build notes](docs/BUILD.md) for details.
