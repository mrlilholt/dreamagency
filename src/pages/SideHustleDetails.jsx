import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { 
    doc, 
    onSnapshot, 
    setDoc, 
    serverTimestamp 
} from "firebase/firestore";
import { 
    ArrowLeft, 
    DollarSign, 
    Zap, 
    Clock, 
    CheckCircle, 
    AlertCircle,
    Send
} from "lucide-react";
import Navbar from "../components/Navbar";
import { useTheme } from "../context/ThemeContext";

export default function SideHustleDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const labels = theme.labels;

  const [sideHustle, setSideHustle] = useState(null);
  const [job, setJob] = useState(null);
  const [submissionLink, setSubmissionLink] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const docRef = doc(db, "side_hustles", id);
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          setSideHustle({ id: snap.id, ...snap.data() });
        } else {
          setSideHustle(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("SideHustleDetails hustle listener failed:", error);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!user?.uid || !id) return;
    const jobRef = doc(db, "side_hustle_jobs", `${user.uid}_${id}`);
    const unsub = onSnapshot(
      jobRef,
      (snap) => {
        if (snap.exists()) {
          setJob(snap.data());
        } else {
          setJob(null);
        }
      },
      (error) => {
        console.error("SideHustleDetails job listener failed:", error);
      }
    );
    return () => unsub();
  }, [user, id]);

  const startHustle = async () => {
    if (!sideHustle || !user?.uid) return;

    await setDoc(doc(db, "side_hustle_jobs", `${user.uid}_${id}`), {
      student_id: user.uid,
      student_name: user.displayName || user.email,
      side_hustle_id: id,
      side_hustle_title: sideHustle.title,
      status: "active",
      current_level: 1,
      completed_count: 0,
      created_at: serverTimestamp()
    }, { merge: true });
  };

  const submitHustle = async (e) => {
    e.preventDefault();
    if (!submissionLink) return alert("Please add a link!");
    if (!user?.uid) return;

    const currentLevel = job?.current_level || 1;
    const jobRef = doc(db, "side_hustle_jobs", `${user.uid}_${id}`);

    await setDoc(jobRef, {
      student_id: user.uid,
      student_name: user.displayName || user.email,
      side_hustle_id: id,
      side_hustle_title: sideHustle?.title || "Side Hustle",
      status: "pending_review",
      current_level: currentLevel,
      completed_count: job?.completed_count || 0,
      status_message: "",
      submission_link: submissionLink,
      submission_notes: submissionNotes,
      last_submitted_level: currentLevel,
      submitted_at: serverTimestamp()
    }, { merge: true });

    setSubmissionLink("");
    setSubmissionNotes("");
    alert("Submission sent for review!");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading Side Hustle...</div>;
  if (!sideHustle) return <div className="min-h-screen flex items-center justify-center">Side Hustle Not Found.</div>;

  const levels = Array.isArray(sideHustle.levels) ? sideHustle.levels : [];
  const currentLevel = job?.current_level || 1;
  const safeLevelIndex = levels.length > 0 ? Math.min(currentLevel - 1, levels.length - 1) : 0;
  const currentLevelData = levels.length > 0 ? levels[safeLevelIndex] : null;
  const currentRewardCash = currentLevelData?.reward_cash ?? sideHustle.reward_cash ?? 0;
  const currentRewardXp = currentLevelData?.reward_xp ?? sideHustle.reward_xp ?? 0;
  const cardImage = sideHustle.image_url || "/side.png";

  return (
    <div className="min-h-screen theme-bg pb-20">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 theme-muted hover:theme-accent mb-6 transition">
          <ArrowLeft size={18} /> Back to Dashboard
        </button>

        <div className="theme-surface rounded-2xl shadow-sm border theme-border overflow-hidden mb-8">
          <div className="relative bg-slate-900 p-8 text-white overflow-hidden">
            <div
              className="absolute inset-0 bg-slate-900 bg-cover bg-center opacity-70"
              style={{ backgroundImage: `url(${cardImage})` }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20"></div>

            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <span className="inline-block bg-indigo-500 text-white text-xs font-bold px-2 py-1 rounded mb-3">
                    Side Hustle
                  </span>
                  <h1 className="text-3xl font-black mb-2">{sideHustle.title}</h1>
                  <p className="text-sm text-slate-200 max-w-2xl">
                    {sideHustle.summary || sideHustle.tagline || "Always-on field work."}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-xs text-slate-200 font-bold uppercase tracking-wider mb-1">Current Level Reward</p>
                  <div className="flex items-center gap-3 sm:justify-end">
                    <span className="text-xl font-black text-green-300 flex items-center gap-1">
                      <DollarSign size={18} className="text-green-400" />{currentRewardCash}
                    </span>
                    <span className="text-lg font-bold text-indigo-300 flex items-center gap-1">
                      <Zap size={16} className="text-indigo-300" />{currentRewardXp} {labels.xp}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-lg font-bold theme-text mb-2">Briefing</h2>
                <div className="bg-white/80 p-5 rounded-xl border border-slate-200 text-sm text-slate-600 leading-relaxed">
                  {sideHustle.details || "No briefing provided yet."}
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold theme-text mb-2">Levels</h2>
                {levels.length === 0 ? (
                  <div className="p-4 border border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
                    No levels set. This side hustle repeats the same briefing each time.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {levels.map((level, index) => {
                      const isCurrent = index + 1 === currentLevel || (currentLevel > levels.length && index === levels.length - 1);
                      return (
                        <div
                          key={`${level.title}-${index}`}
                          className={`p-4 rounded-xl border transition ${isCurrent ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"}`}
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-800">{level.title || `Level ${index + 1}`}</h3>
                            {isCurrent && (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-100 px-2 py-1 rounded">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs font-bold text-slate-500 mt-2">
                            <span className="flex items-center gap-1"><DollarSign size={12}/> {level.reward_cash ?? sideHustle.reward_cash ?? 0}</span>
                            <span className="flex items-center gap-1"><Zap size={12}/> {level.reward_xp ?? sideHustle.reward_xp ?? 0} {labels.xp}</span>
                          </div>
                          <p className="text-sm text-slate-600 mt-2">
                            {level.req || "No requirement set."}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
                <h3 className="font-bold text-slate-800 mb-2">Your Status</h3>
                <div className="text-sm text-slate-600 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Current Level</span>
                    <span className="font-bold text-slate-800">{currentLevel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Completed</span>
                    <span className="font-bold text-slate-800">{job?.completed_count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    {job?.status === "pending_review" ? (
                      <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded flex items-center gap-1">
                        <Clock size={12}/> Under Review
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded flex items-center gap-1">
                        <CheckCircle size={12}/> Ready
                      </span>
                    )}
                  </div>
                </div>

                {job?.status_message && (
                  <div className="mt-3 text-xs text-amber-600 flex items-center gap-2">
                    <AlertCircle size={14} /> {job.status_message}
                  </div>
                )}
              </div>

              {currentLevelData && (
                <div className="p-5 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-xs font-bold uppercase text-slate-500 mb-1">Current Level Objective</p>
                  <p className="text-sm text-slate-700">
                    {currentLevelData.req || "Submit your work for review."}
                  </p>
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-500 mt-3">
                    <span className="flex items-center gap-1"><DollarSign size={12}/> {currentRewardCash}</span>
                    <span className="flex items-center gap-1"><Zap size={12}/> {currentRewardXp} {labels.xp}</span>
                  </div>
                </div>
              )}

              {!job && (
                <button
                  onClick={startHustle}
                  className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 transition"
                >
                  Activate Side Hustle
                </button>
              )}

              {job?.status === "pending_review" ? (
                <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-700">
                  Submission received. Your next level unlocks after approval.
                </div>
              ) : (
                <form onSubmit={submitHustle} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Submission Link</label>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      value={submissionLink}
                      onChange={(e) => setSubmissionLink(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes (optional)</label>
                    <textarea
                      rows="3"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      value={submissionNotes}
                      onChange={(e) => setSubmissionNotes(e.target.value)}
                      placeholder="What should the teacher look for?"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-slate-900 text-white font-bold py-2 rounded-lg hover:bg-indigo-600 transition flex items-center justify-center gap-2"
                  >
                    <Send size={16} /> Submit Level {currentLevel}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
