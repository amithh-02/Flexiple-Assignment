"""
Local, deterministic side of the pipeline: load the dataset once, filter it.
No LLM calls happen in this file.
"""
import json
from pathlib import Path
from models import ObjectiveFilters

DATA_PATH = Path(__file__).resolve().parent / "profiles-data" / "profiles.json"
PROFILES: list[dict] = json.loads(DATA_PATH.read_text())


def apply_filters(filters: ObjectiveFilters) -> list[dict]:
    result = []
    for p in PROFILES:
        if filters.skills:
            wanted = [s.lower() for s in filters.skills]
            has = [s.lower() for s in p["skills"]]
            if not any(w in h or h in w for w in wanted for h in has):
                continue
        if filters.years_experience_min is not None and p["years_experience"] < filters.years_experience_min:
            continue
        if filters.years_experience_max is not None and p["years_experience"] > filters.years_experience_max:
            continue
        if filters.locations and p["location"] not in filters.locations:
            continue
        if filters.company_types and p["current_company_type"] not in filters.company_types:
            continue
        result.append(p)
    return result


def loosen_hint(filters: ObjectiveFilters) -> str | None:
    """When a filter yields zero matches, report which single field, if dropped, helps most."""
    fields = {
        "skills": ObjectiveFilters(**{**filters.model_dump(), "skills": []}),
        "years_experience_min": ObjectiveFilters(**{**filters.model_dump(), "years_experience_min": None, "years_experience_max": None}),
        "locations": ObjectiveFilters(**{**filters.model_dump(), "locations": []}),
        "company_types": ObjectiveFilters(**{**filters.model_dump(), "company_types": []}),
    }
    best_field, best_count = None, 0
    for field, relaxed in fields.items():
        count = len(apply_filters(relaxed))
        if count > best_count:
            best_field, best_count = field, count
    if not best_field:
        return None
    label = {
        "skills": "skills",
        "years_experience_min": "years of experience range",
        "locations": "location",
        "company_types": "company background",
    }[best_field]
    return f"Loosening the {label} filter would surface {best_count} more candidate(s)."


def compact_profile(p: dict) -> dict:
    """Trimmed fields sent to the LLM for scoring — no summary field, on purpose
    (several profiles share identical boilerplate summaries; forcing the model
    to cite skills/years/company/location keeps explanations specific)."""
    return {
        "id": p["id"],
        "current_title": p["current_title"],
        "years_experience": p["years_experience"],
        "location": p["location"],
        "current_company": p["current_company"],
        "current_company_type": p["current_company_type"],
        "skills": p["skills"],
        "past_companies": p["past_companies"],
        "education": p["education"],
    }


def by_id(profile_id: str) -> dict | None:
    return next((p for p in PROFILES if p["id"] == profile_id), None)