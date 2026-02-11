import { useEffect, useMemo, useState } from "react";
import { db } from "../../lib/firebase";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc
} from "firebase/firestore";
import { CalendarClock, Sparkles, Wand2, ToggleLeft, ToggleRight } from "lucide-react";
import AdminShell from "../../components/AdminShell";
import { useAuth } from "../../context/AuthContext";
import { isEventActive, parseEventDate } from "../../lib/eventUtils";
import { CLASS_CODES } from "../../lib/gameConfig";

const emptyForm = {
  title: "",
  description: "",
  rewardHint: "",
  marqueeText: "",
  scope: "all",
  classIds: [],
  modalBackgroundUrl: "",
  appliesTo: "all_submissions",
  oneTimePerUser: false,
  enabled: true,
  startAt: "",
  endAt: "",
  xpMultiplierPercent: 0,
  currencyMultiplierPercent: 0,
  flatCurrencyBonus: 0,
  randomCurrencyBonusMin: 0,
  randomCurrencyBonusMax: 0
};

const formatDateTimeLocal = (value) => {
  const parsed = parseEventDate(value);
  if (!parsed) return "";
  const pad = (num) => String(num).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

export default function AdminEvents() {
  const { userData } = useAuth();
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalBackgroundPreview, setModalBackgroundPreview] = useState("");

  const MAX_EVENT_BG_BYTES = 500 * 1024;
  const DEFAULT_EVENT_BG = "/event-modal-default.gif";

  useEffect(() => {
    const unsubEvents = onSnapshot(
      collection(db, "events"),
      (snap) => {
        setEvents(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      },
      (error) => {
        console.error("Events listener failed:", error);
      }
    );

    return () => {
      unsubEvents();
    };
  }, []);

  const classOptions = useMemo(() => {
    const list = Object.values(CLASS_CODES || {});
    return list
      .filter((cls) => cls?.id && cls?.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aDate = parseEventDate(a.startAt) || new Date(0);
      const bDate = parseEventDate(b.startAt) || new Date(0);
      return bDate.getTime() - aDate.getTime();
    });
  }, [events]);

  const handleTemplate = (template) => {
    if (template === "boost") {
      setForm((prev) => ({
        ...prev,
        title: prev.title || "Power Surge",
        description: prev.description || "All approvals earn bonus XP and currency.",
        rewardHint: prev.rewardHint || "Submit and get approved during the event window.",
        xpMultiplierPercent: 50,
        currencyMultiplierPercent: 50,
        flatCurrencyBonus: 0,
        randomCurrencyBonusMin: 0,
        randomCurrencyBonusMax: 0,
        appliesTo: prev.appliesTo || "all_submissions"
      }));
    }
    if (template === "flat") {
      setForm((prev) => ({
        ...prev,
        title: prev.title || "Bonus Drop",
        description: prev.description || "Every approved submission earns a flat bonus.",
        rewardHint: prev.rewardHint || "Get approvals while the bonus is live.",
        xpMultiplierPercent: 0,
        currencyMultiplierPercent: 0,
        flatCurrencyBonus: 500,
        randomCurrencyBonusMin: 0,
        randomCurrencyBonusMax: 0,
        appliesTo: prev.appliesTo || "all_submissions"
      }));
    }
    if (template === "random") {
      setForm((prev) => ({
        ...prev,
        title: prev.title || "Random Bonus Round",
        description: prev.description || "Approvals trigger a random cash payout.",
        rewardHint: prev.rewardHint || "Any approval can trigger a surprise bonus.",
        xpMultiplierPercent: 0,
        currencyMultiplierPercent: 0,
        flatCurrencyBonus: 0,
        randomCurrencyBonusMin: 50,
        randomCurrencyBonusMax: 250,
        appliesTo: prev.appliesTo || "all_submissions"
      }));
    }
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const selectedClassValue = form.scope === "all" ? "all" : form.classIds?.[0] || "";

  const handleClassSelect = (event) => {
    const value = event.target.value;
    if (value === "all") {
      setForm((prev) => ({ ...prev, scope: "all", classIds: [] }));
      return;
    }
    setForm((prev) => ({ ...prev, scope: "specific", classIds: value ? [value] : [] }));
  };

  const setModalBackground = (nextUrl) => {
    if (modalBackgroundPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(modalBackgroundPreview);
    }
    setModalBackgroundPreview(nextUrl || "");
  };

  const handleModalBackgroundChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setModalBackground(form.modalBackgroundUrl || "");
      return;
    }
    if (file.size > MAX_EVENT_BG_BYTES) {
      alert("Background is too large. Please upload a file 500KB or smaller.");
      event.target.value = "";
      setModalBackground(form.modalBackgroundUrl || "");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      setForm((prev) => ({ ...prev, modalBackgroundUrl: dataUrl }));
      setModalBackground(dataUrl);
    };
    reader.onerror = () => {
      alert("Failed to read the background file.");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      alert("Event title is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        rewardHint: form.rewardHint.trim(),
        marqueeText: form.marqueeText.trim(),
        scope: form.scope,
        classIds: form.scope === "all" ? [] : form.classIds,
        modalBackgroundUrl: form.modalBackgroundUrl || "",
        appliesTo: form.appliesTo || "all_submissions",
        oneTimePerUser: !!form.oneTimePerUser,
        enabled: form.enabled,
        startAt: form.startAt ? Timestamp.fromDate(new Date(form.startAt)) : null,
        endAt: form.endAt ? Timestamp.fromDate(new Date(form.endAt)) : null,
        xpMultiplierPercent: Number(form.xpMultiplierPercent) || 0,
        currencyMultiplierPercent: Number(form.currencyMultiplierPercent) || 0,
        flatCurrencyBonus: Number(form.flatCurrencyBonus) || 0,
        randomCurrencyBonusMin: Number(form.randomCurrencyBonusMin) || 0,
        randomCurrencyBonusMax: Number(form.randomCurrencyBonusMax) || 0,
        orgId: userData?.orgId || null,
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, "events", editingId), payload);
      } else {
        await addDoc(collection(db, "events"), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }

      setForm(emptyForm);
      setModalBackground("");
      setEditingId(null);
    } catch (error) {
      console.error("Saving event failed:", error);
      alert("Could not save event.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (event) => {
    setEditingId(event.id);
    setForm({
      title: event.title || "",
      description: event.description || "",
      rewardHint: event.rewardHint || "",
      marqueeText: event.marqueeText || "",
      scope: event.scope || "all",
      classIds: event.classIds || [],
      modalBackgroundUrl: event.modalBackgroundUrl || "",
      appliesTo: event.appliesTo || "all_submissions",
      oneTimePerUser: !!event.oneTimePerUser,
      enabled: event.enabled !== false,
      startAt: formatDateTimeLocal(event.startAt),
      endAt: formatDateTimeLocal(event.endAt),
      xpMultiplierPercent: event.xpMultiplierPercent || 0,
      currencyMultiplierPercent: event.currencyMultiplierPercent || 0,
      flatCurrencyBonus: event.flatCurrencyBonus || 0,
      randomCurrencyBonusMin: event.randomCurrencyBonusMin || 0,
      randomCurrencyBonusMax: event.randomCurrencyBonusMax || 0
    });
    setModalBackground(event.modalBackgroundUrl || "");
  };

  const toggleEnabled = async (event) => {
    try {
      await updateDoc(doc(db, "events", event.id), {
        enabled: !event.enabled,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Toggle event failed:", error);
    }
  };

  return (
    <AdminShell>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-400 font-semibold">Events Engine</p>
            <h1 className="text-3xl font-black text-slate-900 mt-2">Special Event Control</h1>
            <p className="text-slate-500 mt-2 max-w-xl">
              Launch scheduled bonuses that multiply XP, boost currency, or drop surprise payouts. Events apply
              to all approvals during the active window.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, startAt: formatDateTimeLocal(new Date()) }))}
              className="px-4 py-2 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              Start Now
            </button>
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1">
              <Sparkles size={14} /> {events.length} Events
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Wand2 size={18} /> {editingId ? "Edit Event" : "Create Event"}
              </h2>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                {form.enabled ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} />}
                {form.enabled ? "Enabled" : "Disabled"}
              </div>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Title</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={form.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    placeholder="Market Surge"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Marquee Text</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={form.marqueeText}
                    onChange={(e) => updateField("marqueeText", e.target.value)}
                    placeholder="Special event active — approvals earn bonuses!"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Description</label>
                <textarea
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[90px] focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Explain what the event does."
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Reward Instructions</label>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={form.rewardHint}
                  onChange={(e) => updateField("rewardHint", e.target.value)}
                  placeholder="Complete approvals during the window to earn bonuses."
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Start</label>
                  <input
                    type="datetime-local"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={form.startAt}
                    onChange={(e) => updateField("startAt", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">End</label>
                  <input
                    type="datetime-local"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={form.endAt}
                    onChange={(e) => updateField("endAt", e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase">Target</p>
                <div className="mt-3">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Choose class scope</label>
                  <select
                    value={selectedClassValue || "all"}
                    onChange={handleClassSelect}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="all">All classes</option>
                    {classOptions.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase">Applies to</p>
                <div className="flex flex-wrap gap-4 mt-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={form.appliesTo === "contract_stage"}
                      onChange={() => updateField("appliesTo", "contract_stage")}
                    />
                    Contract stages
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={form.appliesTo === "side_hustle"}
                      onChange={() => updateField("appliesTo", "side_hustle")}
                    />
                    Side hustles
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={form.appliesTo === "mission"}
                      onChange={() => updateField("appliesTo", "mission")}
                    />
                    Missions
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={form.appliesTo === "all_submissions"}
                      onChange={() => updateField("appliesTo", "all_submissions")}
                    />
                    All submissions
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase">Claim Rules</p>
                <label className="mt-3 flex items-center gap-3 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.oneTimePerUser}
                    onChange={(e) => updateField("oneTimePerUser", e.target.checked)}
                  />
                  One-time per agent (bonus applies only once per user)
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase">Modal Background</p>
                <p className="text-xs text-slate-500 mt-2">
                  Default background: <span className="font-semibold">{DEFAULT_EVENT_BG}</span>
                </p>
                <div className="mt-3 grid sm:grid-cols-[1.25fr_0.75fr] gap-4 items-start">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Upload</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleModalBackgroundChange}
                      className="mt-2 w-full text-sm"
                    />
                    <div className="mt-3">
                      <label className="text-xs font-semibold text-slate-500 uppercase">Or paste URL/data</label>
                      <input
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        value={form.modalBackgroundUrl}
                        onChange={(e) => {
                          updateField("modalBackgroundUrl", e.target.value);
                          setModalBackground(e.target.value);
                        }}
                        placeholder="https://... or data:image/..."
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 overflow-hidden min-h-[140px] bg-slate-50 flex items-center justify-center">
                    <img
                      src={modalBackgroundPreview || form.modalBackgroundUrl || DEFAULT_EVENT_BG}
                      alt="Event background preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_EVENT_BG;
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">XP Multiplier (%)</label>
                  <input
                    type="number"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={form.xpMultiplierPercent}
                    onChange={(e) => updateField("xpMultiplierPercent", e.target.value)}
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Currency Multiplier (%)</label>
                  <input
                    type="number"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={form.currencyMultiplierPercent}
                    onChange={(e) => updateField("currencyMultiplierPercent", e.target.value)}
                    min="0"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Flat Bonus ($)</label>
                  <input
                    type="number"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={form.flatCurrencyBonus}
                    onChange={(e) => updateField("flatCurrencyBonus", e.target.value)}
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Random Bonus Min</label>
                  <input
                    type="number"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={form.randomCurrencyBonusMin}
                    onChange={(e) => updateField("randomCurrencyBonusMin", e.target.value)}
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Random Bonus Max</label>
                  <input
                    type="number"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={form.randomCurrencyBonusMax}
                    onChange={(e) => updateField("randomCurrencyBonusMax", e.target.value)}
                    min="0"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleTemplate("boost")}
                  className="px-3 py-2 rounded-xl border border-indigo-200 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
                >
                  XP + Currency Boost
                </button>
                <button
                  type="button"
                  onClick={() => handleTemplate("flat")}
                  className="px-3 py-2 rounded-xl border border-emerald-200 text-sm font-semibold text-emerald-600 hover:bg-emerald-50"
                >
                  Flat Bonus
                </button>
                <button
                  type="button"
                  onClick={() => handleTemplate("random")}
                  className="px-3 py-2 rounded-xl border border-amber-200 text-sm font-semibold text-amber-600 hover:bg-amber-50"
                >
                  Random Bonus
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 pt-4">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => updateField("enabled", e.target.checked)}
                  />
                  Enabled
                </label>
                <div className="flex items-center gap-3">
                  {editingId && (
                    <button
                      type="button"
                      className="px-4 py-2 rounded-full border border-slate-200 text-sm font-semibold text-slate-500"
                      onClick={() => {
                        setForm(emptyForm);
                        setModalBackground("");
                        setEditingId(null);
                      }}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-full bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : editingId ? "Update Event" : "Create Event"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarClock size={18} /> Scheduled Events
            </h2>
            <div className="mt-4 space-y-4 max-h-[640px] overflow-y-auto pr-2">
              {sortedEvents.length === 0 && (
                <div className="border border-dashed border-slate-200 rounded-xl p-6 text-sm text-slate-500 text-center">
                  No events yet. Create your first event to begin.
                </div>
              )}
              {sortedEvents.map((event) => {
                const active = isEventActive(event);
                const start = parseEventDate(event.startAt);
                const end = parseEventDate(event.endAt);
                const status = event.enabled === false
                  ? "Disabled"
                  : active
                    ? "Active"
                    : start && start > new Date()
                      ? "Scheduled"
                      : "Ended";
                return (
                  <div key={event.id} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{event.title}</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {start ? start.toLocaleString() : "Anytime"} → {end ? end.toLocaleString() : "Until disabled"}
                        </p>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                        status === "Active"
                          ? "bg-emerald-100 text-emerald-700"
                          : status === "Scheduled"
                            ? "bg-amber-100 text-amber-700"
                            : status === "Disabled"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-rose-100 text-rose-600"
                      }`}>
                        {status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      {event.xpMultiplierPercent > 0 && <span>XP +{event.xpMultiplierPercent}%</span>}
                      {event.currencyMultiplierPercent > 0 && <span>Currency +{event.currencyMultiplierPercent}%</span>}
                      {event.flatCurrencyBonus > 0 && <span>Flat +${event.flatCurrencyBonus}</span>}
                      {(event.randomCurrencyBonusMin || event.randomCurrencyBonusMax) && (
                        <span>Random +${event.randomCurrencyBonusMin || 0}–${event.randomCurrencyBonusMax || event.randomCurrencyBonusMin || 0}</span>
                      )}
                      {event.appliesTo && (
                        <span>
                          Applies to {event.appliesTo === "all_submissions"
                            ? "all submissions"
                            : event.appliesTo === "mission"
                              ? "missions"
                              : event.appliesTo === "side_hustle"
                                ? "side hustles"
                                : "contract stages"}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <button
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        onClick={() => handleEdit(event)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1"
                        onClick={() => toggleEnabled(event)}
                      >
                        {event.enabled === false ? "Enable" : "Disable"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
