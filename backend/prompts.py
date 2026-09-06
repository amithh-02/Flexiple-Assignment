"""
The three prompts, kept as plain functions returning strings.
No template engine — this app has exactly three prompts, ever.
"""
import json

FILTER_FIELDS_SPEC = """
ObjectiveFilters fields (all optional, omit/empty if not implied by the query):
- skills: list of strings, e.g. ["AWS RDS", "PostgreSQL"]
- years_experience_min / years_experience_max: integers
- locations: list of strings, e.g. ["Bangalore"]
- company_types: list, each one of exactly: "startup", "scaleup", "enterprise", "agency"
""".strip()


def generate_prompt(query: str) -> str:
    return f"""You are helping a technical recruiter turn a free-text search into a structured search.

Recruiter's request: "{query}"

Produce two things:
1. ObjectiveFilters — hard, checkable criteria only (skills, years of experience, location, company type).
{FILTER_FIELDS_SPEC}
   IMPORTANT: any specific technology, tool, framework, or skill named or implied in the request
   (e.g. "RDS", "Postgres", "React", "Django") MUST go into filters.skills as a literal string. Do not
   leave skills empty if the request names or clearly implies any technology — that's the single most
   important filter for a technical search. Only leave skills empty if the request truly names no
   specific technology at all.

2. FitRubric — the subjective judgment calls that can't be reduced to a filter: what "good" looks like
   for this specific role. summary is one sentence describing the ideal candidate. criteria is a list of
   3-6 short bullet statements a human recruiter would actually use to judge fit (e.g. "has hands-on
   production experience, not just coursework", "startup background suggests comfort with ambiguity").
   Do not restate the objective filters as rubric criteria — the rubric is for what filters can't capture,
   not a place to smuggle skills or other checkable facts back in.
"""


def score_prompt(rubric_criteria: list[str], rubric_summary: str, profiles: list[dict], ever_shown_ids: set[str]) -> str:
    profiles_with_flags = []
    for p in profiles:
        p2 = dict(p)
        if p["id"] in ever_shown_ids:
            p2["_note"] = "previously shown to the recruiter in an earlier round"
        profiles_with_flags.append(p2)

    return f"""You are scoring candidate profiles against a recruiter's fit rubric.

Ideal candidate: {rubric_summary}

Fit criteria:
{chr(10).join(f"- {c}" for c in rubric_criteria)}

Candidates (JSON):
{json.dumps(profiles_with_flags, indent=2)}

For each candidate, return a score from 0-100 against the fit criteria above, and a short explanation
(1-2 sentences). The explanation MUST cite specific fields from that candidate's own data — skills,
years_experience, current_company, current_company_type, or a specific past_companies entry. Never
write generic praise like "great culture fit" or "strong candidate" without naming the concrete detail
that justifies it. If a candidate is marked as previously shown, that is informational only — score them
purely against the current criteria, with no bonus or penalty for having appeared before.

Return every candidate given to you, scored.
"""


def refine_prompt(
    filters: dict,
    rubric: dict,
    shown_profiles: list[dict],
    feedback_items: list[dict],
    feedback_text: str | None,
) -> str:
    feedback_items_text = "\n".join(
        f"- {fi['profile_id']}: {fi['verdict']}" + (f" (reason: {fi['reason']})" if fi.get("reason") else "")
        for fi in feedback_items
    ) or "(none)"

    return f"""You are updating a candidate search based on a recruiter's feedback on the current results.

Current filters (JSON): {json.dumps(filters)}
Current rubric (JSON): {json.dumps(rubric)}

Profiles the recruiter was just shown (JSON):
{json.dumps(shown_profiles, indent=2)}

Per-profile verdicts from the recruiter:
{feedback_items_text}

Additional free-text feedback from the recruiter: "{feedback_text or '(none)'}"

Update the filters and/or rubric to reflect this feedback. Only change what the feedback actually
justifies — do not rewrite parts that weren't addressed. Use rejection reasons to tighten the right
field (e.g. "too junior" -> raise years_experience_min; "wrong location" -> narrow locations; "skills
mismatch" -> adjust skills or rubric criteria). Use free-text feedback for anything that doesn't map
to a specific profile (e.g. a global instruction to weight something differently).

Also return change_summary: 1-3 sentences, written for the recruiter, explaining what changed and why,
referencing their actual feedback (e.g. "Raised the minimum years to 5 since you flagged p03 as too
junior, and narrowed locations to Bangalore only since p07 didn't fit on location.").
"""


def parse_feedback_prompt(shown_profiles: list[dict], message: str) -> str:
    numbered = "\n".join(
        f"{i + 1}. profile_id={p['profile_id']}, name={p['name']}, title={p['current_title']}"
        for i, p in enumerate(shown_profiles)
    )

    return f"""A recruiter is looking at a numbered list of candidate profiles on screen and typed a free-text
reaction in chat. Map their reaction back to per-profile yes/no verdicts.

Profiles currently on screen, in the order shown (recruiter may refer to them by number, position
words like "first"/"last", or by name):
{numbered}

Recruiter's message: "{message}"

Rules:
- Only include a profile in your output if the message clearly expresses a verdict on it. Do not
  invent a verdict for a profile the message doesn't mention or imply.
- A number, ordinal, or position word refers to that profile's position in the list above (1-indexed).
- "yes"/"right"/"good"/"looks great" etc. -> verdict "yes".
- "no"/"reject"/anything expressing disqualification -> verdict "no", with reason set to a short
  phrase capturing WHY, taken from the message if given (e.g. "too junior"). If no reason is given,
  use a short neutral reason like "recruiter marked as no".
- A phrase covering multiple profiles (e.g. "2 and 4 are right") applies to each one named.
- Return profile_id exactly as given above, never the position number itself.
"""