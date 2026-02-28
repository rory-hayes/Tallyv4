# Tally MVP (UK + Ireland)

Trust-first payroll reconciliation and close packs with deterministic matching.

## Monorepo

- `frontend/`: Next.js + TypeScript app on Catalyst UI kit.
- `backend/`: FastAPI + SQLAlchemy API with deterministic reconciliation engine.
- `scripts/check-ui-governance.mjs`: CI guardrail to block non-approved UI frameworks.

## Product Guarantees in This Build

- Deterministic reconciliation engine only (no AI tie decisions).
- Full 40-code variance taxonomy with enforced resolution state machine.
- UK + Ireland liability timing packs (`TIME-001` / `TIME-002` behavior).
- Import pipeline with confidence gating and parse-failure blockers.
- Audit pack generation (PDF + CSV + evidence log bundle).
- Catalyst-only UI implementation with wrappers under `frontend/src/components/ui`.

## Quick Start

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Local infra (optional)

```bash
docker compose up -d
```

## CI Gates

- Backend tests: `pytest`
- UI governance: `npm run check:ui`
- Visual snapshots: `npm run test:visual` (from `frontend/`)

## Deployment Targets

- Frontend: Netlify (`netlify.toml`)
- API + worker + data services: Render (`render.yaml`)
