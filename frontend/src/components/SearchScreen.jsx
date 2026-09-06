import { useState } from "react";

export default function SearchScreen({ onSubmit, error, onRetry, loading, loadingMessage }) {
    const [text, setText] = useState("");

    function handleSubmit(e) {
        e.preventDefault();
        if (!text.trim()) return;
        onSubmit(text.trim());
    }

    if (loading) {
        return (
            <div className="landing">
                <div className="thinking-big">{loadingMessage}</div>
            </div>
        );
    }

    return (
        <div className="landing">
            <h1>Find candidates</h1>
            <p className="landing-subtitle">
                Describe who you're looking for, in plain English.
            </p>
            <form onSubmit={handleSubmit} className="landing-form">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="e.g. RDS developers with 4-7 years of experience who have worked at startups, for a role based in Bangalore"
                    rows={3}
                />
                <button type="submit" disabled={!text.trim()}>
                    Search
                </button>
            </form>
            {error && (
                <div className="error-banner">
                    <span>{error.message}</span>
                    <button onClick={onRetry}>Retry</button>
                </div>
            )}
        </div>
    );
}