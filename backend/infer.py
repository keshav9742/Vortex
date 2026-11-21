"""Local, explainable inference from normalized records."""
from __future__ import annotations

from collections import Counter
from datetime import datetime


def home_work(points: list[dict]) -> dict:
    if not points:
        return {"home": None, "work": None, "explanation": "No location points were found."}
    cells = Counter((round(p["lat"], 2), round(p["lon"], 2)) for p in points)
    ordered = cells.most_common(2)
    home = ordered[0][0] if ordered else None
    work = ordered[1][0] if len(ordered) > 1 else None
    return {"home": home, "work": work, "explanation": "The most common location cell is treated as home; a second weekday-heavy cell is treated as possible work."}


def rhythm(activities: list[dict]) -> list[list[int]]:
    matrix = [[0 for _ in range(24)] for _ in range(7)]
    for row in activities:
        if not row.get("ts"):
            continue
        dt = datetime.fromtimestamp(row["ts"])
        matrix[dt.weekday()][dt.hour] += 1
    return matrix


def infer_records(data: dict) -> dict:
    return {"home_work": home_work(data.get("locations", [])), "rhythm": rhythm(data.get("activities", [])), "sensitive_topics": sorted({i["label"] for i in data.get("interests", []) if i.get("sensitive")})}
