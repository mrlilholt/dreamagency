import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, doc, updateDoc, increment, addDoc, serverTimestamp, writeBatch, arrayRemove, arrayUnion, getDoc, setDoc } from "firebase/firestore";
import { CLASS_CODES } from "../../lib/gameConfig"; // <--- REMOVED "BADGES"
import { 
    Users, Filter, Search, DollarSign, 
    Briefcase, Trash2, Gavel, ArrowLeft, ChevronRight, Medal, Send, MessageSquare
} from "lucide-react";
import AdminShell from "../../components/AdminShell";
import { useAuth } from "../../context/AuthContext";
import { THEME_CONFIG, resolveThemeId } from "../../lib/themeConfig";
import { useTheme } from "../../context/ThemeContext";
import { applyEventRewards, formatEventBonusMessage, getActiveEventsForClass, getOneTimeEvents, filterEventsByClaims } from "../../lib/eventUtils";

export default function AdminRoster() {
  // --- STATE ---
  const [students, setStudents] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [availableBadges, setAvailableBadges] = useState([]); // <--- NEW: Dynamic Badges from DB
  const { user } = useAuth();
  const { theme } = useTheme();
  const labels = theme.labels;
  const [classes, setClasses] = useState([]);
  const [events, setEvents] = useState([]);
  const [filterClass, setFilterClass] = useState("all");
  const [filterDivision, setFilterDivision] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState(null); 
  const [loading, setLoading] = useState(true);
  
  // Forms
  const [bonusForm, setBonusForm] = useState({ currency: 0, xp: 0 });
  const [selectedBadgeId, setSelectedBadgeId] = useState(""); 
  const [adminMessage, setAdminMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [classMessage, setClassMessage] = useState("");
  const [classMessageTarget, setClassMessageTarget] = useState("");
  const [sendingClassMsg, setSendingClassMsg] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // --- LISTENERS ---
  useEffect(() => {
    // 1. GUARD CLAUSE: Stop listeners if no admin is logged in
    if (!user) return;

    setLoading(true);

    // 2. Listen to Users
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
        const userList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort alphabetically
        userList.sort((a, b) => {
            const nameA = a.name || a.displayName || "";
            const nameB = b.name || b.displayName || "";
            return nameA.localeCompare(nameB);
        });
        setStudents(userList);
        setLoading(false);
    }, (error) => console.error("Roster Error:", error));

    // 3. Listen to Active Jobs (for stats)
    const unsubJobs = onSnapshot(collection(db, "active_jobs"), (snap) => {
        const jobList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setJobs(jobList);
    }, (error) => console.error("Jobs Error:", error));

    // 4. Listen to Badges (The new dynamic list)
    const unsubBadges = onSnapshot(collection(db, "badges"), (snap) => {
        const badgeList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAvailableBadges(badgeList);
    }, (error) => console.error("Badges Error:", error));

    // 5. Listen to Classes Directory
    const unsubClasses = onSnapshot(collection(db, "classes"), (snap) => {
        const classList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setClasses(classList);
    }, (error) => console.error("Classes Error:", error));

    // 6. Listen to Events
    const unsubEvents = onSnapshot(collection(db, "events"), (snap) => {
        const eventList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setEvents(eventList);
    }, (error) => console.error("Events Error:", error));

    // Cleanup all 4 listeners on unmount/logout
    return () => {
        unsubUsers();
        unsubJobs();
        unsubBadges();
        unsubClasses();
        unsubEvents();
    };
  }, [user]); // <--- Dependency array now watches 'user'

  // --- ACTIONS ---
  const getBoostedXp = (baseXp, userData) => {
    const rawExpiry = userData?.xpBoostExpiresAt;
    if (!rawExpiry) return baseXp;
    const expiryDate = rawExpiry?.toDate ? rawExpiry.toDate() : new Date(rawExpiry);
    if (!expiryDate || Number.isNaN(expiryDate.getTime())) return baseXp;
    if (expiryDate <= new Date()) return baseXp;
    const boostPercent = Number(userData?.xpBoostPercent) || 10;
    return Math.ceil(Number(baseXp || 0) * (1 + boostPercent / 100));
  };

  const getBoostedCurrency = (baseCash, userData) => {
    const rawExpiry = userData?.currencyBoostExpiresAt;
    if (!rawExpiry) return baseCash;
    const expiryDate = rawExpiry?.toDate ? rawExpiry.toDate() : new Date(rawExpiry);
    if (!expiryDate || Number.isNaN(expiryDate.getTime())) return baseCash;
    if (expiryDate <= new Date()) return baseCash;
    const boostPercent = Number(userData?.currencyBoostPercent) || 10;
    return Math.ceil(Number(baseCash || 0) * (1 + boostPercent / 100));
  };

  const resolveEventClaims = async (activeEvents, userId) => {
    const oneTimeEvents = getOneTimeEvents(activeEvents);
    if (!oneTimeEvents.length) {
      return { usableEvents: activeEvents, claimedIds: new Set() };
    }
    const claimSnaps = await Promise.all(
      oneTimeEvents.map((event) =>
        getDoc(doc(db, "users", userId, "event_claims", event.id))
      )
    );
    const claimedIds = new Set();
    claimSnaps.forEach((snap, index) => {
      if (snap.exists()) claimedIds.add(oneTimeEvents[index].id);
    });
    return {
      usableEvents: filterEventsByClaims(activeEvents, claimedIds),
      claimedIds
    };
  };

  // 1. Manual Bonus
  const handleBonusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudentId) return;

    const currencyAmount = parseInt(bonusForm.currency) || 0;
    const xpAmount = parseInt(bonusForm.xp) || 0;

    try {
        const userRef = doc(db, "users", selectedStudentId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};
        const boostedXp = getBoostedXp(xpAmount, userData);
        const boostedCash = getBoostedCurrency(currencyAmount, userData);
        const classId = userData?.class_id || userData?.active_class_id || (Array.isArray(userData?.class_ids) ? userData.class_ids[0] : null);
        const activeEvents = getActiveEventsForClass(events, classId, userData?.orgId);
        const { usableEvents } = await resolveEventClaims(activeEvents, selectedStudentId);
        const eventAdjusted = applyEventRewards({
            baseXp: boostedXp,
            baseCurrency: boostedCash,
            events: usableEvents,
            eventType: "manual_bonus"
        });
        const eventBonusMessage = formatEventBonusMessage({
            bonus: eventAdjusted.bonus,
            events: eventAdjusted.appliedEvents
        });

        await updateDoc(userRef, {
            currency: increment(eventAdjusted.currency),
            xp: increment(eventAdjusted.xp)
        });
        const appliedOneTimeEvents = eventAdjusted.appliedEvents.filter((event) => event.oneTimePerUser);
        if (appliedOneTimeEvents.length) {
            await Promise.all(
                appliedOneTimeEvents.map((event) =>
                    setDoc(
                        doc(db, "users", selectedStudentId, "event_claims", event.id),
                        {
                            eventId: event.id,
                            title: event.title || "",
                            eventType: "manual_bonus",
                            claimedAt: serverTimestamp()
                        },
                        { merge: true }
                    )
                )
            );
        }
        if (eventBonusMessage) {
            await addDoc(collection(db, "users", selectedStudentId, "alerts"), {
                type: "event_bonus",
                message: eventBonusMessage,
                read: false,
                createdAt: serverTimestamp()
            });
        }
        
        setBonusForm({ currency: 0, xp: 0 });
        alert(`Stats updated: $${eventAdjusted.currency} / ${eventAdjusted.xp} ${labels.xp}`);
    } catch (error) {
        console.error("Error giving bonus:", error);
        alert("Failed to update stats.");
    }
  };

  // 2. Grant Badge (Dynamic Version)
  const handleGrantBadge = async (e) => {
      e.preventDefault();
      if (!selectedStudentId || !selectedBadgeId) return;

      // Find the real badge data from our dynamic list
      const badge = availableBadges.find(b => b.id === selectedBadgeId);
      if (!badge) return;

      try {
          const userRef = doc(db, "users", selectedStudentId);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() : {};
          const baseXp = Number(badge.xpReward || 0);
          const boostedXp = getBoostedXp(baseXp, userData);
          const cashReward = Number(badge.currencyReward || 0);
          const boostedCash = getBoostedCurrency(cashReward, userData);
          const classId = userData?.class_id || userData?.active_class_id || (Array.isArray(userData?.class_ids) ? userData.class_ids[0] : null);
          const activeEvents = getActiveEventsForClass(events, classId, userData?.orgId);
          const { usableEvents } = await resolveEventClaims(activeEvents, selectedStudentId);
          const eventAdjusted = applyEventRewards({
              baseXp: boostedXp,
              baseCurrency: boostedCash,
              events: usableEvents,
              eventType: "manual_bonus"
          });
          const eventBonusMessage = formatEventBonusMessage({
              bonus: eventAdjusted.bonus,
              events: eventAdjusted.appliedEvents
          });
          
          // Use Dot Notation to update the Map (not an array push)
          await updateDoc(userRef, {
              [`badges.${badge.id}`]: {
                  earnedAt: new Date().toISOString(),
                  title: badge.title
              },
              xp: increment(eventAdjusted.xp),
              currency: increment(eventAdjusted.currency)
          });
          const appliedOneTimeEvents = eventAdjusted.appliedEvents.filter((event) => event.oneTimePerUser);
          if (appliedOneTimeEvents.length) {
              await Promise.all(
                  appliedOneTimeEvents.map((event) =>
                      setDoc(
                          doc(db, "users", selectedStudentId, "event_claims", event.id),
                          {
                              eventId: event.id,
                              title: event.title || "",
                              eventType: "manual_bonus",
                              claimedAt: serverTimestamp()
                          },
                          { merge: true }
                      )
                  )
              );
          }
          if (eventBonusMessage) {
              await addDoc(collection(db, "users", selectedStudentId, "alerts"), {
                  type: "event_bonus",
                  message: eventBonusMessage,
                  read: false,
                  createdAt: serverTimestamp()
              });
          }

          setSelectedBadgeId(""); 
          alert(`Awarded "${badge.title}" +${eventAdjusted.xp} ${labels.xp} and $${eventAdjusted.currency}!`);
      } catch (error) {
          console.error("Error awarding badge:", error);
          alert("Failed to award badge.");
      }
  };

  // 3. Send Message
  const sendDirectMessage = async (e) => {
    e.preventDefault();
    if (!selectedStudentId || !adminMessage.trim()) return;
    
    setSendingMsg(true);
    try {
        await addDoc(collection(db, "users", selectedStudentId, "alerts"), {
            message: adminMessage,
            createdAt: serverTimestamp(),
            read: false,
            type: "admin_direct"
        });
        setAdminMessage("");
        alert("Transmission Sent.");
    } catch (error) {
        console.error("Error sending message:", error);
        alert("Transmission Failed");
    }
    setSendingMsg(false);
  };

  // 3b. Send Class Message
  const sendClassMessage = async (e) => {
    e.preventDefault();
    if (!classMessageTarget || !classMessage.trim()) return;

    const recipients = students.filter((student) => {
      if (Array.isArray(student.enrolled_classes) && student.enrolled_classes.length > 0) {
        return student.enrolled_classes.includes(classMessageTarget);
      }
      return student.class_id === classMessageTarget;
    });

    if (recipients.length === 0) {
      alert("No students found for that class.");
      return;
    }

    setSendingClassMsg(true);
    try {
      const chunkSize = 400;
      for (let i = 0; i < recipients.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = recipients.slice(i, i + chunkSize);
        chunk.forEach((student) => {
          const alertRef = doc(collection(db, "users", student.id, "alerts"));
          batch.set(alertRef, {
            message: classMessage,
            createdAt: serverTimestamp(),
            read: false,
            type: "admin_class_broadcast",
            class_id: classMessageTarget
          });
        });
        await batch.commit();
      }

      setClassMessage("");
      alert(`Transmission sent to ${recipients.length} students.`);
    } catch (error) {
      console.error("Error sending class message:", error);
      alert("Transmission failed.");
    }
    setSendingClassMsg(false);
  };

  // 4. Redeem Item
  const handleRedeem = async (studentId, itemIndex, currentInventory) => {
    if(!confirm("Mark this item as used and remove it from inventory?")) return;
    const newInventory = [...currentInventory];
    newInventory.splice(itemIndex, 1); 
    try {
        await updateDoc(doc(db, "users", studentId), { inventory: newInventory });
    } catch (error) { 
        console.error("Error redeeming item:", error);
        alert("Error redeeming item");
    }
  };

  // --- FILTERING ---
  const classDirectorySource = classes.length > 0
      ? classes
      : Object.values(CLASS_CODES).map((cls) => ({
          id: cls.id,
          name: cls.name,
          division: cls.division,
          department: cls.department,
          theme_id: cls.theme
      }));

  const filteredStudents = students.filter(student => {
      const name = (student.displayName || student.name || "Unknown").toLowerCase();
      const matchesSearch = name.includes(searchQuery.toLowerCase());
      const matchesClass = filterClass === "all" || student.class_id === filterClass;
      const derivedDivision = student.division || classDirectorySource.find(c => c.id === student.class_id)?.division || "Unassigned";
      const matchesDivision = filterDivision === "all" || derivedDivision === filterDivision;
      return matchesSearch && matchesClass && matchesDivision;
  });

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const selectedStudentJobs = selectedStudent ? jobs.filter(j => j.student_id === selectedStudent.id) : [];
  const selectedClass = classDirectorySource.find((cls) => cls.id === filterClass);
  const classRosterStudents = filterClass === "all"
      ? []
      : students.filter((student) => {
          const inPrimary = student.class_id === filterClass;
          const inActive = student.active_class_id === filterClass;
          const inMulti = Array.isArray(student.class_ids) && student.class_ids.includes(filterClass);
          return inPrimary || inActive || inMulti;
      });

  const getClassName = (id) => classDirectorySource.find(c => c.id === id)?.name || "Unknown Class";
  const getName = (s) => s.name || s.displayName || `Unknown ${labels.student}`;
  const getSubmissionLinks = (job) => {
      const stages = job?.stages || {};
      return Object.entries(stages)
          .map(([num, stage]) => {
              const link = stage?.submission_content || stage?.submission_link || stage?.link || stage?.url;
              if (!link) return null;
              return {
                  stageNum: num,
                  stageName: stage?.name || `Stage ${num}`,
                  status: stage?.status || "submitted",
                  link
              };
          })
          .filter(Boolean);
  };

  const handleExportReport = () => {
      if (!selectedStudent) return;
      setIsExporting(true);

      const classThemeId = classDirectorySource.find((cls) => cls.id === selectedStudent.class_id)?.theme_id;
      const studentThemeId = resolveThemeId(selectedStudent?.theme_id || classThemeId);
      const reportLabels = (THEME_CONFIG[studentThemeId] || THEME_CONFIG.agency).labels;

      const reportWindow = window.open("", "_blank", "width=1024,height=768");
      if (!reportWindow) {
          alert("Popup blocked. Please allow popups to export the report.");
          setIsExporting(false);
          return;
      }

      const logoUrl = `${window.location.origin}/brand/xplabslogo.png`;
      const reportDate = new Date().toLocaleDateString();
      const submissions = selectedStudentJobs.flatMap((job) => {
          const links = getSubmissionLinks(job);
          return links.map((entry) => ({
              contractTitle: job.contract_title || reportLabels.assignment,
              ...entry
          }));
      });

      const submissionRows = submissions.length
          ? submissions.map((entry) => `
              <tr>
                  <td>${entry.contractTitle}</td>
                  <td>${entry.stageNum} - ${entry.stageName}</td>
                  <td>${entry.status}</td>
                  <td><a href="${entry.link}" target="_blank" rel="noreferrer">${entry.link}</a></td>
              </tr>
          `).join("")
          : `<tr><td colspan="4" class="empty">No submissions found.</td></tr>`;

      reportWindow.document.write(`
          <!doctype html>
          <html>
          <head>
              <meta charset="utf-8" />
              <title>${getName(selectedStudent)} Report</title>
              <style>
                  * { box-sizing: border-box; }
                  body { font-family: "Inter", Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; }
                  header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; }
                  header img { height: 42px; }
                  .report-title { font-size: 22px; font-weight: 700; }
                  .report-meta { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
                  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
                  .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; background: #f8fafc; }
                  .card h3 { margin: 0; font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.08em; }
                  .card p { margin: 6px 0 0; font-size: 18px; font-weight: 700; }
                  table { width: 100%; border-collapse: collapse; font-size: 12px; }
                  th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
                  th { text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; color: #64748b; }
                  a { color: #2563eb; word-break: break-all; }
                  .empty { text-align: center; color: #94a3b8; padding: 24px; }
                  .section-title { font-size: 14px; text-transform: uppercase; letter-spacing: 0.12em; color: #475569; margin: 16px 0; }
              </style>
          </head>
          <body>
              <header>
                  <div>
                      <div class="report-title">${getName(selectedStudent)} · ${reportLabels.student} Report</div>
                      <div class="report-meta">${getClassName(selectedStudent.class_id)} · ${reportDate}</div>
                  </div>
                  <img src="${logoUrl}" alt="XP Labs Logo" />
              </header>

              <section class="summary">
                  <div class="card">
                      <h3>${reportLabels.currency}</h3>
                      <p>$${selectedStudent.currency || 0}</p>
                  </div>
                  <div class="card">
                      <h3>${reportLabels.xp}</h3>
                      <p>${selectedStudent.xp || 0}</p>
                  </div>
                  <div class="card">
                      <h3>Active ${reportLabels.assignments}</h3>
                      <p>${selectedStudentJobs.length}</p>
                  </div>
              </section>

              <div class="section-title">Completed Work Links</div>
              <table>
                  <thead>
                      <tr>
                          <th>${reportLabels.assignment}</th>
                          <th>Stage</th>
                          <th>Status</th>
                          <th>Submission Link</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${submissionRows}
                  </tbody>
              </table>
          </body>
          </html>
      `);
      reportWindow.document.close();
      reportWindow.focus();
      setTimeout(() => {
          reportWindow.print();
          setIsExporting(false);
      }, 300);
  };

  const downloadCsv = (rows, filename) => {
      const escapeCell = (value) => {
          if (value === null || value === undefined) return "";
          const stringValue = String(value);
          if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
              return `"${stringValue.replace(/"/g, "\"\"")}"`;
          }
          return stringValue;
      };
      const csvContent = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const exportClassRoster = () => {
      if (filterClass === "all" || classRosterStudents.length === 0) return;
      const rows = [
          ["Name", "Email", "User ID", "Class ID", "Active Class ID", "Class IDs", "Division", "Currency", "XP", "Status"]
      ];
      classRosterStudents.forEach((student) => {
          rows.push([
              getName(student),
              student.email || "",
              student.id,
              student.class_id || "",
              student.active_class_id || "",
              Array.isArray(student.class_ids) ? student.class_ids.join(" | ") : "",
              student.division || "",
              student.currency || 0,
              student.xp || 0,
              student.status || ""
          ]);
      });
      const safeName = (selectedClass?.name || filterClass || "class").replace(/\s+/g, "_");
      downloadCsv(rows, `roster_${safeName}.csv`);
  };

  const archiveClassRoster = async () => {
      if (filterClass === "all" || classRosterStudents.length === 0) return;
      const classLabel = selectedClass?.name || filterClass;
      if (!confirm(`Archive and remove ${classRosterStudents.length} ${labels.student.toLowerCase()} records from ${classLabel}?`)) {
          return;
      }
      setBulkBusy(true);
      const batch = writeBatch(db);
      classRosterStudents.forEach((student) => {
          const updates = {
              archivedAt: new Date().toISOString(),
              archivedClassIds: arrayUnion(filterClass),
              updatedAt: new Date().toISOString()
          };
          const remainingClasses = (
              (student.class_id && student.class_id !== filterClass) ||
              (student.active_class_id && student.active_class_id !== filterClass) ||
              (Array.isArray(student.class_ids) && student.class_ids.some((id) => id !== filterClass))
          );
          if (!remainingClasses) {
              updates.status = "archived";
          }
          if (student.class_id === filterClass) {
              updates.class_id = null;
          }
          if (student.active_class_id === filterClass) {
              updates.active_class_id = null;
          }
          if (Array.isArray(student.class_ids) && student.class_ids.includes(filterClass)) {
              updates.class_ids = arrayRemove(filterClass);
          }
          batch.update(doc(db, "users", student.id), updates);
      });
      try {
          await batch.commit();
          alert(`Archived and removed ${classRosterStudents.length} ${labels.student.toLowerCase()} records.`);
      } catch (error) {
          console.error("Archive roster failed:", error);
          alert("Failed to archive roster.");
      } finally {
          setBulkBusy(false);
      }
  };

  const hardDeleteClassRoster = async () => {
      if (filterClass === "all" || classRosterStudents.length === 0) return;
      const classLabel = selectedClass?.name || filterClass;
      if (confirm("Export the roster CSV before deleting?")) {
          exportClassRoster();
      }
      if (!confirm(`Hard delete ${classRosterStudents.length} ${labels.student.toLowerCase()} records from ${classLabel}? This cannot be undone.`)) {
          return;
      }
      setBulkBusy(true);
      try {
          const batch = writeBatch(db);
          classRosterStudents.forEach((student) => {
              batch.delete(doc(db, "users", student.id));
          });
          await batch.commit();
          alert(`Deleted ${classRosterStudents.length} ${labels.student.toLowerCase()} records.`);
      } catch (error) {
          console.error("Hard delete roster failed:", error);
          alert("Failed to hard delete roster.");
      } finally {
          setBulkBusy(false);
      }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading Roster...</div>;

  // --- VIEW 1: ROSTER LIST ---
  if (!selectedStudentId) {
    return (
        <AdminShell>
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
                    <Users className="text-indigo-600"/> {labels.student} Roster
                </h1>
                <p className="text-slate-500">Select a {labels.student.toLowerCase()} to manage their file.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
                    <input 
                        type="text" 
                        placeholder={`Search ${labels.student.toLowerCase()}...`}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-300 rounded-lg">
                    <Filter size={18} className="text-slate-400" />
                    <select
                        className="bg-transparent font-bold text-slate-700 outline-none"
                        value={filterDivision}
                        onChange={(e) => setFilterDivision(e.target.value)}
                    >
                        <option value="all">All Divisions</option>
                        {Array.from(new Set(classDirectorySource.map(cls => cls.division).filter(Boolean))).sort().map((division) => (
                            <option key={division} value={division}>{division}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-300 rounded-lg">
                    <Filter size={18} className="text-slate-400" />
                    <select 
                        className="bg-transparent font-bold text-slate-700 outline-none"
                        value={filterClass}
                        onChange={(e) => setFilterClass(e.target.value)}
                    >
                        <option value="all">All Classes</option>
                        {classDirectorySource.map((cls) => (
                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                        ))}
                    </select>
                </div>
            </div>
            {filterClass !== "all" && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-slate-700">
                            {selectedClass?.name || filterClass} · {classRosterStudents.length} {labels.student.toLowerCase()}{classRosterStudents.length === 1 ? "" : "s"}
                        </p>
                        <p className="text-xs text-slate-500">Bulk actions apply only to the selected class roster.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={exportClassRoster}
                            className="px-3 py-2 text-xs font-bold uppercase tracking-widest border border-slate-300 rounded-lg text-slate-600 hover:text-slate-900 hover:border-slate-400"
                            disabled={bulkBusy || classRosterStudents.length === 0}
                        >
                            Export CSV
                        </button>
                        <button
                            onClick={archiveClassRoster}
                            className="px-3 py-2 text-xs font-bold uppercase tracking-widest border border-amber-300 rounded-lg text-amber-700 hover:text-amber-900 hover:border-amber-400"
                            disabled={bulkBusy || classRosterStudents.length === 0}
                        >
                            Archive & Remove
                        </button>
                        <button
                            onClick={hardDeleteClassRoster}
                            className="px-3 py-2 text-xs font-bold uppercase tracking-widest border border-rose-300 rounded-lg text-rose-700 hover:text-rose-900 hover:border-rose-400"
                            disabled={bulkBusy || classRosterStudents.length === 0}
                        >
                            Hard Delete
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{labels.student}</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase hidden sm:table-cell">Class</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">{labels.currency}</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">{labels.xp}</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredStudents.map(student => (
                            <tr 
                                key={student.id} 
                                onClick={() => setSelectedStudentId(student.id)}
                                className="hover:bg-indigo-50/50 cursor-pointer transition group"
                            >
                                <td className="px-6 py-4 font-bold text-slate-900 group-hover:text-indigo-700">
                                    {getName(student)}
                                </td>
                                <td className="px-6 py-4 hidden sm:table-cell text-sm text-slate-600">
                                    {getClassName(student.class_id)}
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-bold text-green-600">
                                    ${student.currency || 0}
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-bold text-indigo-600">
                                    {student.xp || 0} {labels.xp}
                                </td>
                                <td className="px-6 py-4 text-right text-slate-400">
                                    <ChevronRight size={18} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
        </AdminShell>
    );
  }

  // --- VIEW 2: PROFILE DETAIL ---
  return (
    <AdminShell>
    <div className="max-w-6xl mx-auto">
        <button 
            onClick={() => setSelectedStudentId(null)}
            className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold mb-6 transition"
        >
            <ArrowLeft size={20}/> Back to Roster
        </button>

        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-lg">
                        {getName(selectedStudent).charAt(0)}
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900">{getName(selectedStudent)}</h1>
                        <p className="text-slate-500 font-medium">{getClassName(selectedStudent.class_id)}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-[10px] uppercase tracking-widest font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                {labels.student} Report
                            </span>
                            <span className="text-[10px] uppercase tracking-widest font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                                {selectedStudent.class_id || "Unassigned"}
                            </span>
                            {selectedStudent.division && (
                                <span className="text-[10px] uppercase tracking-widest font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                                    {selectedStudent.division} Division
                                </span>
                            )}
                            {selectedStudent.divisions && selectedStudent.divisions.length > 0 && (
                                <span className="text-[10px] uppercase tracking-widest font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                                    Divisions: {selectedStudent.divisions.join(", ")}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                            {selectedStudent.badges && Object.keys(selectedStudent.badges).length > 0 ? (
                                Object.keys(selectedStudent.badges).map((badgeId) => {
                                    const badgeDef = availableBadges.find(b => b.id === badgeId);
                                    return (
                                        <span key={badgeId} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded border border-yellow-200 font-bold" title={badgeDef?.title || "Medal"}>
                                            {badgeDef?.title || "🏅"}
                                        </span>
                                    );
                                })
                            ) : (
                                <span className="text-xs text-slate-400 italic">No badges yet.</span>
                            )}
                        </div>
                    </div>
                </div>
            <div className="text-right">
                <p className="text-3xl font-black text-green-600">${selectedStudent.currency || 0}</p>
                <p className="text-xl font-bold text-indigo-600">{selectedStudent.xp || 0} {labels.xp}</p>
                <button
                    onClick={handleExportReport}
                    className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-indigo-600 transition"
                    disabled={isExporting}
                >
                    {isExporting ? "Exporting..." : "Export PDF Report"}
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEFT: INFO & INVENTORY */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* ACTIVE JOBS */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Briefcase className="text-indigo-600" size={20}/> Active {labels.assignments}
                    </h2>
                    {selectedStudentJobs.length === 0 ? <p className="text-slate-400 italic">No active work.</p> : (
                        <div className="space-y-3">
                            {selectedStudentJobs.map(job => (
                                <div key={job.id} className="p-3 border border-slate-100 rounded-lg flex justify-between items-center bg-slate-50">
                                    <span className="font-bold text-slate-700">{job.contract_title}</span>
                                    <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Stage {job.current_stage}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* INVENTORY */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <DollarSign className="text-green-600" size={20}/> Inventory Redemption
                    </h2>
                    <div className="flex flex-wrap gap-3">
                        {(!selectedStudent.inventory || selectedStudent.inventory.length === 0) && (
                            <span className="text-slate-400 italic text-sm">Empty inventory.</span>
                        )}
                        {selectedStudent.inventory?.map((item, idx) => (
                            <button 
                                key={idx}
                                onClick={() => handleRedeem(selectedStudent.id, idx, selectedStudent.inventory)}
                                className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition group"
                            >
                                <span className="font-bold text-sm">{typeof item === 'object' ? item.name : item}</span>
                                <Trash2 size={14} className="text-slate-400 group-hover:text-red-600"/>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* RIGHT: ACTIONS */}
            <div className="lg:col-span-1 space-y-6">
                
                {/* 1. ADJUST FUNDS */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Gavel className="text-slate-600" size={20}/> Adjust Stats
                    </h2>
                    <form onSubmit={handleBonusSubmit} className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">{labels.currency} ($)</label>
                            <input 
                                type="number" 
                                className="w-full border p-2 rounded font-mono mt-1" 
                                value={bonusForm.currency}
                                onChange={e => setBonusForm({...bonusForm, currency: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">{labels.xp}</label>
                            <input 
                                type="number" 
                                className="w-full border p-2 rounded font-mono mt-1" 
                                value={bonusForm.xp}
                                onChange={e => setBonusForm({...bonusForm, xp: e.target.value})}
                            />
                        </div>
                        <button type="submit" className="w-full py-2 bg-slate-900 text-white font-bold rounded hover:bg-slate-800">
                            Apply
                        </button>
                    </form>
                </div>

                {/* 2. GRANT BADGE (DYNAMIC DROPDOWN) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Medal className="text-yellow-500" size={20}/> Grant Badge
                    </h2>
                    <form onSubmit={handleGrantBadge} className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Select Medal</label>
                            <select 
                                className="w-full border p-2 rounded mt-1 text-sm bg-white"
                                value={selectedBadgeId}
                                onChange={e => setSelectedBadgeId(e.target.value)}
                            >
                                <option value="">-- Choose Badge --</option>
                                {/* Map over the availableBadges from Firestore, not the hardcoded list */}
                                {availableBadges.map(badge => (
                                    <option key={badge.id} value={badge.id}>
                                        {badge.title} ({badge.xpReward} {labels.xp})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button 
                            type="submit" 
                            disabled={!selectedBadgeId}
                            className="w-full py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 disabled:opacity-50"
                        >
                            Award Badge
                        </button>
                    </form>
                </div>

                {/* 3. SEND MESSAGE */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <MessageSquare className="text-indigo-600" size={20}/> Send Classified Intel
                    </h2>
                    <form onSubmit={sendDirectMessage} className="space-y-3">
                        <textarea
                            className="w-full p-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            rows="3"
                            placeholder={`Message for ${selectedStudent?.name || "Agent"}...`}
                            value={adminMessage}
                            onChange={(e) => setAdminMessage(e.target.value)}
                        />
                        <button 
                            type="submit" 
                            disabled={sendingMsg || !adminMessage}
                            className="w-full py-2 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-indigo-600 transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {sendingMsg ? "Transmitting..." : <><Send size={14}/> Send Transmission</>}
                        </button>
                    </form>
                </div>

                {/* 4. SEND CLASS MESSAGE */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Send className="text-indigo-600" size={20}/> Send Class Transmission
                    </h2>
                    <form onSubmit={sendClassMessage} className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Select Class</label>
                            <select
                                className="w-full border p-2 rounded mt-1 text-sm bg-white"
                                value={classMessageTarget}
                                onChange={(e) => setClassMessageTarget(e.target.value)}
                            >
                                <option value="">-- Choose Class --</option>
                                {(classes.length > 0 ? classes : classDirectorySource).map((cls) => (
                                    <option key={cls.id} value={cls.id}>
                                        {cls.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <textarea
                            className="w-full p-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            rows="3"
                            placeholder="Message for the entire class..."
                            value={classMessage}
                            onChange={(e) => setClassMessage(e.target.value)}
                        />
                        <button 
                            type="submit" 
                            disabled={sendingClassMsg || !classMessage || !classMessageTarget}
                            className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {sendingClassMsg ? "Transmitting..." : <><Send size={14}/> Send to Class</>}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
    </AdminShell>
  );
}
