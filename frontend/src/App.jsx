import { useState } from "react";
import { generateFiltersAndRubric, search, refine } from "./api";
import SearchScreen from "./components/SearchScreen";
import FiltersRubricPanel from "./components/FiltersRubricPanel";
import ResultsList from "./components/ResultsList";
import FeedbackBar from "./components/FeedbackBar";
import ChangeSummary from "./components/ChangeSummary";
import FrozenSummary from "./components/FrozenSummary";

const LOADING_MESSAGES = {
  generate: "Reading your requirements and drafting filters + a fit rubric...",
  search: "Scoring candidates against the rubric...",
  refine: "Applying your feedback and re-scoring...",
};

export default function App() {
  const [stage, setStage] = useState("landing"); // landing | loading | active | frozen
  const [loadingKind, setLoadingKind] = useState(null); // generate | search | refine
  const [error, setError] = useState(null); // {kind, message} | null
  const [lastAction, setLastAction] = useState(null); // () => Promise, for retry

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(null);
  const [rubric, setRubric] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [matchedBeforeRanking, setMatchedBeforeRanking] = useState(0);
  const [empty, setEmpty] = useState(false);
  const [loosenHint, setLoosenHint] = useState(null);
  const [everShownProfileIds, setEverShownProfileIds] = useState([]);
  const [changeSummary, setChangeSummary] = useState(null);
  const [roundNumber, setRoundNumber] = useState(0);

  const [currentVerdicts, setCurrentVerdicts] = useState({}); // { profile_id: {verdict, reason} }, live from ResultsList
  const [rejectionLog, setRejectionLog] = useState({}); // { profile_id: [reason, ...] }, accumulated across rounds
  const [acceptedProfiles, setAcceptedProfiles] = useState({}); // { profile_id: profileCardObject }, accumulated across rounds

  function mergeShown(prevIds, newProfiles) {
    const ids = new Set(prevIds);
    newProfiles.forEach((p) => ids.add(p.profile_id));
    return Array.from(ids);
  }

  async function runSubmitQuery(q) {
    setStage("loading");
    setLoadingKind("generate");
    setError(null);
    try {
      const gen = await generateFiltersAndRubric(q);
      setFilters(gen.filters);
      setRubric(gen.rubric);

      setLoadingKind("search");
      const res = await search(gen.filters, gen.rubric, []);
      setProfiles(res.profiles);
      setMatchedBeforeRanking(res.matched_before_ranking);
      setEmpty(res.empty);
      setLoosenHint(res.loosen_hint);
      setEverShownProfileIds(mergeShown([], res.profiles));
      setRoundNumber(1);
      setChangeSummary(null);
      setStage("active");
    } catch (err) {
      setError(err);
      setStage(query ? "active" : "landing");
    }
  }

  async function runResearch(nextFilters, nextRubric) {
    // used when the recruiter manually edits filters/rubric directly
    setStage("loading");
    setLoadingKind("search");
    setError(null);
    try {
      const res = await search(nextFilters, nextRubric, everShownProfileIds);
      setFilters(nextFilters);
      setRubric(nextRubric);
      setProfiles(res.profiles);
      setMatchedBeforeRanking(res.matched_before_ranking);
      setEmpty(res.empty);
      setLoosenHint(res.loosen_hint);
      setEverShownProfileIds((prev) => mergeShown(prev, res.profiles));
      setChangeSummary(null);
      setCurrentVerdicts({});
      setStage("active");
    } catch (err) {
      setError(err);
      setStage("active");
    }
  }

  async function runSubmitFeedback(feedbackItems, feedbackText) {
    setStage("loading");
    setLoadingKind("refine");
    setError(null);
    try {
      const res = await refine({
        filters,
        rubric,
        shownProfiles: profiles,
        feedbackItems,
        feedbackText,
        everShownProfileIds,
      });

      setRejectionLog((prev) => {
        const next = { ...prev };
        feedbackItems.forEach((fi) => {
          if (fi.verdict === "no" && fi.reason) {
            next[fi.profile_id] = [...(next[fi.profile_id] || []), fi.reason];
          }
        });
        return next;
      });

      setFilters(res.filters);
      setRubric(res.rubric);
      setChangeSummary(res.change_summary);
      setProfiles(res.profiles);
      setMatchedBeforeRanking(res.matched_before_ranking);
      setEmpty(res.empty);
      setLoosenHint(res.loosen_hint);
      setEverShownProfileIds((prev) => mergeShown(prev, res.profiles));
      setRoundNumber((r) => r + 1);
      setCurrentVerdicts({});
      setStage("active");
    } catch (err) {
      setError(err);
      setStage("active"); // keep showing the previous round's results underneath the error
    }
  }

  function handleSubmitQuery(q) {
    setQuery(q);
    setLastAction(() => () => runSubmitQuery(q));
    runSubmitQuery(q);
  }

  function handleEditFiltersRubric(nextFilters, nextRubric) {
    setLastAction(() => () => runResearch(nextFilters, nextRubric));
    runResearch(nextFilters, nextRubric);
  }

  function handleSubmitFeedback(feedbackText) {
    const feedbackItems = Object.entries(currentVerdicts).map(([profile_id, v]) => ({
      profile_id,
      verdict: v.verdict,
      reason: v.reason,
    }));
    setLastAction(() => () => runSubmitFeedback(feedbackItems, feedbackText));
    runSubmitFeedback(feedbackItems, feedbackText);
  }

  function handleRetry() {
    if (lastAction) lastAction();
  }

  function handleFreeze() {
    setStage("frozen");
  }

  function handleAccept(profile) {
    setAcceptedProfiles((prev) => ({ ...prev, [profile.profile_id]: profile }));
  }

  function handleRemoveAccepted(profileId) {
    setAcceptedProfiles((prev) => {
      const next = { ...prev };
      delete next[profileId];
      return next;
    });
  }

  if (stage === "landing") {
    return <SearchScreen onSubmit={handleSubmitQuery} error={error} onRetry={handleRetry} />;
  }

  if (stage === "loading" && !filters) {
    // first-ever load, nothing to show behind the spinner yet
    return <SearchScreen loading loadingMessage={LOADING_MESSAGES[loadingKind]} />;
  }

  if (stage === "frozen") {
    return (
      <FrozenSummary
        filters={filters}
        rubric={rubric}
        profiles={profiles.filter((p) => currentVerdicts[p.profile_id]?.verdict !== "no")}
        acceptedProfiles={acceptedProfiles}
        roundNumber={roundNumber}
        onResume={() => setStage("active")}
      />
    );
  }

  return (
    <div className="app-shell">
      <FiltersRubricPanel
        filters={filters}
        rubric={rubric}
        onApply={handleEditFiltersRubric}
        onFreeze={handleFreeze}
        disabled={stage === "loading"}
      />

      {error && (
        <div className="error-banner">
          <span>{error.message}</span>
          <button onClick={handleRetry}>Retry</button>
        </div>
      )}

      {stage === "loading" ? (
        <div className="thinking">{LOADING_MESSAGES[loadingKind]}</div>
      ) : (
        <>
          {changeSummary && <ChangeSummary text={changeSummary} />}
          <ResultsList
            profiles={profiles}
            empty={empty}
            loosenHint={loosenHint}
            matchedBeforeRanking={matchedBeforeRanking}
            rejectionLog={rejectionLog}
            acceptedProfiles={acceptedProfiles}
            onVerdictsChange={setCurrentVerdicts}
            onRemoveAccepted={handleRemoveAccepted}
            onAccept={handleAccept}
          />
          <FeedbackBar
            verdicts={currentVerdicts}
            onSubmit={handleSubmitFeedback}
            disabled={stage === "loading"}
          />
        </>
      )}
    </div>
  );
}