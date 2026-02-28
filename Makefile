.PHONY: backend frontend test-backend check-ui

backend:
	cd backend && uvicorn app.main:app --reload

frontend:
	cd frontend && npm run dev

test-backend:
	cd backend && pytest -q

check-ui:
	npm run check:ui
