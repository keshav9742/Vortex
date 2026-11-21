"""TRACE local server. Run with: python backend/app.py"""
from __future__ import annotations

import json
import os
from functools import wraps
from pathlib import Path

from flask import Flask, abort, redirect, render_template_string, request, session, url_for, Response

from db import connect, create_user, get_user, init_db, verify_password, wipe_user, clear_platform
from infer import infer_records
from parsers import detect_platform, parse_zip
from scoring import build_findings, markdown_report

BASE = Path(__file__).resolve().parent
KB = json.loads((BASE / "kb.json").read_text(encoding="utf-8"))
app = Flask(__name__)
app.secret_key = os.environ.get("TRACE_SECRET", "local-dev-secret-change-me")
app.config.update(MAX_CONTENT_LENGTH=105 * 1024 * 1024, SESSION_COOKIE_SAMESITE="Strict", SESSION_COOKIE_HTTPONLY=True)

BASE_HTML = """<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>TRACE</title><style>body{font:15px system-ui;background:#f5f7fb;color:#101827;max-width:960px;margin:0 auto;padding:30px}a,button{background:#285ce3;color:white;padding:9px 13px;border-radius:5px;text-decoration:none;border:0;cursor:pointer}input,select{padding:9px;border:1px solid #cbd4e3;border-radius:4px}table{width:100%;background:white;border-collapse:collapse;margin:18px 0}td,th{padding:10px;border:1px solid #dde3ed;text-align:left}.card{background:white;border:1px solid #dde3ed;border-radius:8px;padding:18px;margin:14px 0}.critical{color:#c02719}.high{color:#b45309}.medium{color:#6b4c00}.muted{color:#68758a}.steps li{margin:7px 0}.danger{background:#b42318}</style></head><body><b>TRACE · local-first data exposure mapper</b> | <a href='{{ url_for('choose') }}'>Choose source</a> <a href='{{ url_for('results') }}'>Results</a>{% if session.get('uid') %} <a href='{{ url_for('logout') }}'>Log out</a>{% endif %}<hr>{{ body|safe }}</body></html>"""


def page(body: str, **context):
    return render_template_string(BASE_HTML, body=render_template_string(body, **context), **context)


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("uid"):
            return redirect(url_for("login"))
        return fn(*args, **kwargs)
    return wrapper


@app.after_request
def security_headers(response):
    response.headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.before_request
def local_only():
    if request.host.split(":")[0] not in {"127.0.0.1", "localhost"}:
        abort(400)


