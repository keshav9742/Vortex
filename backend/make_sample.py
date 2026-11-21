"""Create deterministic fake exports for demos without using real personal data."""
from __future__ import annotations

import json
import random
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent / "sample_data"
HOME, WORK = (28.4595, 77.0266), (28.5450, 77.1926)


def make_google():
    random.seed(7)
    locations, activity = [], []
    start = datetime.now(timezone.utc) - timedelta(days=60)
    for day in range(60):
        for hour in range(24):
            if random.random() < 0.59:
                base = HOME if hour < 8 or hour >= 18 else WORK
                locations.append({"timestamp": (start + timedelta(days=day, hours=hour)).isoformat().replace("+00:00", "Z"), "latitudeE7": int((base[0] + random.uniform(-.002, .002)) * 1e7), "longitudeE7": int((base[1] + random.uniform(-.002, .002)) * 1e7)})
    terms = ["python tutorial", "pizza near me", "therapy options", "budget planner", "weekend hiking"]
    for i in range(80):
        activity.append({"time": (start + timedelta(hours=i * 19)).isoformat().replace("+00:00", "Z"), "title": f"Searched for: {terms[i % len(terms)]}"})
    OUT.mkdir(exist_ok=True)
    with zipfile.ZipFile(OUT / "sample_google.zip", "w") as zf:
        zf.writestr("Takeout/Location History/Records.json", json.dumps(locations))
        zf.writestr("Takeout/My Activity/Search.json", json.dumps(activity))


def make_spotify():
    artists = ["Arijit Singh", "Coldplay", "A.R. Rahman", "The Weeknd"]
    rows, start = [], datetime.now(timezone.utc) - timedelta(days=60)
    for i in range(240):
        rows.append({"endTime": (start + timedelta(hours=i * 5)).strftime("%Y-%m-%d %H:%M"), "artistName": artists[i % len(artists)], "trackName": f"Track {i % 12}", "msPlayed": 210000})
    OUT.mkdir(exist_ok=True)
    with zipfile.ZipFile(OUT / "sample_spotify.zip", "w") as zf:
        zf.writestr("Spotify/StreamingHistory0.json", json.dumps(rows))


if __name__ == "__main__":
    make_google(); make_spotify(); print(f"Created sample archives in {OUT}")
