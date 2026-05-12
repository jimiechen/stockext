"""FastAPI service entry point.

Runs uvicorn with HOST and PORT from config.
Explicitly binds to 127.0.0.1 (never 0.0.0.0).
"""

import uvicorn

from local_service.core.config import HOST, PORT

if __name__ == "__main__":
    uvicorn.run(
        "local_service.app:app",
        host=HOST,
        port=PORT,
        reload=False,
    )
