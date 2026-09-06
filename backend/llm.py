"""
One OpenAI client, one generic structured-call helper used by all three endpoints.
"""
import os
from openai import OpenAI
from pydantic import BaseModel, ValidationError

client = OpenAI(
    api_key=os.environ["OPENAI_API_KEY"],
    base_url=os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"),
)
MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")


class LLMError(Exception):
    def __init__(self, kind: str, message: str):
        self.kind = kind  # "rate_limited" | "timeout" | "generation_failed"
        self.message = message
        super().__init__(message)


def _strictify(schema: dict) -> dict:
    """OpenAI's strict structured-output mode requires every object to have
    additionalProperties: false and every property listed in 'required'
    (nullable fields stay optional via their type union, not by omission).
    Pydantic doesn't emit this shape, so we walk the schema and fix it."""
    if schema.get("type") == "object" and "properties" in schema:
        schema["additionalProperties"] = False
        schema["required"] = list(schema["properties"].keys())
        for prop in schema["properties"].values():
            _strictify(prop)
    if schema.get("type") == "array" and "items" in schema:
        _strictify(schema["items"])
    for key in ("$defs", "definitions"):
        if key in schema:
            for sub in schema[key].values():
                _strictify(sub)
    for key in ("anyOf", "oneOf", "allOf"):
        if key in schema:
            for sub in schema[key]:
                _strictify(sub)
    return schema


def call_structured(prompt: str, schema: type[BaseModel], retry_hint: str = "") -> BaseModel:
    """Call OpenAI with structured outputs, validate with Pydantic, retry once on failure."""
    json_schema = _strictify(schema.model_json_schema())

    for attempt in range(2):
        full_prompt = prompt if attempt == 0 else f"{prompt}\n\nIMPORTANT: {retry_hint or 'Your previous response did not match the required schema. Follow it exactly.'}"
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": full_prompt}],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": schema.__name__,
                        "schema": json_schema,
                        "strict": True,
                    },
                },
            )
        except Exception as e:
            msg = str(e).lower()
            if "rate limit" in msg or "429" in msg:
                raise LLMError("rate_limited", "OpenAI is rate-limited right now.")
            if "timeout" in msg or "timed out" in msg:
                raise LLMError("timeout", "The request to OpenAI timed out.")
            if attempt == 0:
                continue
            raise LLMError("generation_failed", f"OpenAI call failed: {e}")

        raw = response.choices[0].message.content
        try:
            return schema.model_validate_json(raw)
        except ValidationError:
            if attempt == 0:
                continue
            raise LLMError("generation_failed", "Model output did not match the expected shape after a retry.")

    raise LLMError("generation_failed", "Unexpected failure in call_structured.")