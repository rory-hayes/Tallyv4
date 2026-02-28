# Backend

FastAPI service for deterministic payroll reconciliation.

## Core Modules

- `app/api/routers/`: Auth, firms, clients, runs, imports, reconciliation, exports.
- `app/services/reconciliation_engine.py`: deterministic tie-out logic.
- `app/services/variance_taxonomy.py`: full 40-code variance catalog.
- `app/services/import_service.py`: schema detection, mapping, transformations, validation, canonical persistence.
- `app/services/export_service.py`: reproducible audit pack export.

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

## API Prefix

All routes are under `/v1`.

## Tests

```bash
pytest -q
```

## Notes

- Database tables are auto-created on startup for MVP bootstrap.
- Storage defaults to local filesystem (`./data/storage`) and can be switched to S3.
