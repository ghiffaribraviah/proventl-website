# ProVenTL Web App

## Local Development

Start the backend and web app together through Docker Compose:

```bash
make web-docker
```

For split local development, start the backend and web app separately:

```bash
make api-dev
make web-dev
```

The Vite dev server proxies `/api/...` calls to the backend. In Compose this is configured with `VITE_API_PROXY_TARGET=http://api:8000`; locally it defaults to `http://localhost:8000`.

## Verification

```bash
make web-test
make web-typecheck
make web-build
make web-smoke
```

`make web-smoke` runs Playwright against the real backend/model path where practical. The smoke tests use curated target `P01133`, so they do not depend on live UniProt lookup.
