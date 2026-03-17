import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import AdminShell from "../../components/AdminShell";

const DEFAULT_PAGE_SIZE = 3;

function getTodayLocal() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function formatClassName(classId) {
  if (!classId) return "Unassigned";
  return classId.replace(/_/g, " ");
}

function normalizeDate(value) {
  if (!value) return "";
  const str = String(value);
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function toTimeMs(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  const date = new Date(value);
  const ms = date.getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function buildDailyLabel(item) {
  const date = item.source_date || item.active_date || "Unknown date";
  return `${date} · Option ${item.option || "?"}`;
}

function launchDefaults(item) {
  return {
    class_id: item.class_id || "all",
    active_date: normalizeDate(item.active_date || item.source_date) || getTodayLocal()
  };
}

function SuggestionCard({
  item,
  launchConfig,
  classChoices,
  onLaunchChange,
  onFeedback,
  onPublish,
  busy,
  feedbackBusy
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {buildDailyLabel(item)}
      </p>
      <h3 className="mt-1 text-base font-black text-slate-900">{item.title || "Untitled suggestion"}</h3>
      <p className="mt-2 text-sm text-slate-700 leading-relaxed">{item.instruction || "No instruction provided."}</p>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">
        <span className="rounded-full bg-slate-100 px-2 py-1">Cash {item.reward_cash ?? 0}</span>
        <span className="rounded-full bg-slate-100 px-2 py-1">XP {item.reward_xp ?? 0}</span>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">👍 {item.thumbs_up_count || 0}</span>
        <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-700">👎 {item.thumbs_down_count || 0}</span>
        {item.code_word ? (
          <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">{item.code_word}</span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => onFeedback(item, "up")}
          disabled={feedbackBusy}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          👍 Like
        </button>
        <button
          onClick={() => onFeedback(item, "down")}
          disabled={feedbackBusy}
          className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          👎 Dislike
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Publish to Live Missions</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            Class
            <select
              value={launchConfig.class_id}
              onChange={(event) => onLaunchChange(item.id, "class_id", event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
            >
              {classChoices.map((classId) => (
                <option key={classId} value={classId}>
                  {formatClassName(classId)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Launch date
            <input
              type="date"
              value={launchConfig.active_date}
              onChange={(event) => onLaunchChange(item.id, "active_date", event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
            />
          </label>
        </div>
        <button
          onClick={() => onPublish(item)}
          disabled={busy}
          className="mt-3 rounded-lg border border-indigo-300 bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Publishing..." : "Publish Live Mission"}
        </button>
      </div>
    </article>
  );
}

export default function AdminGenerate() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState("all");
  const [pageByClass, setPageByClass] = useState({});
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [launchById, setLaunchById] = useState({});
  const [publishingById, setPublishingById] = useState({});
  const [feedbackById, setFeedbackById] = useState({});
  const [statusMsg, setStatusMsg] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState({
    open: false,
    item: null,
    sentiment: "up",
    notes: ""
  });

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "mission_suggestions"),
      (snap) => {
        const next = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setItems(next);
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        console.error("AdminGenerate suggestions listener failed:", snapshotError);
        setError("Could not load mission suggestions. Check Firestore rules and auth role.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const availableDates = useMemo(() => {
    const unique = new Set();
    items.forEach((item) => {
      const date = normalizeDate(item.source_date || item.active_date);
      if (date) unique.add(date);
    });
    return Array.from(unique).sort((a, b) => (a < b ? 1 : -1));
  }, [items]);

  const classChoices = useMemo(() => {
    const unique = new Set(items.map((item) => item.class_id || "all"));
    unique.add("all");
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const groupedByClass = useMemo(() => {
    const filtered = selectedDate === "all"
      ? items
      : items.filter((item) => normalizeDate(item.source_date || item.active_date) === selectedDate);

    const sorted = [...filtered].sort((a, b) => {
      const dateA = normalizeDate(a.source_date || a.active_date);
      const dateB = normalizeDate(b.source_date || b.active_date);
      if (dateA !== dateB) return dateA < dateB ? 1 : -1;

      const optionA = Number(a.option || 0);
      const optionB = Number(b.option || 0);
      if (optionA !== optionB) return optionA - optionB;

      return toTimeMs(b.updatedAt || b.createdAt) - toTimeMs(a.updatedAt || a.createdAt);
    });

    return sorted.reduce((acc, item) => {
      const classId = item.class_id || "unassigned";
      if (!acc[classId]) acc[classId] = [];
      acc[classId].push(item);
      return acc;
    }, {});
  }, [items, selectedDate]);

  const classEntries = useMemo(() => {
    return Object.entries(groupedByClass).sort(([a], [b]) => a.localeCompare(b));
  }, [groupedByClass]);

  const getLaunchConfig = (item) => launchById[item.id] || launchDefaults(item);

  const handleLaunchChange = (id, key, value) => {
    setLaunchById((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [key]: value
      }
    }));
  };

  const openFeedbackPrompt = (item, sentiment) => {
    setFeedbackDraft({
      open: true,
      item,
      sentiment,
      notes: ""
    });
  };

  const closeFeedbackPrompt = () => {
    setFeedbackDraft({
      open: false,
      item: null,
      sentiment: "up",
      notes: ""
    });
  };

  const handleFeedbackSubmit = async () => {
    const item = feedbackDraft.item;
    const sentiment = feedbackDraft.sentiment;
    if (!item) return;

    if (!user?.uid) {
      setStatusMsg("You must be logged in as admin to leave feedback.");
      return;
    }

    if (!feedbackDraft.notes.trim()) {
      setStatusMsg("Please add a quick note so the generator can learn from your feedback.");
      return;
    }

    const scoreDelta = sentiment === "up" ? 1 : -1;
    const counterField = sentiment === "up" ? "thumbs_up_count" : "thumbs_down_count";
    setFeedbackById((prev) => ({ ...prev, [item.id]: true }));

    try {
      await addDoc(collection(db, "mission_suggestion_feedback"), {
        suggestion_id: item.id,
        suggestion_doc_id: item.id,
        class_id: item.class_id || "all",
        source_date: item.source_date || item.active_date || "",
        option: Number(item.option || 0),
        sentiment,
        sentiment_label: sentiment === "up" ? "liked" : "avoid",
        score_delta: scoreDelta,
        notes: feedbackDraft.notes.trim(),
        title: item.title || "",
        trend: item.trend || "",
        archetype: item.archetype || "",
        createdBy: user.uid,
        createdByName: user.displayName || "",
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, "mission_suggestions", item.id), {
        [counterField]: increment(1),
        score: increment(scoreDelta),
        updatedAt: serverTimestamp()
      });
      setStatusMsg(`Saved ${sentiment === "up" ? "like" : "dislike"} feedback for "${item.title || "suggestion"}".`);
      closeFeedbackPrompt();
    } catch (feedbackError) {
      console.error("Feedback submit failed:", feedbackError);
      setStatusMsg("Could not save feedback. Check Firestore permissions.");
    } finally {
      setFeedbackById((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const handlePublish = async (item) => {
    if (!user?.uid) {
      setStatusMsg("You must be logged in as admin to publish a mission.");
      return;
    }

    const launch = getLaunchConfig(item);
    const targetClass = launch.class_id || item.class_id || "all";
    const targetDate = normalizeDate(launch.active_date) || getTodayLocal();

    setPublishingById((prev) => ({ ...prev, [item.id]: true }));
    try {
      const newMissionRef = await addDoc(collection(db, "daily_missions"), {
        title: item.title || "Untitled mission",
        instruction: item.instruction || "",
        code_word: item.code_word || "",
        reward_cash: Number(item.reward_cash || 0),
        reward_xp: Number(item.reward_xp || 0),
        class_id: targetClass,
        active_date: targetDate,
        createdAt: serverTimestamp(),
        source: "mission_suggestions",
        source_suggestion_id: item.id,
        importedBy: user.uid
      });

      await updateDoc(doc(db, "mission_suggestions", item.id), {
        imported_count: increment(1),
        imported_mission_ids: arrayUnion(newMissionRef.id),
        updatedAt: serverTimestamp()
      });

      setStatusMsg(`Published "${item.title || "Mission"}" for ${formatClassName(targetClass)} on ${targetDate}.`);
    } catch (publishError) {
      console.error("Publish mission failed:", publishError);
      setStatusMsg("Could not publish mission. Check Firestore permissions.");
    } finally {
      setPublishingById((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Daily Mission Creator</p>
              <h2 className="text-2xl font-black text-slate-900">Mission Suggestions History</h2>
              <p className="mt-1 text-sm text-slate-600">
                Browse previous ideas, leave feedback, and publish selected ideas to live missions with class/date control.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="dateFilter" className="text-xs font-bold uppercase text-slate-500">Date</label>
              <select
                id="dateFilter"
                value={selectedDate}
                onChange={(event) => {
                  setSelectedDate(event.target.value);
                  setPageByClass({});
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                <option value="all">All dates</option>
                {availableDates.map((dateKey) => (
                  <option key={dateKey} value={dateKey}>{dateKey}</option>
                ))}
              </select>
              <label htmlFor="pageSize" className="ml-3 text-xs font-bold uppercase text-slate-500">Per class</label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value) || DEFAULT_PAGE_SIZE);
                  setPageByClass({});
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                <option value={3}>3</option>
                <option value={6}>6</option>
                <option value={9}>9</option>
              </select>
            </div>
          </div>

          {statusMsg ? (
            <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800">
              {statusMsg}
            </div>
          ) : null}
        </section>

        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-600">Loading mission suggestions...</p>
          </section>
        ) : null}

        {error ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <p className="text-sm font-semibold text-rose-700">{error}</p>
          </section>
        ) : null}

        {!loading && !error && classEntries.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-600">No mission suggestions found for this filter.</p>
            <p className="mt-1 text-sm text-slate-600">
              Generate and publish suggestions with{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5">MISSIONS_PUBLISH_TO_FIRESTORE=1 npm run missions:generate</code>.
            </p>
          </section>
        ) : null}

        {!loading && !error && classEntries.map(([classId, classItems]) => {
          const totalPages = Math.max(1, Math.ceil(classItems.length / pageSize));
          const page = Math.min(pageByClass[classId] || 1, totalPages);
          const startIndex = (page - 1) * pageSize;
          const pageItems = classItems.slice(startIndex, startIndex + pageSize);

          return (
            <section key={classId} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-black text-slate-900 capitalize">{formatClassName(classId)}</h3>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{classItems.length} ideas</p>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {pageItems.map((item) => (
                  <SuggestionCard
                    key={item.id}
                    item={item}
                    launchConfig={getLaunchConfig(item)}
                    classChoices={classChoices}
                    onLaunchChange={handleLaunchChange}
                    onFeedback={openFeedbackPrompt}
                    onPublish={handlePublish}
                    busy={Boolean(publishingById[item.id])}
                    feedbackBusy={Boolean(feedbackById[item.id])}
                  />
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-500">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setPageByClass((prev) => ({
                          ...prev,
                          [classId]: Math.max(1, page - 1)
                        }));
                      }}
                      disabled={page <= 1}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => {
                        setPageByClass((prev) => ({
                          ...prev,
                          [classId]: Math.min(totalPages, page + 1)
                        }));
                      }}
                      disabled={page >= totalPages}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p>Need to create new ideas? Use the mission generator script and refresh this page.</p>
          <p className="mt-1">
            Jump back to <Link className="font-bold text-indigo-700 hover:text-indigo-800" to="/dashboard">Dashboard Home</Link>.
          </p>
        </section>

        {feedbackDraft.open && feedbackDraft.item ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 p-4">
            <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                {feedbackDraft.sentiment === "up" ? "Like feedback" : "Dislike feedback"}
              </p>
              <h3 className="mt-1 text-lg font-black text-slate-900">
                {feedbackDraft.item.title || "Mission suggestion"}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                What specifically was {feedbackDraft.sentiment === "up" ? "strong" : "weak"} about this suggestion?
                This note is used in future automation runs.
              </p>
              <textarea
                value={feedbackDraft.notes}
                onChange={(event) => setFeedbackDraft((prev) => ({ ...prev, notes: event.target.value }))}
                rows={5}
                placeholder="Example: Great real-school problem and clear sketch steps."
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={closeFeedbackPrompt}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFeedbackSubmit}
                  disabled={Boolean(feedbackById[feedbackDraft.item.id])}
                  className="rounded-lg border border-indigo-300 bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {feedbackById[feedbackDraft.item.id] ? "Saving..." : "Save feedback"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
