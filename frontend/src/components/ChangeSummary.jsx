export default function ChangeSummary({ text }) {
    return (
        <div className="change-summary">
            <strong>What changed:</strong> {text}
        </div>
    );
}