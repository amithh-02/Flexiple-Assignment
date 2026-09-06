import { useState } from "react";

export default function FeedbackBar({ verdicts, onSubmit, disabled }) {
    const [text, setText] = useState("");

    const verdictCount = Object.keys(verdicts).length;

    function handleSubmit(e) {
        e.preventDefault();
        const feedbackItems = Object.entries(verdicts).map(([profile_id, v]) => ({
            profile_id,
            verdict: v.verdict,
            reason: v.reason,
        }));
        if (feedbackItems.length === 0 && !text.trim()) return;
        onSubmit(feedbackItems, text.trim() || null);
        setText("");
    }

    return (
        <form className="feedback-bar" onSubmit={handleSubmit}>
            <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='Optional: add more context, e.g. "focus more on payments experience"'
                disabled={disabled}
            />
            <button type="submit" disabled={disabled || (verdictCount === 0 && !text.trim())}>
                {verdictCount > 0 ? `Submit feedback (${verdictCount} rated)` : "Send"}
            </button>
        </form>
    );
}