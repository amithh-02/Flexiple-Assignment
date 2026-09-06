"""
FastAPI app. Three routes only, matching the three-stage LLM pipeline.
"""
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import data
from llm import call_structured, LLMError
from prompts import generate_prompt, score_prompt, refine_prompt, parse_feedback_prompt
from models import (
    GenerateRequest, GenerateResult,
    SearchRequest, SearchResponse,
    RefineRequest, RefineResponse,
    ScoreResult, RefineResult, ProfileCard,
    ParseFeedbackRequest, ParseFeedbackResult,
)
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

TOP_N = 20  # scored pool returned per round; frontend paginates display via "Load more"


def _score_and_rank(filters, rubric, ever_shown_ids: set[str]) -> tuple[list[ProfileCard], int, bool, str | None]:
    """Shared by /api/search and /api/refine: local filter -> LLM score -> top N cards."""
    matched = data.apply_filters(filters)
    if not matched:
        return [], 0, True, data.loosen_hint(filters)

    compact = [data.compact_profile(p) for p in matched]
    result: ScoreResult = call_structured(
        score_prompt(rubric.criteria, rubric.summary, compact, ever_shown_ids),
        ScoreResult,
        retry_hint="Return a JSON object with a scored_profiles array covering every candidate given.",
    )

    ranked = sorted(result.scored_profiles, key=lambda s: s.score, reverse=True)[:TOP_N]
    cards = []
    for s in ranked:
        p = data.by_id(s.profile_id)
        if not p:
            continue
        cards.append(ProfileCard(
            profile_id=p["id"],
            name=p["name"],
            current_title=p["current_title"],
            years_experience=p["years_experience"],
            location=p["location"],
            current_company=p["current_company"],
            current_company_type=p["current_company_type"],
            skills=p["skills"],
            score=s.score,
            explanation=s.explanation,
            previously_shown=p["id"] in ever_shown_ids,
        ))
    return cards, len(matched), False, None


@app.post("/api/generate", response_model=GenerateResult)
def generate(req: GenerateRequest):
    try:
        result: GenerateResult = call_structured(generate_prompt(req.query), GenerateResult)
        return result
    except LLMError as e:
        raise HTTPException(status_code=502, detail={"kind": e.kind, "message": e.message})


@app.post("/api/search", response_model=SearchResponse)
def search(req: SearchRequest):
    try:
        cards, matched_count, empty, hint = _score_and_rank(req.filters, req.rubric, set(req.ever_shown_profile_ids))
        return SearchResponse(profiles=cards, matched_before_ranking=matched_count, empty=empty, loosen_hint=hint)
    except LLMError as e:
        raise HTTPException(status_code=502, detail={"kind": e.kind, "message": e.message})


@app.post("/api/parse-feedback", response_model=ParseFeedbackResult)
def parse_feedback(req: ParseFeedbackRequest):
    try:
        shown_compact = [p.model_dump() for p in req.shown_profiles]
        result: ParseFeedbackResult = call_structured(
            parse_feedback_prompt(shown_compact, req.message),
            ParseFeedbackResult,
            retry_hint="Return a JSON object with a verdicts array, each item having profile_id, verdict, and reason.",
        )
        shown_ids = {p.profile_id for p in req.shown_profiles}
        result.verdicts = [v for v in result.verdicts if v.profile_id in shown_ids]
        return result
    except LLMError as e:
        raise HTTPException(status_code=502, detail={"kind": e.kind, "message": e.message})


@app.post("/api/refine", response_model=RefineResponse)
def refine(req: RefineRequest):
    try:
        shown_compact = [p.model_dump() for p in req.shown_profiles]
        feedback_items_dump = [fi.model_dump() for fi in req.feedback_items]
        result: RefineResult = call_structured(
            refine_prompt(req.filters.model_dump(), req.rubric.model_dump(), shown_compact, feedback_items_dump, req.feedback_text),
            RefineResult,
        )
        ever_shown = set(req.ever_shown_profile_ids)
        cards, matched_count, empty, hint = _score_and_rank(result.filters, result.rubric, ever_shown)
        return RefineResponse(
            filters=result.filters,
            rubric=result.rubric,
            change_summary=result.change_summary,
            profiles=cards,
            matched_before_ranking=matched_count,
            empty=empty,
            loosen_hint=hint,
        )
    except LLMError as e:
        raise HTTPException(status_code=502, detail={"kind": e.kind, "message": e.message})