from fastapi import APIRouter

from app.api.routers import auth, clients, exports, firms, imports, reconciliation, runs

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(firms.router, prefix="/firms", tags=["firms"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(runs.router, tags=["runs"])
api_router.include_router(imports.router, tags=["imports"])
api_router.include_router(reconciliation.router, tags=["reconciliation"])
api_router.include_router(exports.router, tags=["exports"])
