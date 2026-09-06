import { useState } from "react";

export default function FrozenSummary({ filters, rubric, profiles, acceptedProfiles, roundNumber, onResume }) {
    const [removedIds, setRemovedIds] = useState({});

    const finalShortlist = Object.values({
        ...Object.fromEntries(profiles.map((p) => [p.profile_id, p])),
        ...acceptedProfiles,
    }).filter((p) => !removedIds[p.profile_id]);

    function handleRemove(profileId) {
        setRemovedIds((prev) => ({ ...prev, [profileId]: true }));
    }

    return (
        <div className="frozen-summary">
            <div className="frozen-header">
                <h1>Search frozen</h1>
                {onResume && (
                    <button className="resume-btn" onClick={onResume}>
                        ← Back to search
                    </button>
                )}
            </div>
            <p className="frozen-meta">Finalized after {roundNumber} round(s) of refinement.</p>

            <div className="panel-section">
                <h3>Final filters</h3>
                <ul>
                    {filters.skills?.length > 0 && <li>Skills: {filters.skills.join(", ")}</li>}
                    {(filters.years_experience_min || filters.years_experience_max) && (
                        <li>
                            Experience: {filters.years_experience_min ?? "0"}–{filters.years_experience_max ?? "∞"} years
                        </li>
                    )}
                    {filters.locations?.length > 0 && <li>Location: {filters.locations.join(", ")}</li>}
                    {filters.company_types?.length > 0 && <li>Company type: {filters.company_types.join(", ")}</li>}
                </ul>
            </div>

            <div className="panel-section">
                <h3>Final rubric</h3>
                <p>{rubric.summary}</p>
                <ul>
                    {rubric.criteria.map((c, i) => (
                        <li key={i}>{c}</li>
                    ))}
                </ul>
            </div>

            <div className="panel-section">
                <h3>Final shortlist ({finalShortlist.length})</h3>
                {finalShortlist.map((p) => (
                    <div key={p.profile_id} className="profile-card frozen-card">
                        <div className="profile-card-header">
                            <div>
                                <strong>{p.name}</strong> — {p.current_title}
                            </div>
                            <div className="frozen-card-score">
                                <span className="score">{p.score}</span>
                                <button className="remove-btn" onClick={() => handleRemove(p.profile_id)}>
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="profile-meta">
                            {p.years_experience} yrs · {p.location} · {p.current_company}
                        </div>
                        <p className="profile-explanation">{p.explanation}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}