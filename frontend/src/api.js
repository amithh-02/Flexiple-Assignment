const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function post(path, body) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => null);
        const detail = data?.detail || { kind: "network_error", message: `Request failed (${res.status})` };
        throw detail;
    }
    return res.json();
}

export function generateFiltersAndRubric(query) {
    return post("/api/generate", { query });
}

export function search(filters, rubric, everShownProfileIds) {
    return post("/api/search", { filters, rubric, ever_shown_profile_ids: everShownProfileIds });
}

export function parseFeedback(shownProfiles, message) {
    return post("/api/parse-feedback", { shown_profiles: shownProfiles, message });
}

export function refine({ filters, rubric, shownProfiles, feedbackItems, feedbackText, everShownProfileIds }) {
    return post("/api/refine", {
        filters,
        rubric,
        shown_profiles: shownProfiles,
        feedback_items: feedbackItems,
        feedback_text: feedbackText,
        ever_shown_profile_ids: everShownProfileIds,
    });
}