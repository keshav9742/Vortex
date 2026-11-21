"""Single-command launcher for the complete TRACE local website."""
from backend.app import app
from backend.db import init_db
import os


if __name__ == "__main__":
    init_db()
    app.run(host=os.environ.get("TRACE_HOST", "127.0.0.1"), port=int(os.environ.get("PORT", "5000")), debug=False)
