"""FastAPI application factory and route definitions.

Imports config values instead of hard-coding them.
"""

from fastapi import FastAPI

from local_service.api.routes import router as api_router
from local_service.api.websocket import plugin_ws
from local_service.core.config import WS_PATH

app = FastAPI()

# Register HTTP routes
app.include_router(api_router)

# Register WebSocket endpoint
app.websocket(WS_PATH)(plugin_ws)
