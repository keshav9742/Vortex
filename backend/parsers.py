"""Platform-specific parsers. They consume ZIP bytes and return the common schema."""
from __future__ import annotations

import io
import json
import re
import zipfile
from datetime import datetime, timezone

MAX_UNCOMPRESSED = 100 * 1024 * 1024


def _epoch(value) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text).astimezone(timezone.utc).timestamp()
    except ValueError:
        return 0.0


def _json(zf: zipfile.ZipFile, name: str):
    with zf.open(name) as stream:
        return json.loads(stream.read().decode("utf-8-sig"))


def _names(zf: zipfile.ZipFile) -> list[str]:
    names = zf.namelist()
    if any(".." in part or part.startswith(("/", "\\")) for name in names for part in name.replace("\\", "/").split("/")):
        raise ValueError("Unsafe file path inside archive")
    total = sum(info.file_size for info in zf.infolist())
    if total > MAX_UNCOMPRESSED:
        raise ValueError("Archive is too large to unpack safely")
    return names


def detect_platform(names: list[str]) -> str | None:
    lower = [name.lower() for name in names]
    if any("streaminghistory" in name or "streaming_history" in name for name in lower):
        return "spotify"
    if any("takeout/" in name or "my activity" in name or "records.json" in name or "location history" in name for name in lower):
        return "google"
    if any("instagram" in name for name in lower):
        return "instagram"
    if any("amazon" in name or "order history" in name for name in lower):
        return "amazon"
    if any("facebook" in name or "meta" in name for name in lower):
        return "meta"
    return None


def parse_zip(file_bytes: bytes, platform: str | None = None) -> dict:
    with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
        names = _names(zf)
        platform = platform or detect_platform(names)
        if not platform:
            raise ValueError("Could not identify a supported platform in this archive")
        if platform == "google":
            return _parse_google(zf, names)
        if platform == "spotify":
            return _parse_spotify(zf, names)
        return {"platform": platform, "locations": [], "activities": [], "interests": [], "counts": {}}


def _parse_google(zf, names):
    locations, activities, interests = [], [], []
    for name in names:
        low = name.lower()
        if not low.endswith(".json"):
            continue
        try:
            data = _json(zf, name)
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
        if isinstance(data, list) and "location" in low:
            for item in data:
                point = item.get("location", item)
                lat = point.get("latitudeE7", point.get("latitude"))
                lon = point.get("longitudeE7", point.get("longitude"))
                if lat is None or lon is None:
                    continue
                lat, lon = float(lat) / (1e7 if abs(float(lat)) > 90 else 1), float(lon) / (1e7 if abs(float(lon)) > 180 else 1)
                locations.append({"ts": _epoch(item.get("timestamp", item.get("timestampMs"))), "lat": lat, "lon": lon})
        if isinstance(data, list) and ("activity" in low or "my activity" in low or "search" in low):
            for item in data:
                title = str(item.get("title", item.get("query", "")))[:240]
                if title:
                    activities.append({"ts": _epoch(item.get("time", item.get("timestamp"))), "kind": "search", "detail": title})
        if isinstance(data, dict) and "timelineObjects" in data:
            for item in data.get("timelineObjects", []):
                place = item.get("placeVisit", {})
                loc = place.get("location", {})
                lat, lon = loc.get("latitudeE7"), loc.get("longitudeE7")
                if lat and lon:
                    locations.append({"ts": _epoch(place.get("duration", {}).get("startTimestamp")), "lat": float(lat) / 1e7, "lon": float(lon) / 1e7})
    for row in activities:
        interests.extend({"label": hit, "sensitive": int(hit in SENSITIVE_TERMS)} for hit in _terms(row["detail"]))
    return _result("google", locations, activities, interests)


SENSITIVE_TERMS = {"health", "therapy", "anxiety", "diabetes", "pregnancy", "religion", "politics", "legal", "salary", "debt"}


def _terms(text: str) -> list[str]:
    lowered = text.lower()
    return sorted({term for term in SENSITIVE_TERMS if term in lowered})


def _parse_spotify(zf, names):
    activities, interests = [], []
    for name in names:
        low = name.lower()
        if not ("streaminghistory" in low or "streaming_history" in low) or not low.endswith(".json"):
            continue
        try:
            rows = _json(zf, name)
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
        if not isinstance(rows, list):
            continue
        for item in rows:
            artist = item.get("artistName") or item.get("master_metadata_album_artist_name") or "Unknown artist"
            track = item.get("trackName") or item.get("master_metadata_track_name") or "Unknown track"
            if not item.get("msPlayed", item.get("ms_played", 0)):
                continue
            activities.append({"ts": _epoch(item.get("endTime", item.get("ts"))), "kind": "listening", "detail": f"{artist} - {track}"[:240]})
            interests.append({"label": str(artist)[:120], "sensitive": 0})
    return _result("spotify", [], activities, interests)


def _result(platform, locations, activities, interests):
    unique = {(row["label"], row["sensitive"]) for row in interests}
    return {"platform": platform, "locations": locations, "activities": activities, "interests": [{"label": x[0], "sensitive": x[1]} for x in unique], "counts": {"location": len(locations), "activity": len(activities), "interest": len(unique)}}
