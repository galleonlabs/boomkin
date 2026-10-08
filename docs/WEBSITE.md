# Website delivery

The public website is [galleonlabs.github.io/boomkin](https://galleonlabs.github.io/boomkin/). GitHub Pages deploys a static build from the exact `main` commit through `.github/workflows/pages.yml`. The build runs the core checks, renders source-backed documentation and validates local links, workflow pack membership and the vendored strategy source pin.

```bash
bun run build:site
bun run check:site
bun run serve:site
```

The local preview serves `http://127.0.0.1:4177/boomkin/`. Override `SITE_PORT` if needed. `SITE_BASE` and `SITE_ORIGIN` support a different static host; use them consistently for build, check and serve.

Source files live in `site/`. The build generates `site-dist/`, which stays out of Git. The workflow catalog comes from the same reviewed catalog as the CLI. Documentation renders repository Markdown, including the setup reference and agent index; the website's setup, strategy and evidence guides live under `site/docs/`.

The browser lab uses the strategy pack's pure ESM engine with its MIT notice. `site/vendor/provenance.json` pins the package version, reviewed source commit and every copied resource hash. Update it only after a tested strategy source release. The build rejects resource drift.

The bundled Bitcoin series is a dated public CoinGecko capture, not a current feed or execution quote. It includes asset/source identity, retrieval time, the original response hash, sampling limitations and the excluded trailing observation. The synthetic series is labeled separately. Uploaded data never leaves the browser. The lab makes only same-origin static resource requests.

Verify a deployment with the Pages action's successful result, then read `release.json` at the public URL and compare its revision with the intended commit. Inspect homepage, docs and lab on desktop and mobile, exercise workflow search and simulation controls, and check browser errors. A successful build alone does not establish delivery.
