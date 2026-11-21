"""Local SQLite storage for TRACE. The database is kept beside this package."""
from __future__ import annotations

import hashlib
import os
import secrets
import sqlite3
from pathlib import Path

BASE = Path(__file__).resolve().parent
DATA_DIR = BASE / "data"
DB_PATH = DATA_DIR / "trace.sqlite3"

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    salt BLOB NOT NULL,
    pw_hash BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS location (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    ts REAL NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    ts REAL NOT NULL,
    kind TEXT NOT NULL,
    detail TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS interest (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    label TEXT NOT NULL,
    sensitive INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
"""


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)


def password_hash(password: str, salt: bytes | None = None) -> tuple[bytes, bytes]:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return salt, digest


def verify_password(password: str, salt: bytes, expected: bytes) -> bool:
    _, actual = password_hash(password, salt)
    return secrets.compare_digest(actual, expected)


def get_user(username: str):
    with connect() as conn:
        return conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()


def create_user(username: str, password: str):
    salt, digest = password_hash(password)
    with connect() as conn:
        cur = conn.execute("INSERT INTO users(username,salt,pw_hash) VALUES(?,?,?)", (username, salt, digest))
        return cur.lastrowid


def wipe_user(user_id: int) -> None:
    with connect() as conn:
        for table in ("location", "activity", "interest"):
            conn.execute(f"DELETE FROM {table} WHERE user_id=?", (user_id,))


def clear_platform(user_id: int, platform: str) -> None:
    with connect() as conn:
        for table in ("location", "activity", "interest"):
            conn.execute(f"DELETE FROM {table} WHERE user_id=? AND platform=?", (user_id, platform))
