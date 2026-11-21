"""Transparent priority scoring and Markdown report generation."""
from __future__ import annotations


def volume_score(count: int) -> int:
    for limit, score in ((100, 1), (1000, 2), (10000, 3), (50000, 4)):
        if count < limit:
            return score
    return 5


def effort_score(minutes: int) -> int:
    for limit, score in ((2, 1), (5, 2), (10, 3), (30, 4)):
        if minutes <= limit:
            return score
    return 5


def bucket(score: int) -> str:
    return "Critical" if score >= 150 else "High" if score >= 60 else "Medium" if score >= 20 else "Low"


def build_findings(data: dict, kb: dict, inference: dict) -> list[dict]:
    platform = data["platform"]
    spec = kb["platforms"].get(platform, {})
    findings = []
    for dtype, count in data.get("counts", {}).items():
        if not count or dtype not in spec.get("data_types", {}):
            continue
        meta = spec["data_types"][dtype]
        s, v, i, t, e = meta["sensitivity"], volume_score(count), meta.get("inferability", 3), meta.get("sharing", 1), effort_score(meta["effort_min"])
        priority = round((s * v * i * t) / e)
        findings.append({"platform": platform, "type": dtype, "label": meta["label"], "count": count, "sensitivity": s, "volume": v, "inferability": i, "sharing": t, "effort": e, "priority": priority, "bucket": bucket(priority), "why": meta["why"], "steps": meta["steps"], "minutes": meta["effort_min"]})
    if inference.get("sensitive_topics"):
        findings.append({"platform": platform, "type": "sensitive_topics", "label": "Sensitive topics in activity", "count": len(inference["sensitive_topics"]), "sensitivity": 5, "volume": 1, "inferability": 5, "sharing": spec.get("shares_score", 1), "effort": 3, "priority": round((5 * 1 * 5 * spec.get("shares_score", 1)) / 3), "bucket": "High", "why": "Sensitive keywords were found in the local export; the platform may use activity for personalization or safety systems.", "steps": spec.get("sensitive_steps", []), "minutes": 10})
    return sorted(findings, key=lambda row: row["priority"], reverse=True)


def markdown_report(findings: list[dict], inference: dict | None = None) -> str:
    lines = ["# TRACE exposure report", "", "Generated locally from the selected export.", "", "## Priority findings", ""]
    for index, item in enumerate(findings, 1):
        lines += [f"### {index}. {item['platform'].title()} — {item['label']} ({item['bucket']})", f"- Score: **{item['priority']}**", f"- Records: {item['count']}", f"- Why it matters: {item['why']}", f"- Time to fix: about {item['minutes']} minutes", "- Steps:"]
        lines += [f"  {step}" for step in item["steps"]] or ["  - Review this category in the platform’s privacy settings."]
        lines.append("")
    lines += ["## Inferences", ""]
    if inference:
        lines += [inference["home_work"]["explanation"], f"- Possible sensitive topics: {', '.join(inference['sensitive_topics']) or 'none detected'}"]
    else:
        lines.append("Inference details are shown in the local dashboard alongside the evidence that produced them.")
    return "\n".join(lines)
