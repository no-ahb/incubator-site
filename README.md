# Incubator

Website and custom CMS for [Incubator](https://www.incubatorart.com), a contemporary art gallery in London. I redesigned and built the site, including the tools the gallery uses to keep its programme current.

The public site brings together exhibitions, artists and press. The CMS lets the team edit content and upload images without working in the code.

## How it works

The site uses React and JavaScript, with content stored in JSON. A Node build produces static pages for exhibitions and artists, along with responsive images. The admin backend runs on Cloudflare Workers; content changes are saved to GitHub and trigger a rebuild on GitHub Pages.

I wanted the site to give the artwork room, while making a growing archive easy to browse and straightforward for the gallery to maintain.

## Run locally

Use Node.js 22.12 or later.

```sh
npm ci
npm run build
npm test
npm run preview
```

Open http://127.0.0.1:8003. The build writes the public site to `_site/`. Editing through the CMS requires the separately configured admin backend.

See [build notes](docs/BUILD.md) for more detail.

Built by [Noah Berrie](https://portfolio.noahberrie.com).
