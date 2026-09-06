import { useState, useEffect } from "react";
import { parseFeedback } from "../api";

const REJECT_REASONS = ["Too junior", "Wrong location", "Wrong company background", "Skills mismatch", "Overqualified"];
const PAGE_SIZE = 5;

export default function ResultsList({
    profiles,
    empty,
    loosenHint,
    matchedBeforeRanking,
    rejectionLog,
    acceptedProfiles,
    onVerdictsChange,
    onRemoveAccepted,
    onAccept,
}) {
    const [verdicts, setVerdicts] = useState({}); // { profile_id: {verdict, reason} }
    const [openReasonFor, setOpenReasonFor] = useState(null);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [chatText, setChatText] = useState("");
    const [chatStatus, setChatStatus] = useState(null); // { kind: "applied" | "empty" | "error", detail }
    const [chatLoading, setChatLoading] = useState(false);

    useEffect(() => {
        setVerdicts({});
        setOpenReasonFor(null);
        setVisibleCount(PAGE_SIZE);
        setChatText("");
        setChatStatus(null);
    }, [profiles]);

    useEffect(() => {
        onVerdictsChange(verdicts);
    }, [verdicts]);

    function accept(id) {
        setVerdicts((v) => ({ ...v, [id]: { verdict: "yes", reason: null } }));
        setOpenReasonFor(null);
        const profile = profiles.find((p) => p.profile_id === id);
        if (profile) onAccept(profile);
    }

    function reject(id, reason) {
        setVerdicts((v) => ({ ...v, [id]: { verdict: "no", reason } }));
        setOpenReasonFor(null);
        if (verdicts[id]?.verdict === "yes") onRemoveAccepted(id);
    }

    async function handleChatSubmit(e) {
        e.preventDefault();
        const message = chatText.trim();
        if (!message || chatLoading) return;
        setChatLoading(true);
        setChatStatus(null);
        try {
            const result = await parseFeedback(profiles.slice(0, visibleCount), message);
            if (result.verdicts.length === 0) {
                setChatStatus({ kind: "empty" });
            } else {
                result.verdicts.forEach((v) => {
                    if (v.verdict === "yes") accept(v.profile_id);
                    else reject(v.profile_id, v.reason);
                });
                setChatStatus({ kind: "applied", detail: result.verdicts });
                setChatText("");
            }
        } catch (err) {
            setChatStatus({ kind: "error", detail: err.message || "Couldn't understand that — try per-profile Yes/No instead." });
        } finally {
            setChatLoading(false);
        }
    }

    const acceptedList = Object.values(acceptedProfiles || {});

    const approvedSection = acceptedList.length > 0 && (
        <div className="approved-section">
            <h3>Approved ({acceptedList.length})</h3>
            {acceptedList.map((p) => (
                <div key={p.profile_id} className="profile-card approved-card">
                    <div className="profile-card-header">
                        <div>
                            <strong>{p.name}</strong> — {p.current_title}
                        </div>
                        {onRemoveAccepted && (
                            <button className="remove-btn" onClick={() => onRemoveAccepted(p.profile_id)}>
                                ✕
                            </button>
                        )}
                    </div>
                    <div className="profile-meta">
                        {p.years_experience} yrs · {p.location} · {p.current_company}
                    </div>
                </div>
            ))}
        </div>
    );

    if (empty) {
        return (
            <div className="results-list">
                {approvedSection}
                <div className="empty-state">
                    <p>No candidates matched these filters.</p>
                    {loosenHint && <p className="hint">{loosenHint}</p>}
                </div>
            </div>
        );
    }

    const visibleProfiles = profiles.slice(0, visibleCount);

    return (
        <div className="results-list">
            {approvedSection}
            <p className="results-meta">{matchedBeforeRanking} candidate(s) matched — showing top {visibleProfiles.length} of {profiles.length}</p>

            <form className="chat-feedback" onSubmit={handleChatSubmit}>
                <input
                    type="text"
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    placeholder='e.g. "1 is too junior, 2 and 4 are right"'
                    disabled={chatLoading}
                />
                <button type="submit" disabled={chatLoading || !chatText.trim()}>
                    {chatLoading ? "Reading…" : "Apply"}
                </button>
            </form>
            {chatStatus?.kind === "applied" && (
                <p className="chat-status chat-status-ok">
                    Understood: {chatStatus.detail.map((v) => {
                        const idx = visibleProfiles.findIndex((p) => p.profile_id === v.profile_id);
                        const label = idx >= 0 ? `#${idx + 1}` : v.profile_id;
                        return v.verdict === "yes" ? `${label} accepted` : `${label} rejected (${v.reason})`;
                    }).join(", ")}
                </p>
            )}
            {chatStatus?.kind === "empty" && (
                <p className="chat-status chat-status-warn">
                    Couldn't match that to any profile on screen — try naming a number, e.g. "1 is too junior".
                </p>
            )}
            {chatStatus?.kind === "error" && <p className="chat-status chat-status-error">{chatStatus.detail}</p>}

            {visibleProfiles.map((p, i) => {
                const v = verdicts[p.profile_id];
                return (
                    <div key={p.profile_id} className={`profile-card ${v?.verdict === "no" ? "rejected" : ""}`}>
                        <div className="profile-card-header">
                            <div>
                                <span className="position-badge">{i + 1}</span> <strong>{p.name}</strong> — {p.current_title}
                                {p.previously_shown && (
                                    <span className="badge" title={rejectionLog[p.profile_id]?.join("; ") || undefined}>
                                        Previously shown
                                        {rejectionLog[p.profile_id]?.length > 0 && ` — rejected: ${rejectionLog[p.profile_id].join(", ")}`}
                                    </span>
                                )}
                            </div>
                            <span className="score">{p.score}</span>
                        </div>
                        <div className="profile-meta">
                            {p.years_experience} yrs · {p.location} · {p.current_company} ({p.current_company_type})
                        </div>
                        <div className="profile-skills">{p.skills.join(", ")}</div>
                        <p className="profile-explanation">{p.explanation}</p>

                        <div className="profile-actions">
                            <button
                                className={v?.verdict === "yes" ? "active" : ""}
                                onClick={() => accept(p.profile_id)}
                            >
                                Yes
                            </button>
                            <button
                                className={v?.verdict === "no" ? "active" : ""}
                                onClick={() => setOpenReasonFor(openReasonFor === p.profile_id ? null : p.profile_id)}
                            >
                                No
                            </button>
                        </div>

                        {openReasonFor === p.profile_id && (
                            <div className="reason-picker">
                                {REJECT_REASONS.map((r) => (
                                    <button key={r} onClick={() => reject(p.profile_id, r)}>
                                        {r}
                                    </button>
                                ))}
                                <input
                                    type="text"
                                    placeholder="Other reason..."
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && e.target.value.trim()) {
                                            reject(p.profile_id, e.target.value.trim());
                                        }
                                    }}
                                />
                            </div>
                        )}

                        {v?.verdict === "no" && v.reason && (
                            <div className="verdict-note">Rejected: {v.reason}</div>
                        )}
                    </div>
                );
            })}
            {visibleCount < profiles.length && (
                <button className="load-more-btn" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                    Load more ({profiles.length - visibleCount} remaining)
                </button>
            )}
        </div>
    );
}