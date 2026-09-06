"""
All Pydantic models for the sourcing refinement loop.
Kept in one file on purpose — the app has ~10 small shapes, not enough
to justify splitting into schemas/requests/responses packages.
"""
from pydantic import BaseModel, Field
from typing import Literal

COMPANY_TYPES = Literal["startup", "scaleup", "enterprise", "agency"]


# ---- Core domain shapes (also what the LLM returns via structured outputs) ----

class ObjectiveFilters(BaseModel):
    skills: list[str] = Field(default_factory=list)
    years_experience_min: int | None = None
    years_experience_max: int | None = None
    locations: list[str] = Field(default_factory=list)
    company_types: list[COMPANY_TYPES] = Field(default_factory=list)


class FitRubric(BaseModel):
    summary: str
    criteria: list[str]


class GenerateResult(BaseModel):
    filters: ObjectiveFilters
    rubric: FitRubric


class ScoredProfile(BaseModel):
    profile_id: str
    score: int = Field(ge=0, le=100)
    explanation: str


class ScoreResult(BaseModel):
    scored_profiles: list[ScoredProfile]


class RefineResult(BaseModel):
    filters: ObjectiveFilters
    rubric: FitRubric
    change_summary: str


# ---- Feedback (from the recruiter, sent to /api/refine) ----

class FeedbackItem(BaseModel):
    profile_id: str
    verdict: Literal["yes", "no"]
    reason: str | None = None  # only meaningful when verdict == "no"


# ---- API request/response bodies ----

class GenerateRequest(BaseModel):
    query: str


class SearchRequest(BaseModel):
    filters: ObjectiveFilters
    rubric: FitRubric
    ever_shown_profile_ids: list[str] = Field(default_factory=list)


class ProfileCard(BaseModel):
    """A scored profile joined back with its display fields, for the frontend."""
    profile_id: str
    name: str
    current_title: str
    years_experience: int
    location: str
    current_company: str
    current_company_type: str
    skills: list[str]
    score: int
    explanation: str
    previously_shown: bool


class SearchResponse(BaseModel):
    profiles: list[ProfileCard]
    matched_before_ranking: int
    empty: bool
    loosen_hint: str | None = None  # only set when empty


class RefineRequest(BaseModel):
    filters: ObjectiveFilters
    rubric: FitRubric
    shown_profiles: list[ProfileCard]
    feedback_items: list[FeedbackItem] = Field(default_factory=list)
    feedback_text: str | None = None
    ever_shown_profile_ids: list[str] = Field(default_factory=list)


class RefineResponse(BaseModel):
    filters: ObjectiveFilters
    rubric: FitRubric
    change_summary: str
    profiles: list[ProfileCard]
    matched_before_ranking: int
    empty: bool
    loosen_hint: str | None = None


# ---- Chat feedback parsing (free text -> per-profile verdicts) ----

class ParsedVerdict(BaseModel):
    profile_id: str
    verdict: Literal["yes", "no"]
    reason: str | None = None  # only meaningful when verdict == "no"


class ParseFeedbackResult(BaseModel):
    verdicts: list[ParsedVerdict]


class ParseFeedbackRequest(BaseModel):
    shown_profiles: list[ProfileCard]
    message: str