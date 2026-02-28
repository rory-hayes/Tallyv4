# Frontend

Next.js app using the Catalyst UI kit as the default design system.

## Design System Rules

- Catalyst components are vendored in `src/components/catalyst`.
- UI wrappers are in `src/components/ui`.
- No additional UI component frameworks are allowed.
- `scripts/check-ui-governance.mjs` enforces dependency and import rules.

## Run

```bash
npm install
npm run dev
```

Set API target explicitly when needed:

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

Production fallback API base is currently `https://tally-api-v4-probe.onrender.com`.

## Visual Snapshot Capture

```bash
npm run test:visual
```

Snapshots are generated to `tests/visual/snapshots/`.
