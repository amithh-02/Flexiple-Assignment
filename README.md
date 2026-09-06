# Sourcing Refinement Loop

An AI-recruiter sourcing flow: free-text search → structured filters + fit rubric → LLM-scored
shortlist → recruiter feedback (per-profile Yes/No or free-text chat) → refined search → freeze.

## Prerequisites

- Python 3.11+
- Node.js 18+
- An OpenAI API key 

## 1. Backend setup

```bash
cd backend

python3.11 -m venv venv

source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt

```

Create `backend/.env`:

```bash

cp .env.example .env             # if present, otherwise create it manually

```

```

OPENAI_API_KEY=sk-...your-key-here

```

Run the API:

```bash

uvicorn main:app --reload --port 8000

```

The backend now listens on `http://localhost:8000`.

## 2. Frontend setup

In a second terminal:

```bash

cd frontend
npm install
npm run dev

```

Open the printed URL [http://localhost:5173](http://localhost:5173).

## Environment variables

| Variable | Where | Required | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | `backend/.env` | Yes | Auth for all LLM calls (generate filters/rubric, score, refine, parse chat feedback). Never commit this file — it's covered by `backend/.gitignore`. |
| `OPENAI_MODEL` | `backend/.env` | No | Defaults to `gpt-4o-mini`. |
| `OPENAI_BASE_URL` | `backend/.env` | No | Defaults to `https://api.openai.com/v1`. Override to point to an OpenAI-compatible provider. |
| `VITE_API_URL` | `frontend/.env` | No | Defaults to `http://localhost:8000`. Set only if the backend runs on a different host/port. |

### Using a different provider

Any OpenAI-compatible chat-completions API with structured outputs works — for example
OpenRouter's free-tier models. Set:

```

OPENAI_API_KEY=<your-openrouter-key>
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=<a free-tier model id>

```

## Using the app

1. Type a free-text search (e.g., *"RDS developers with 4-7 years of experience who have worked
   at startups, for a role based in Bangalore"*) and submit.
2. Review the generated filters and rubric — both are directly editable.
3. Review the top-ranked profiles, each with an explanation tied to that profile's real data.
4. Give feedback per profile (Yes/No) or as a chat message (e.g. *"1 is too junior, 2 and 4 are
   right"*), then submit — the app explains what it changed and re-runs the search.
5. Repeat as many rounds as you like, then click **Freeze search** to see the final filters, rubric,
   and ranked shortlist.

## Project structure

```

backend/
  main.py           FastAPI routes: generate, search, refine, parse-feedback
  prompts.py         All LLM prompts, kept in-repo and readable
  models.py           Pydantic schemas (structured outputs + request/response bodies)
  llm.py              Structured-output call helper: validation, retry-once, typed error handling
  data.py             Local filtering against profiles-data/profiles.json
  profiles-data/      Sample candidate dataset (48 profiles)

frontend/
  src/components/     SearchScreen, FiltersRubricPanel, ResultsList, FeedbackBar,
                       ChangeSummary, FrozenSummary
  src/api.js          Thin fetch wrapper around the backend routes
  src/App.jsx         Top-level state machine (landing → active → frozen)

```

## Decisions

**Prioritized**

- Getting the full loop working end to end with real LLM calls, structured outputs, and
  validation — this was the core grading criterion, so it came before any polish.
- Explanations that cite real profile fields (skills, years, company, past companies) — enforced
  directly in the scoring prompt, not left to chance.
- Deliberate empty/loading/error states, since the brief called them out explicitly as part of the
  frontend evaluation.
- A chat-style feedback path ("1 is too junior, 2 and 4 are right") in addition to per-profile
  Yes/No, via a small dedicated LLM call that maps free text to verdicts — this was called out as
  the more natural recruiter interaction in the spec.

**Cut / simplified**

- No persistence — state lives in memory for the session, per the spec's scope.
- No streaming responses; a single "thinking" state per LLM call was enough for this scope and
  kept the state machine simple.
- Company-type and years-experience filters are simple exact/range matches rather than fuzzy
  matching — the sample dataset is small and clean enough that this doesn't lose useful matches.
- One shared `call_structured` helper handles retry-once and error typing (rate limit/timeout/
  malformed output) for all four LLM calls, rather than bespoke handling per endpoint — kept the
  failure-handling logic in one place instead of duplicating it four times.