@app.route("/", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()[:64]
        password = request.form.get("passphrase", "")
        action = request.form.get("action")
        user = get_user(username) if username else None
        if action == "create" and len(password) >= 8 and not user:
            session["uid"] = create_user(username, password)
            return redirect(url_for("choose"))
        if action == "login" and user and verify_password(password, user["salt"], user["pw_hash"]):
            session["uid"] = user["id"]
            return redirect(url_for("choose"))
        error = "Use a new username with an 8+ character passphrase, or check your existing login."
    return page("""<div class='card'><h1>Local profile</h1><p class='muted'>No cloud account. This passphrase only gates this computer.</p>{% if error %}<p class='critical'>{{ error }}</p>{% endif %}<form method='post'><p><input name='username' placeholder='Username' required></p><p><input type='password' name='passphrase' placeholder='Passphrase (8+ characters)' required></p><button name='action' value='login'>Log in</button> <button name='action' value='create'>Create profile</button></form></div>""", error=error)


@app.route("/logout")
def logout():
    session.clear(); return redirect(url_for("login"))


@app.route("/choose")
@login_required
def choose():
    return page("""<div class='card'><h1>Choose an export</h1><p class='muted'>Start with Google or Spotify. The guide tells you exactly where to request the file.</p>{% for key,spec in kb.platforms.items() %}<div class='card'><h2>{{ spec.label }}</h2><ol class='steps'>{% for step in spec.get('export_guide', ['Request the platform export and download it as a ZIP.']) %}<li>{{ step }}</li>{% endfor %}</ol><a href='{{ url_for('guide', key=key) }}'>Open guide</a></div>{% endfor %}</div>""", kb=KB)


@app.route("/guide/<key>")
@login_required
def guide(key):
    if key not in KB["platforms"]: abort(404)
    return page("""<div class='card'><h1>{{ spec.label }} guide</h1><ol class='steps'>{% for step in spec.get('export_guide', []) %}<li>{{ step }}</li>{% endfor %}</ol><form action='{{ url_for('upload', key=key) }}' method='post' enctype='multipart/form-data'><input type='file' name='archive' accept='.zip' required><button>Analyze locally</button></form><p class='muted'>The archive is read on this machine and is not sent anywhere.</p></div>""", spec=KB["platforms"][key])


@app.route("/upload/<key>", methods=["POST"])
@login_required
def upload(key):
    if key not in KB["platforms"]: abort(404)
    uploaded = request.files.get("archive")
    if not uploaded or not uploaded.filename.lower().endswith(".zip"):
        return page("<div class='card'><p class='critical'>Please choose a ZIP export.</p></div>"), 400
    try:
        parsed = parse_zip(uploaded.read(), key)
    except ValueError as exc:
        return page("<div class='card'><p class='critical'>{{ error }}</p><a href='{{ url_for('choose') }}'>Back</a></div>", error=str(exc)), 400
    uid = session["uid"]
    clear_platform(uid, key)
    with connect() as conn:
        for row in parsed["locations"]:
            conn.execute("INSERT INTO location(user_id,platform,ts,lat,lon) VALUES(?,?,?,?,?)", (uid, key, row["ts"], row["lat"], row["lon"]))
        for row in parsed["activities"]:
            conn.execute("INSERT INTO activity(user_id,platform,ts,kind,detail) VALUES(?,?,?,?,?)", (uid, key, row["ts"], row["kind"], row["detail"]))
        for row in parsed["interests"]:
            conn.execute("INSERT INTO interest(user_id,platform,label,sensitive) VALUES(?,?,?,?)", (uid, key, row["label"], row["sensitive"]))
    session["last_platform"] = key
    return redirect(url_for("results"))


@app.route("/results")
@login_required
def results():
    all_findings = current_findings(session["uid"])
    return page("""<div class='card'><h1>Exposure report</h1><p class='muted'>Every record below came from your local export. Policy guidance is separate from evidence.</p>{% for item in findings %}<div class='card'><h2>{{ item.platform.title() }} · {{ item.label }} <span class='{{ item.bucket.lower() }}'>{{ item.bucket }}</span></h2><p><b>Score {{ item.priority }}</b> · {{ item.count }} records · about {{ item.minutes }} min to fix</p><p>{{ item.why }}</p><small>S={{ item.sensitivity }} · V={{ item.volume }} · I={{ item.inferability }} · Sharing={{ item.sharing }} · Effort={{ item.effort }}</small><ol>{% for step in item.steps %}<li>{{ step }}</li>{% endfor %}</ol></div>{% else %}<p>No parsed data yet.</p>{% endfor %}<p><a href='{{ url_for('report') }}'>Download Markdown report</a></p><form method='post' action='{{ url_for('wipe') }}'><button class='danger'>Wipe local data</button></form></div>""", findings=all_findings)


def current_findings(uid: int) -> list[dict]:
    all_findings = []
    with connect() as conn:
        platforms = [row[0] for row in conn.execute("SELECT DISTINCT platform FROM activity WHERE user_id=? UNION SELECT DISTINCT platform FROM location WHERE user_id=?", (uid, uid)).fetchall()]
        for platform in platforms:
            locations = [dict(r) for r in conn.execute("SELECT ts,lat,lon FROM location WHERE user_id=? AND platform=?", (uid, platform))]
            activities = [dict(r) for r in conn.execute("SELECT ts,kind,detail FROM activity WHERE user_id=? AND platform=?", (uid, platform))]
            interests = [dict(r) for r in conn.execute("SELECT label,sensitive FROM interest WHERE user_id=? AND platform=?", (uid, platform))]
            data = {"platform": platform, "locations": locations, "activities": activities, "interests": interests, "counts": {"location": len(locations), "activity": len(activities), "interest": len(interests)}}
            all_findings.extend(build_findings(data, KB, infer_records(data)))
    all_findings.sort(key=lambda row: row["priority"], reverse=True)
    return all_findings


@app.route("/report.md")
@login_required
def report():
    report_text = markdown_report(current_findings(session["uid"]))
    return Response(report_text, mimetype="text/markdown", headers={"Content-Disposition": "attachment; filename=trace_report.md"})


@app.route("/wipe", methods=["POST"])
@login_required
def wipe():
    wipe_user(session["uid"]); return redirect(url_for("choose"))


if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=8765, debug=False)
