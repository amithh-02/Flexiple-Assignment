import { useState, useEffect } from "react";

const COMPANY_TYPE_OPTIONS = ["startup", "scaleup", "enterprise", "agency"];

export default function FiltersRubricPanel({ filters, rubric, onApply, onFreeze, disabled }) {
    const [draft, setDraft] = useState({ filters, rubric });
    const [dirty, setDirty] = useState(false);

    // reset the draft whenever the server sends new filters/rubric (new round, or after apply)
    useEffect(() => {
        setDraft({ filters, rubric });
        setDirty(false);
    }, [filters, rubric]);

    function updateFilters(patch) {
        setDraft((d) => ({ ...d, filters: { ...d.filters, ...patch } }));
        setDirty(true);
    }

    function updateRubric(patch) {
        setDraft((d) => ({ ...d, rubric: { ...d.rubric, ...patch } }));
        setDirty(true);
    }

    function listFromCsv(value) {
        return value.split(",").map((s) => s.trim()).filter(Boolean);
    }

    function toggleCompanyType(type) {
        const current = draft.filters.company_types || [];
        const next = current.includes(type)
            ? current.filter((t) => t !== type)
            : [...current, type];
        updateFilters({ company_types: next });
    }

    return (
        <div className="panel">
            <div className="panel-section">
                <h3>Filters</h3>
                <label>
                    Skills
                    <input
                        type="text"
                        value={(draft.filters.skills || []).join(", ")}
                        onChange={(e) => updateFilters({ skills: listFromCsv(e.target.value) })}
                        placeholder="e.g. AWS RDS, PostgreSQL"
                    />
                </label>
                <div className="row">
                    <label>
                        Min years
                        <input
                            type="number"
                            min="0"
                            value={draft.filters.years_experience_min ?? ""}
                            onChange={(e) =>
                                updateFilters({ years_experience_min: e.target.value === "" ? null : Number(e.target.value) })
                            }
                        />
                    </label>
                    <label>
                        Max years
                        <input
                            type="number"
                            min="0"
                            value={draft.filters.years_experience_max ?? ""}
                            onChange={(e) =>
                                updateFilters({ years_experience_max: e.target.value === "" ? null : Number(e.target.value) })
                            }
                        />
                    </label>
                </div>
                <label>
                    Locations
                    <input
                        type="text"
                        value={(draft.filters.locations || []).join(", ")}
                        onChange={(e) => updateFilters({ locations: listFromCsv(e.target.value) })}
                        placeholder="e.g. Bangalore"
                    />
                </label>
                <div className="chip-row">
                    {COMPANY_TYPE_OPTIONS.map((type) => (
                        <button
                            key={type}
                            type="button"
                            className={`chip ${draft.filters.company_types?.includes(type) ? "chip-active" : ""}`}
                            onClick={() => toggleCompanyType(type)}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            <div className="panel-section">
                <h3>Fit rubric</h3>
                <textarea
                    value={draft.rubric.summary}
                    onChange={(e) => updateRubric({ summary: e.target.value })}
                    rows={2}
                />
                <ul className="rubric-list">
                    {draft.rubric.criteria.map((c, i) => (
                        <li key={i}>
                            <input
                                type="text"
                                value={c}
                                onChange={(e) => {
                                    const next = [...draft.rubric.criteria];
                                    next[i] = e.target.value;
                                    updateRubric({ criteria: next });
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => updateRubric({ criteria: draft.rubric.criteria.filter((_, idx) => idx !== i) })}
                            >
                                ✕
                            </button>
                        </li>
                    ))}
                </ul>
                <button type="button" onClick={() => updateRubric({ criteria: [...draft.rubric.criteria, ""] })}>
                    + Add criterion
                </button>
            </div>

            <div className="panel-actions">
                <button
                    type="button"
                    disabled={!dirty || disabled}
                    onClick={() => onApply(draft.filters, draft.rubric)}
                >
                    Apply changes
                </button>
                <button type="button" className="freeze-btn" disabled={disabled} onClick={onFreeze}>
                    Freeze search
                </button>
            </div>
        </div>
    );
}