import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, orderBy, serverTimestamp, setDoc } from "firebase/firestore";
import {
  Activity,
  Briefcase,
  Clock,
  DollarSign,
  Download,
  FileText,
  Gauge,
  ListChecks,
  PieChart,
  Printer,
  Rocket,
  RotateCcw,
  Save,
  Search,
  TrendingUp,
  Trophy,
  Users
} from "lucide-react";
import AdminShell from "../../components/AdminShell";
import { useAuth } from "../../context/AuthContext";
import { getUserClassIds } from "../../lib/eggEngine";
import { db } from "../../lib/firebase";
import { CLASS_CODES } from "../../lib/gameConfig";
import {
  buildStudentWorkReport,
  formatDateLabel,
  formatDateTimeLabel,
  getStudentCurrency,
  getStudentName,
  getStudentXp,
  isAdminUser,
  itemMatchesClass,
  normalizeClassId,
  studentMatchesClass
} from "../../lib/adminAnalytics";

const READY_STATE = {
  users: false,
  jobs: false,
  contracts: false,
  classes: false,
  missions: false,
  sideHustles: false,
  sideHustleJobs: false,
  productivity: false
};

const getMetricDocId = (classId, studentId) =>
  `${encodeURIComponent(normalizeClassId(classId) || "class")}__${studentId}`;

const clampProductivityScore = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
};

const getEffectiveProductivityScore = (report, metric) => {
  const manualScore = clampProductivityScore(metric?.manualScore);
  if (metric?.productivityMode === "manual" && manualScore !== null) {
    return manualScore;
  }
  return report.autoProductivityScore;
};

const getProductivityModeLabel = (metric) =>
  metric?.productivityMode === "manual" ? "Manual override" : "Auto score";

const getStatusPillClasses = (statusKey) => {
  const normalized = `${statusKey || "not_started"}`.toLowerCase();
  if (normalized === "completed") return "bg-emerald-100 text-emerald-700";
  if (normalized === "pending_review") return "bg-amber-100 text-amber-700";
  if (normalized === "active" || normalized === "in_progress") {
    return "bg-indigo-100 text-indigo-700";
  }
  if (normalized === "returned" || normalized === "rejected") {
    return "bg-rose-100 text-rose-700";
  }
  if (normalized === "scheduled") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-600";
};

const downloadCsv = (rows, filename) => {
  const escapeCell = (value) => {
    if (value === null || value === undefined) return "";
    const stringValue = String(value);
    if (
      stringValue.includes(",")
      || stringValue.includes("\"")
      || stringValue.includes("\n")
    ) {
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

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export default function AdminAnalytics() {
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [classes, setClasses] = useState([]);
  const [missions, setMissions] = useState([]);
  const [sideHustles, setSideHustles] = useState([]);
  const [sideHustleJobs, setSideHustleJobs] = useState([]);
  const [selectedStudentWorkLogs, setSelectedStudentWorkLogs] = useState([]);
  const [productivityMetrics, setProductivityMetrics] = useState([]);
  const [readyState, setReadyState] = useState(READY_STATE);

  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [productivityForm, setProductivityForm] = useState({
    manualScore: "",
    note: ""
  });
  const [savingProductivity, setSavingProductivity] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);

  useEffect(() => {
    const markReady = (key) => {
      setReadyState((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
    };

    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setUsers(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        markReady("users");
      },
      (error) => {
        console.error("AdminAnalytics users listener failed:", error);
        markReady("users");
      }
    );

    const unsubJobs = onSnapshot(
      collection(db, "active_jobs"),
      (snapshot) => {
        setJobs(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        markReady("jobs");
      },
      (error) => {
        console.error("AdminAnalytics active jobs listener failed:", error);
        markReady("jobs");
      }
    );

    const unsubContracts = onSnapshot(
      collection(db, "contracts"),
      (snapshot) => {
        setContracts(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        markReady("contracts");
      },
      (error) => {
        console.error("AdminAnalytics contracts listener failed:", error);
        markReady("contracts");
      }
    );

    const unsubClasses = onSnapshot(
      collection(db, "classes"),
      (snapshot) => {
        setClasses(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        markReady("classes");
      },
      (error) => {
        console.error("AdminAnalytics classes listener failed:", error);
        markReady("classes");
      }
    );

    const unsubMissions = onSnapshot(
      collection(db, "daily_missions"),
      (snapshot) => {
        setMissions(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        markReady("missions");
      },
      (error) => {
        console.error("AdminAnalytics missions listener failed:", error);
        markReady("missions");
      }
    );

    const unsubSideHustles = onSnapshot(
      collection(db, "side_hustles"),
      (snapshot) => {
        setSideHustles(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        markReady("sideHustles");
      },
      (error) => {
        console.error("AdminAnalytics side hustles listener failed:", error);
        markReady("sideHustles");
      }
    );

    const unsubSideHustleJobs = onSnapshot(
      collection(db, "side_hustle_jobs"),
      (snapshot) => {
        setSideHustleJobs(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        markReady("sideHustleJobs");
      },
      (error) => {
        console.error("AdminAnalytics side hustle jobs listener failed:", error);
        markReady("sideHustleJobs");
      }
    );

    const unsubProductivity = onSnapshot(
      collection(db, "admin_student_metrics"),
      (snapshot) => {
        setProductivityMetrics(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        markReady("productivity");
      },
      (error) => {
        console.error("AdminAnalytics productivity listener failed:", error);
        markReady("productivity");
      }
    );

    return () => {
      unsubUsers();
      unsubJobs();
      unsubContracts();
      unsubClasses();
      unsubMissions();
      unsubSideHustles();
      unsubSideHustleJobs();
      unsubProductivity();
    };
  }, []);

  const loading = Object.values(readyState).some((value) => !value);

  const studentUsers = users.filter((entry) => !isAdminUser(entry));

  const classDirectoryMap = {};
  const fallbackClasses = Object.values(CLASS_CODES).map((classEntry) => ({
    id: classEntry.id,
    name: classEntry.name,
    division: classEntry.division,
    department: classEntry.department
  }));

  [...(classes.length > 0 ? classes : fallbackClasses)].forEach((classEntry) => {
    const normalizedId = normalizeClassId(classEntry.id);
    if (!normalizedId) return;
    classDirectoryMap[normalizedId] = {
      id: classEntry.id,
      name: classEntry.name || classEntry.id,
      division: classEntry.division || "Unassigned",
      department: classEntry.department || "",
      theme_id: classEntry.theme_id || classEntry.theme || "agency"
    };
  });

  studentUsers.forEach((student) => {
    getUserClassIds(student).forEach((rawClassId) => {
      const normalizedId = normalizeClassId(rawClassId);
      if (!normalizedId || classDirectoryMap[normalizedId]) return;
      classDirectoryMap[normalizedId] = {
        id: rawClassId,
        name: rawClassId,
        division: "Unassigned",
        department: ""
      };
    });
  });

  const totalMoney = studentUsers.reduce(
    (sum, student) => sum + getStudentCurrency(student),
    0
  );
  const totalXP = studentUsers.reduce((sum, student) => sum + getStudentXp(student), 0);
  const avgLevel = studentUsers.length
    ? Math.floor(totalXP / studentUsers.length / 1000) + 1
    : 1;

  const jobsByStudentId = {};
  jobs.forEach((job) => {
    if (!job?.student_id) return;
    if (!jobsByStudentId[job.student_id]) jobsByStudentId[job.student_id] = [];
    jobsByStudentId[job.student_id].push(job);
  });

  const sideHustleJobsByStudentId = {};
  sideHustleJobs.forEach((job) => {
    if (!job?.student_id) return;
    if (!sideHustleJobsByStudentId[job.student_id]) {
      sideHustleJobsByStudentId[job.student_id] = [];
    }
    sideHustleJobsByStudentId[job.student_id].push(job);
  });

  const productivityByKey = {};
  productivityMetrics.forEach((metric) => {
    const studentId = metric.studentId || metric.userId;
    const classId = metric.classId;
    const normalizedClassId = normalizeClassId(classId);
    if (!studentId || !normalizedClassId) return;
    productivityByKey[`${normalizedClassId}::${studentId}`] = metric;
  });

  const classStats = {};
  studentUsers.forEach((student) => {
    getUserClassIds(student).forEach((rawClassId) => {
      const normalizedId = normalizeClassId(rawClassId);
      if (!normalizedId) return;
      const classEntry = classDirectoryMap[normalizedId] || {
        id: rawClassId,
        name: rawClassId,
        division: "Unassigned"
      };
      if (!classStats[normalizedId]) {
        classStats[normalizedId] = {
          id: classEntry.id,
          name: classEntry.name,
          division: classEntry.division || "Unassigned",
          xp: 0,
          money: 0,
          count: 0
        };
      }
      classStats[normalizedId].xp += getStudentXp(student);
      classStats[normalizedId].money += getStudentCurrency(student);
      classStats[normalizedId].count += 1;
    });
  });

  const classComparison = Object.values(classStats)
    .map((classEntry) => ({
      ...classEntry,
      avgXp: classEntry.count ? Math.floor(classEntry.xp / classEntry.count) : 0
    }))
    .sort((left, right) => right.avgXp - left.avgXp);

  const classComparisonByDivision = classComparison.reduce((accumulator, classEntry) => {
    const division = classEntry.division || "Unassigned";
    if (!accumulator[division]) accumulator[division] = [];
    accumulator[division].push(classEntry);
    return accumulator;
  }, {});

  const maxAvgXp = Math.max(...classComparison.map((classEntry) => classEntry.avgXp), 1);

  const jobCounts = {};
  jobs.forEach((job) => {
    const title = job.contract_title || "Untitled Contract";
    if (!jobCounts[title]) {
      jobCounts[title] = { active: 0, returned: 0, total: 0 };
    }
    jobCounts[title].total += 1;
    if (
      job.status === "in_progress"
      || job.status === "active"
      || job.status === "pending_review"
    ) {
      jobCounts[title].active += 1;
    }
    if (job.status === "returned") {
      jobCounts[title].returned += 1;
    }
  });

  const sortedJobs = Object.entries(jobCounts).sort((left, right) => right[1].total - left[1].total);

  const selectedClassRecord = selectedClassId
    ? classComparison.find(
      (classEntry) => normalizeClassId(classEntry.id) === normalizeClassId(selectedClassId)
    ) || classDirectoryMap[normalizeClassId(selectedClassId)]
    : null;
  const selectedClassName = selectedClassRecord?.name || "Select a Class";

  const studentsInSelectedClass = selectedClassId
    ? studentUsers
      .filter((student) => studentMatchesClass(student, selectedClassId))
      .sort((left, right) => getStudentName(left).localeCompare(getStudentName(right)))
    : [];

  const selectedClassContracts = selectedClassId
    ? contracts.filter((contract) => itemMatchesClass(contract, selectedClassId))
    : [];
  const selectedClassMissions = selectedClassId
    ? missions.filter((mission) => itemMatchesClass(mission, selectedClassId))
    : [];
  const selectedClassSideHustles = selectedClassId
    ? sideHustles.filter((sideHustle) => itemMatchesClass(sideHustle, selectedClassId))
    : [];

  const classStudentEntries = studentsInSelectedClass
    .map((student) => {
      const report = buildStudentWorkReport({
        student,
        classId: selectedClassId,
        contracts,
        missions,
        sideHustles,
        studentJobs: jobsByStudentId[student.id] || [],
        studentSideHustleJobs: sideHustleJobsByStudentId[student.id] || [],
        studentWorkLogs: student.id === selectedStudentId ? selectedStudentWorkLogs : []
      });
      const metric = productivityByKey[`${normalizeClassId(selectedClassId)}::${student.id}`] || null;
      const effectiveProductivityScore = getEffectiveProductivityScore(report, metric);
      return {
        student,
        report,
        metric,
        effectiveProductivityScore
      };
    })
    .sort((left, right) => {
      if (right.effectiveProductivityScore !== left.effectiveProductivityScore) {
        return right.effectiveProductivityScore - left.effectiveProductivityScore;
      }
      if (right.report.completedWorkCount !== left.report.completedWorkCount) {
        return right.report.completedWorkCount - left.report.completedWorkCount;
      }
      return getStudentName(left.student).localeCompare(getStudentName(right.student));
    });

  const filteredStudentEntries = classStudentEntries.filter((entry) =>
    getStudentName(entry.student)
      .toLowerCase()
      .includes(studentSearchQuery.toLowerCase())
  );

  const activeSelectedStudentId = classStudentEntries.some(
    (entry) => entry.student.id === selectedStudentId
  )
    ? selectedStudentId
    : classStudentEntries[0]?.student.id || null;

  const selectedStudentEntry = classStudentEntries.find(
    (entry) => entry.student.id === activeSelectedStudentId
  ) || null;

  useEffect(() => {
    if (!activeSelectedStudentId) {
      setSelectedStudentWorkLogs([]);
      return;
    }

    const workLogQuery = query(
      collection(db, "users", activeSelectedStudentId, "work_logs"),
      orderBy("log_date", "desc")
    );

    const unsub = onSnapshot(
      workLogQuery,
      (snapshot) => {
        setSelectedStudentWorkLogs(snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          studentId: activeSelectedStudentId,
          ...docSnap.data()
        })));
      },
      (error) => {
        console.error("AdminAnalytics selected student work logs listener failed:", error);
        setSelectedStudentWorkLogs([]);
      }
    );

    return () => unsub();
  }, [activeSelectedStudentId]);

  const selectedMetric = selectedStudentEntry?.metric || null;
  const selectedManualScore =
    selectedMetric?.productivityMode === "manual"
      && selectedMetric?.manualScore !== null
      && selectedMetric?.manualScore !== undefined
      ? String(selectedMetric.manualScore)
      : "";
  const selectedManualNote = selectedMetric?.note || "";

  useEffect(() => {
    setProductivityForm({
      manualScore: selectedManualScore,
      note: selectedManualNote
    });
  }, [activeSelectedStudentId, selectedClassId, selectedManualNote, selectedManualScore]);

  const selectedClassAverageProductivity = classStudentEntries.length
    ? Math.round(
      classStudentEntries.reduce(
        (sum, entry) => sum + entry.effectiveProductivityScore,
        0
      ) / classStudentEntries.length
    )
    : 0;
  const selectedClassCompletedWork = classStudentEntries.reduce(
    (sum, entry) => sum + entry.report.completedWorkCount,
    0
  );
  const selectedClassAvailableWork = classStudentEntries.reduce(
    (sum, entry) => sum + entry.report.availableWorkCount,
    0
  );

  const handleSaveManualProductivity = async () => {
    if (!selectedStudentEntry || !selectedClassId) return;
    const manualScore = clampProductivityScore(productivityForm.manualScore);
    if (manualScore === null) {
      alert("Enter a manual productivity score between 0 and 100.");
      return;
    }

    setSavingProductivity(true);
    try {
      await setDoc(
        doc(
          db,
          "admin_student_metrics",
          getMetricDocId(selectedClassId, selectedStudentEntry.student.id)
        ),
        {
          userId: selectedStudentEntry.student.id,
          studentId: selectedStudentEntry.student.id,
          studentName: getStudentName(selectedStudentEntry.student),
          classId: selectedClassId,
          className: selectedClassName,
          productivityMode: "manual",
          manualScore,
          note: productivityForm.note.trim(),
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || null
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Saving manual productivity failed:", error);
      alert("Could not save the manual productivity score.");
    } finally {
      setSavingProductivity(false);
    }
  };

  const handleResetProductivity = async () => {
    if (!selectedStudentEntry || !selectedClassId) return;

    setSavingProductivity(true);
    try {
      await setDoc(
        doc(
          db,
          "admin_student_metrics",
          getMetricDocId(selectedClassId, selectedStudentEntry.student.id)
        ),
        {
          userId: selectedStudentEntry.student.id,
          studentId: selectedStudentEntry.student.id,
          studentName: getStudentName(selectedStudentEntry.student),
          classId: selectedClassId,
          className: selectedClassName,
          productivityMode: "auto",
          manualScore: null,
          note: "",
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || null
        },
        { merge: true }
      );
      setProductivityForm({ manualScore: "", note: "" });
    } catch (error) {
      console.error("Resetting productivity score failed:", error);
      alert("Could not switch this student back to the auto productivity score.");
    } finally {
      setSavingProductivity(false);
    }
  };

  const handleDownloadStudentCsv = () => {
    if (!selectedStudentEntry || !selectedClassId) return;
    const { student, report, effectiveProductivityScore } = selectedStudentEntry;
    const rows = [
      ["Student Report"],
      ["Name", getStudentName(student)],
      ["Email", student.email || ""],
      ["Class", selectedClassName],
      ["Productivity Score", effectiveProductivityScore],
      ["Score Mode", getProductivityModeLabel(selectedStudentEntry.metric)],
      ["Auto Score", report.autoProductivityScore],
      ["Manual Score", selectedStudentEntry.metric?.manualScore ?? ""],
      ["Productivity Note", selectedStudentEntry.metric?.note || ""],
      ["XP", getStudentXp(student)],
      ["Currency", getStudentCurrency(student)],
      [
        "Completed Work",
        `${report.completedWorkCount}/${report.availableWorkCount}`
      ],
      [],
      ["Contracts"],
      [
        "Title",
        "Status",
        "Completed",
        "Progress",
        "Current Stage",
        "Started At",
        "Last Submitted",
        "Completed At",
        "Submission Links"
      ],
      ...report.contractRows.map((row) => [
        row.title,
        row.statusLabel,
        row.completed ? "Yes" : "No",
        row.progressLabel,
        row.currentStageLabel,
        formatDateTimeLabel(row.startedAt),
        formatDateTimeLabel(row.lastSubmittedAt),
        formatDateTimeLabel(row.completedAt),
        row.submissionLinks.map((link) => link.link).join(" | ")
      ]),
      [],
      ["Missions"],
      ["Title", "Active Date", "Status", "Completed", "Reward XP", "Reward Cash"],
      ...report.missionRows.map((row) => [
        row.title,
        row.activeDate || "",
        row.statusLabel,
        row.completed ? "Yes" : "No",
        row.rewardXp,
        row.rewardCash
      ]),
      [],
      ["Side Hustles"],
      [
        "Title",
        "Status",
        "Completed",
        "Completedness",
        "Current Level",
        "Completed Count",
        "Last Submitted",
        "Last Approved"
      ],
      ...report.sideHustleRows.map((row) => [
        row.title,
        row.statusLabel,
        row.completed ? "Yes" : "No",
        row.progressLabel,
        row.currentLevel,
        row.completedCount,
        formatDateTimeLabel(row.lastSubmittedAt),
        formatDateTimeLabel(row.lastApprovedAt)
      ])
    ];

    const safeName = getStudentName(student).replace(/\s+/g, "_").toLowerCase();
    downloadCsv(rows, `${safeName}_${normalizeClassId(selectedClassId)}_report.csv`);
  };

  const handleDownloadClassCsv = () => {
    if (!selectedClassId || classStudentEntries.length === 0) return;

    const rows = [
      ["Class Report"],
      ["Class", selectedClassName],
      ["Exported", new Date().toLocaleString()],
      ["Student Count", classStudentEntries.length],
      [],
      ["Student Summary"],
      [
        "Student",
        "Email",
        "Productivity Score",
        "Score Mode",
        "Auto Score",
        "Manual Score",
        "XP",
        "Currency",
        "Completed Work",
        "Contracts Completed",
        "Missions Completed",
        "Side Hustles Completed",
        "Productivity Note"
      ]
    ];

    classStudentEntries.forEach((entry) => {
      rows.push([
        getStudentName(entry.student),
        entry.student.email || "",
        entry.effectiveProductivityScore,
        getProductivityModeLabel(entry.metric),
        entry.report.autoProductivityScore,
        entry.metric?.manualScore ?? "",
        getStudentXp(entry.student),
        getStudentCurrency(entry.student),
        `${entry.report.completedWorkCount}/${entry.report.availableWorkCount}`,
        `${entry.report.contractCompletedCount}/${entry.report.contractRows.length}`,
        `${entry.report.missionCompletedCount}/${entry.report.missionRows.length}`,
        `${entry.report.sideHustleCompletedCount}/${entry.report.sideHustleRows.length}`,
        entry.metric?.note || ""
      ]);
    });

    rows.push([]);
    rows.push(["Detailed Activity"]);
    rows.push([
      "Student",
      "Email",
      "Work Type",
      "Title",
      "Status",
      "Completed",
      "Progress",
      "Current Stage / Level",
      "Active Date",
      "Started At",
      "Last Submitted",
      "Last Completed / Approved",
      "Links"
    ]);

    classStudentEntries.forEach((entry) => {
      const studentName = getStudentName(entry.student);
      const studentEmail = entry.student.email || "";

      entry.report.contractRows.forEach((row) => {
        rows.push([
          studentName,
          studentEmail,
          "contract",
          row.title,
          row.statusLabel,
          row.completed ? "Yes" : "No",
          row.progressLabel,
          row.currentStageLabel,
          "",
          formatDateTimeLabel(row.startedAt),
          formatDateTimeLabel(row.lastSubmittedAt),
          formatDateTimeLabel(row.completedAt),
          row.submissionLinks.map((link) => link.link).join(" | ")
        ]);
      });

      entry.report.missionRows.forEach((row) => {
        rows.push([
          studentName,
          studentEmail,
          "mission",
          row.title,
          row.statusLabel,
          row.completed ? "Yes" : "No",
          row.completed ? "1/1 complete" : row.statusLabel === "Scheduled" ? "Scheduled" : "0/1 complete",
          "",
          row.activeDate || "",
          "",
          "",
          "",
          ""
        ]);
      });

      entry.report.sideHustleRows.forEach((row) => {
        rows.push([
          studentName,
          studentEmail,
          "side_hustle",
          row.title,
          row.statusLabel,
          row.completed ? "Yes" : "No",
          row.progressLabel,
          `Level ${row.currentLevel}`,
          "",
          "",
          formatDateTimeLabel(row.lastSubmittedAt),
          formatDateTimeLabel(row.lastApprovedAt),
          row.job?.submission_link || ""
        ]);
      });

      rows.push([]);
    });

    const safeClassName = selectedClassName.replace(/\s+/g, "_").toLowerCase();
    downloadCsv(rows, `${safeClassName}_class_report.csv`);
  };

  const handlePrintStudentReport = () => {
    if (!selectedStudentEntry || !selectedClassId) return;
    const { student, report, effectiveProductivityScore } = selectedStudentEntry;
    const reportWindow = window.open("", "_blank", "width=1120,height=900");
    if (!reportWindow) {
      alert("Popup blocked. Please allow popups to export the report.");
      return;
    }

    setExportingReport(true);

    const contractRowsMarkup = report.contractRows.length
      ? report.contractRows.map((row) => `
          <tr>
            <td>${escapeHtml(row.title)}</td>
            <td>${escapeHtml(row.statusLabel)}</td>
            <td>${escapeHtml(row.progressLabel)}</td>
            <td>${escapeHtml(row.currentStageLabel)}</td>
            <td>${escapeHtml(formatDateTimeLabel(row.lastSubmittedAt || row.completedAt || row.startedAt))}</td>
            <td>${row.submissionLinks.length
              ? row.submissionLinks
                .map((link) =>
                  `<a href="${escapeHtml(link.link)}" target="_blank" rel="noreferrer">${escapeHtml(link.stageName)}</a>`
                )
                .join("<br/>")
              : '<span class="muted">No links</span>'}</td>
          </tr>
        `).join("")
      : '<tr><td colspan="6" class="empty">No contract activity found.</td></tr>';

    const missionRowsMarkup = report.missionRows.length
      ? report.missionRows.map((row) => `
          <tr>
            <td>${escapeHtml(row.title)}</td>
            <td>${escapeHtml(row.activeDate || "-")}</td>
            <td>${escapeHtml(row.statusLabel)}</td>
            <td>${row.completed ? "Yes" : "No"}</td>
            <td>${row.rewardXp}</td>
            <td>$${row.rewardCash}</td>
          </tr>
        `).join("")
      : '<tr><td colspan="6" class="empty">No class missions found.</td></tr>';

    const sideHustleRowsMarkup = report.sideHustleRows.length
      ? report.sideHustleRows.map((row) => `
          <tr>
            <td>${escapeHtml(row.title)}</td>
            <td>${escapeHtml(row.statusLabel)}</td>
            <td>${escapeHtml(row.progressLabel)}</td>
            <td>${row.currentLevel}</td>
            <td>${row.completedCount}</td>
            <td>${escapeHtml(formatDateTimeLabel(row.lastApprovedAt || row.lastSubmittedAt))}</td>
          </tr>
        `).join("")
      : '<tr><td colspan="6" class="empty">No side hustles found for this class.</td></tr>';

    reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(getStudentName(student))} Report</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: "Inter", Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; background: #f8fafc; }
            header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; }
            h1 { font-size: 28px; margin: 0 0 4px; }
            .meta { color: #64748b; font-size: 13px; line-height: 1.5; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
            .card { border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; background: white; }
            .card h3 { margin: 0; font-size: 12px; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase; }
            .card p { margin: 8px 0 0; font-size: 26px; font-weight: 800; }
            .section { margin-top: 26px; }
            .section h2 { font-size: 16px; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 12px; }
            .note { margin-top: 8px; color: #475569; font-size: 13px; }
            .muted { color: #94a3b8; }
            table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }
            th, td { padding: 10px 12px; text-align: left; font-size: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
            th { background: #f8fafc; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
            td a { color: #2563eb; word-break: break-all; }
            .empty { text-align: center; color: #94a3b8; padding: 20px; }
          </style>
        </head>
        <body>
          <header>
            <div>
              <h1>${escapeHtml(getStudentName(student))}</h1>
              <div class="meta">
                ${escapeHtml(selectedClassName)}<br/>
                ${escapeHtml(student.email || "No email on file")}<br/>
                Exported ${escapeHtml(new Date().toLocaleString())}
              </div>
            </div>
            <div class="meta">
              Productivity Mode: ${escapeHtml(getProductivityModeLabel(selectedStudentEntry.metric))}<br/>
              Auto Score: ${report.autoProductivityScore}<br/>
              Manual Score: ${selectedStudentEntry.metric?.manualScore ?? "-"}
            </div>
          </header>

          <section class="grid">
            <div class="card">
              <h3>Productivity</h3>
              <p>${effectiveProductivityScore}</p>
            </div>
            <div class="card">
              <h3>Completed Work</h3>
              <p>${report.completedWorkCount}/${report.availableWorkCount}</p>
            </div>
            <div class="card">
              <h3>XP</h3>
              <p>${getStudentXp(student).toLocaleString()}</p>
            </div>
            <div class="card">
              <h3>Currency</h3>
              <p>$${getStudentCurrency(student).toLocaleString()}</p>
            </div>
          </section>

          ${selectedStudentEntry.metric?.note
            ? `<div class="note"><strong>Admin Note:</strong> ${escapeHtml(selectedStudentEntry.metric.note)}</div>`
            : ""}

          <section class="section">
            <h2>Contracts</h2>
            <table>
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Current Stage</th>
                  <th>Latest Activity</th>
                  <th>Submission Links</th>
                </tr>
              </thead>
              <tbody>
                ${contractRowsMarkup}
              </tbody>
            </table>
          </section>

          <section class="section">
            <h2>Missions</h2>
            <table>
              <thead>
                <tr>
                  <th>Mission</th>
                  <th>Active Date</th>
                  <th>Status</th>
                  <th>Completed</th>
                  <th>Reward XP</th>
                  <th>Reward Cash</th>
                </tr>
              </thead>
              <tbody>
                ${missionRowsMarkup}
              </tbody>
            </table>
          </section>

          <section class="section">
            <h2>Side Hustles</h2>
            <table>
              <thead>
                <tr>
                  <th>Side Hustle</th>
                  <th>Status</th>
                  <th>Completedness</th>
                  <th>Current Level</th>
                  <th>Completed Count</th>
                  <th>Latest Activity</th>
                </tr>
              </thead>
              <tbody>
                ${sideHustleRowsMarkup}
              </tbody>
            </table>
          </section>
        </body>
      </html>
    `);

    reportWindow.document.close();
    reportWindow.focus();
    setTimeout(() => {
      reportWindow.print();
      setExportingReport(false);
    }, 250);
  };

  if (loading) {
    return (
      <AdminShell>
        <div className="max-w-7xl mx-auto pb-20">
          <div className="p-12 text-center text-slate-500">Crunching numbers...</div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto pb-20">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
            <TrendingUp className="text-indigo-600" />
            Agency Analytics
          </h1>
          <p className="text-slate-500">
            Drill from class performance into a printable student-by-student work report.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total GDP</p>
            <h2 className="text-4xl font-black text-green-600 mt-2 flex items-center gap-1">
              <DollarSign size={28} />
              {totalMoney.toLocaleString()}
            </h2>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Knowledge</p>
            <h2 className="text-4xl font-black text-indigo-600 mt-2 flex items-center gap-1">
              <Trophy size={28} />
              {totalXP.toLocaleString()}
            </h2>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Seniority</p>
            <h2 className="text-4xl font-black text-slate-700 mt-2">Level {avgLevel}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Users size={20} className="text-indigo-500" />
                Class Performance
              </h3>
              <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded uppercase">
                Click a class to drill down
              </span>
            </div>
            <div className="space-y-6">
              {Object.entries(classComparisonByDivision).map(([division, divisionClasses]) => (
                <div key={division} className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    {division} Division
                  </div>
                  {divisionClasses.map((classEntry) => {
                    const isSelected =
                      normalizeClassId(selectedClassId) === normalizeClassId(classEntry.id);
                    return (
                      <button
                        key={classEntry.id}
                        type="button"
                        onClick={() => {
                          const nextSelected = isSelected ? null : classEntry.id;
                          setSelectedClassId(nextSelected);
                          setSelectedStudentId(null);
                          setStudentSearchQuery("");
                        }}
                        className={`w-full text-left cursor-pointer transition ${
                          isSelected ? "opacity-100" : "hover:opacity-80"
                        }`}
                      >
                        <div className="flex justify-between text-sm font-bold mb-1">
                          <span className={isSelected ? "text-indigo-700" : "text-slate-700"}>
                            {classEntry.name}
                          </span>
                          <span className="text-indigo-600">{classEntry.avgXp} XP Avg</span>
                        </div>
                        <div
                          className={`w-full h-4 rounded-full overflow-hidden ${
                            isSelected
                              ? "ring-2 ring-indigo-300 ring-offset-1"
                              : "bg-slate-100"
                          }`}
                        >
                          <div
                            className={`h-full transition-all duration-500 ${
                              isSelected ? "bg-indigo-600" : "bg-indigo-400"
                            }`}
                            style={{ width: `${(classEntry.avgXp / maxAvgXp) * 100}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
              <PieChart size={20} className="text-orange-500" />
              Contract Popularity
            </h3>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {sortedJobs.map(([title, stats], index) => (
                <div
                  key={title}
                  className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0"
                >
                  <div>
                    <p
                      className="font-bold text-slate-800 text-sm truncate max-w-[240px]"
                      title={title}
                    >
                      {title}
                    </p>
                    <div className="flex gap-3 text-xs mt-1">
                      <span className="text-green-600 font-bold">{stats.active} Active</span>
                      <span className="text-red-400 font-bold">{stats.returned} Returns</span>
                    </div>
                  </div>
                  <span className="text-xl font-black text-slate-200">#{index + 1}</span>
                </div>
              ))}
              {sortedJobs.length === 0 && (
                <p className="text-slate-400 italic">No contracts started.</p>
              )}
            </div>
          </div>
        </div>

        {selectedClassId && (
          <div className="bg-white rounded-xl shadow-lg border border-indigo-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-indigo-50/50 p-6 border-b border-indigo-100">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                    <Activity className="text-indigo-600" />
                    {selectedClassName} Student Work
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    {studentsInSelectedClass.length} students, {selectedClassContracts.length} contracts,
                    {" "}
                    {selectedClassMissions.length} missions, {selectedClassSideHustles.length} side hustles
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadClassCsv()}
                    disabled={classStudentEntries.length === 0}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download size={16} />
                    Class CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadStudentCsv()}
                    disabled={!selectedStudentEntry}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download size={16} />
                    Student CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintStudentReport()}
                    disabled={!selectedStudentEntry || exportingReport}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Printer size={16} />
                    {exportingReport ? "Preparing..." : "Print Report"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClassId(null);
                      setSelectedStudentId(null);
                      setStudentSearchQuery("");
                    }}
                    className="text-sm font-bold text-slate-400 hover:text-indigo-600"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-white rounded-xl border border-indigo-100 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Avg Productivity
                  </p>
                  <p className="text-2xl font-black text-slate-900 mt-2">
                    {selectedClassAverageProductivity}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-indigo-100 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Completed Work
                  </p>
                  <p className="text-2xl font-black text-slate-900 mt-2">
                    {selectedClassCompletedWork}/{selectedClassAvailableWork}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-indigo-100 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Active Reports
                  </p>
                  <p className="text-2xl font-black text-slate-900 mt-2">
                    {classStudentEntries.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[320px,minmax(0,1fr)]">
              <aside className="border-r border-slate-200 bg-slate-50/70 p-4">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(event) => setStudentSearchQuery(event.target.value)}
                    placeholder="Find a student..."
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>

                <div className="space-y-3 max-h-[980px] overflow-y-auto pr-1">
                  {filteredStudentEntries.map((entry) => {
                    const isSelected = entry.student.id === activeSelectedStudentId;
                    return (
                      <button
                        key={entry.student.id}
                        type="button"
                        onClick={() => setSelectedStudentId(entry.student.id)}
                        className={`w-full text-left rounded-xl border p-4 transition ${
                          isSelected
                            ? "border-indigo-300 bg-white shadow-sm"
                            : "border-slate-200 bg-white/70 hover:border-indigo-200 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">
                              {getStudentName(entry.student)}
                            </p>
                            <p className="text-xs text-slate-500 truncate mt-1">
                              {entry.report.completedWorkCount}/{entry.report.availableWorkCount} work items complete
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-black text-indigo-600">
                              {entry.effectiveProductivityScore}
                            </p>
                            <p className="text-[11px] uppercase tracking-wider text-slate-400">
                              {entry.metric?.productivityMode === "manual" ? "Manual" : "Auto"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${entry.effectiveProductivityScore}%` }}
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>{getStudentXp(entry.student).toLocaleString()} XP</span>
                          <span>${getStudentCurrency(entry.student).toLocaleString()}</span>
                        </div>
                      </button>
                    );
                  })}

                  {filteredStudentEntries.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
                      No students match that search.
                    </div>
                  )}
                </div>
              </aside>

              <div className="p-6">
                {selectedStudentEntry ? (
                  <>
                    <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900">
                          {getStudentName(selectedStudentEntry.student)}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                          {selectedStudentEntry.student.email || "No email on file"} · {selectedClassName}
                        </p>
                      </div>
                      <div className="text-left xl:text-right">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                          {getProductivityModeLabel(selectedStudentEntry.metric)}
                        </p>
                        <p className="text-3xl font-black text-indigo-600 mt-1">
                          {selectedStudentEntry.effectiveProductivityScore}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Auto score: {selectedStudentEntry.report.autoProductivityScore}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <Gauge size={14} className="text-indigo-500" />
                          Productivity
                        </p>
                        <p className="text-3xl font-black text-slate-900 mt-3">
                          {selectedStudentEntry.effectiveProductivityScore}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                          {selectedStudentEntry.report.completedWorkCount}/{selectedStudentEntry.report.availableWorkCount} completed work items
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <Briefcase size={14} className="text-indigo-500" />
                          Contracts
                        </p>
                        <p className="text-3xl font-black text-slate-900 mt-3">
                          {selectedStudentEntry.report.contractCompletedCount}/{selectedStudentEntry.report.contractRows.length}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">Completed contracts in this class</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <ListChecks size={14} className="text-indigo-500" />
                          Missions
                        </p>
                        <p className="text-3xl font-black text-slate-900 mt-3">
                          {selectedStudentEntry.report.missionCompletedCount}/{selectedStudentEntry.report.missionRows.length}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">Completed class missions</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <Rocket size={14} className="text-indigo-500" />
                          Side Hustles
                        </p>
                        <p className="text-3xl font-black text-slate-900 mt-3">
                          {selectedStudentEntry.report.sideHustleCompletedCount}/{selectedStudentEntry.report.sideHustleRows.length}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">Completed class side hustles</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <Trophy size={14} className="text-amber-500" />
                          Experience
                        </p>
                        <p className="text-3xl font-black text-slate-900 mt-3">
                          {getStudentXp(selectedStudentEntry.student).toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <DollarSign size={14} className="text-green-500" />
                          Currency
                        </p>
                        <p className="text-3xl font-black text-slate-900 mt-3">
                          ${getStudentCurrency(selectedStudentEntry.student).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 mb-6">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                        <div>
                          <h4 className="font-bold text-slate-900">Productivity Override</h4>
                          <p className="text-sm text-slate-500 mt-1">
                            Auto score is backfilled from completed contracts, missions, and side hustles for this class.
                          </p>
                        </div>
                        {selectedStudentEntry.metric?.updatedAt && (
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <Clock size={14} />
                            Updated {formatDateTimeLabel(selectedStudentEntry.metric.updatedAt)}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-[180px,minmax(0,1fr)] gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                            Manual Score
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={productivityForm.manualScore}
                            onChange={(event) =>
                              setProductivityForm((prev) => ({
                                ...prev,
                                manualScore: event.target.value
                              }))
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            placeholder="0-100"
                          />
                          <p className="text-xs text-slate-500 mt-2">
                            Auto score: {selectedStudentEntry.report.autoProductivityScore}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                            Admin Note
                          </label>
                          <textarea
                            rows="4"
                            value={productivityForm.note}
                            onChange={(event) =>
                              setProductivityForm((prev) => ({
                                ...prev,
                                note: event.target.value
                              }))
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                            placeholder="Optional context for why this score was adjusted."
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 mt-4">
                        <button
                          type="button"
                          onClick={handleSaveManualProductivity}
                          disabled={savingProductivity}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Save size={16} />
                          {savingProductivity ? "Saving..." : "Save Manual Override"}
                        </button>
                        <button
                          type="button"
                          onClick={handleResetProductivity}
                          disabled={savingProductivity}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RotateCcw size={16} />
                          Use Auto Score
                        </button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText size={18} className="text-indigo-500" />
                            <h4 className="font-bold text-slate-900">Contracts</h4>
                          </div>
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                            {selectedStudentEntry.report.contractRows.length} total
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-widest">
                              <tr>
                                <th className="px-4 py-3 text-left">Contract</th>
                                <th className="px-4 py-3 text-left">Status</th>
                                <th className="px-4 py-3 text-left">Progress</th>
                                <th className="px-4 py-3 text-left">Current Stage</th>
                                <th className="px-4 py-3 text-left">Latest Activity</th>
                                <th className="px-4 py-3 text-left">Submission Links</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedStudentEntry.report.contractRows.map((row) => (
                                <tr key={row.id} className="border-t border-slate-100 align-top">
                                  <td className="px-4 py-4">
                                    <div className="font-semibold text-slate-900">{row.title}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      Started {formatDateTimeLabel(row.startedAt)}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <span
                                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getStatusPillClasses(row.statusKey)}`}
                                    >
                                      {row.statusLabel}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="font-semibold text-slate-900">{row.progressLabel}</div>
                                    <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-indigo-500"
                                        style={{ width: `${row.progressPercent}%` }}
                                      />
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-slate-600">{row.currentStageLabel}</td>
                                  <td className="px-4 py-4 text-slate-600">
                                    {formatDateTimeLabel(row.lastSubmittedAt || row.completedAt || row.startedAt)}
                                  </td>
                                  <td className="px-4 py-4">
                                    {row.submissionLinks.length > 0 ? (
                                      <div className="space-y-2">
                                        {row.submissionLinks.map((link) => (
                                          <a
                                            key={`${row.id}-${link.stageNumber}`}
                                            href={link.link}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block text-indigo-600 hover:text-indigo-700 break-all"
                                          >
                                            {link.stageName}
                                          </a>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400">No links</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {selectedStudentEntry.report.contractRows.length === 0 && (
                                <tr>
                                  <td
                                    colSpan="6"
                                    className="px-4 py-8 text-center text-slate-400 italic"
                                  >
                                    No class contracts found.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </section>

                      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ListChecks size={18} className="text-indigo-500" />
                            <h4 className="font-bold text-slate-900">Missions</h4>
                          </div>
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                            {selectedStudentEntry.report.missionRows.length} total
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-widest">
                              <tr>
                                <th className="px-4 py-3 text-left">Mission</th>
                                <th className="px-4 py-3 text-left">Active Date</th>
                                <th className="px-4 py-3 text-left">Status</th>
                                <th className="px-4 py-3 text-left">Rewards</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedStudentEntry.report.missionRows.map((row) => (
                                <tr key={row.id} className="border-t border-slate-100">
                                  <td className="px-4 py-4 font-semibold text-slate-900">{row.title}</td>
                                  <td className="px-4 py-4 text-slate-600">
                                    {row.activeDate ? formatDateLabel(`${row.activeDate}T12:00:00`) : "-"}
                                  </td>
                                  <td className="px-4 py-4">
                                    <span
                                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getStatusPillClasses(row.statusKey)}`}
                                    >
                                      {row.statusLabel}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 text-slate-600">
                                    +{row.rewardXp} XP / ${row.rewardCash}
                                  </td>
                                </tr>
                              ))}
                              {selectedStudentEntry.report.missionRows.length === 0 && (
                                <tr>
                                  <td
                                    colSpan="4"
                                    className="px-4 py-8 text-center text-slate-400 italic"
                                  >
                                    No class missions found.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </section>

                      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Rocket size={18} className="text-indigo-500" />
                            <h4 className="font-bold text-slate-900">Side Hustles</h4>
                          </div>
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                            {selectedStudentEntry.report.sideHustleRows.length} total
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-widest">
                              <tr>
                                <th className="px-4 py-3 text-left">Side Hustle</th>
                                <th className="px-4 py-3 text-left">Status</th>
                                <th className="px-4 py-3 text-left">Completedness</th>
                                <th className="px-4 py-3 text-left">Current Level</th>
                                <th className="px-4 py-3 text-left">Latest Activity</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedStudentEntry.report.sideHustleRows.map((row) => (
                                <tr key={row.id} className="border-t border-slate-100">
                                  <td className="px-4 py-4">
                                    <div className="font-semibold text-slate-900">{row.title}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      Completed count: {row.completedCount}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <span
                                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getStatusPillClasses(row.statusKey)}`}
                                    >
                                      {row.statusLabel}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 text-slate-600">{row.progressLabel}</td>
                                  <td className="px-4 py-4 text-slate-600">Level {row.currentLevel}</td>
                                  <td className="px-4 py-4 text-slate-600">
                                    {formatDateTimeLabel(row.lastApprovedAt || row.lastSubmittedAt)}
                                  </td>
                                </tr>
                              ))}
                              {selectedStudentEntry.report.sideHustleRows.length === 0 && (
                                <tr>
                                  <td
                                    colSpan="5"
                                    className="px-4 py-8 text-center text-slate-400 italic"
                                  >
                                    No class side hustles found.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </section>

                      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText size={18} className="text-indigo-500" />
                            <h4 className="font-bold text-slate-900">Daily Work Logs</h4>
                          </div>
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                            {selectedStudentEntry.report.workLogRows.length} total
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-widest">
                              <tr>
                                <th className="px-4 py-3 text-left">Date</th>
                                <th className="px-4 py-3 text-left">Prompt</th>
                                <th className="px-4 py-3 text-left">Entries</th>
                                <th className="px-4 py-3 text-left">Links</th>
                                <th className="px-4 py-3 text-left">Reward</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedStudentEntry.report.workLogRows.map((row) => (
                                <tr key={row.id} className="border-t border-slate-100 align-top">
                                  <td className="px-4 py-4 text-slate-600">
                                    {row.logDate ? formatDateLabel(`${row.logDate}T12:00:00`) : "-"}
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="font-semibold text-slate-900">{row.title}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      Submitted {formatDateTimeLabel(row.submittedAt)}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="space-y-2">
                                      {row.entries.map((entry, index) => (
                                        <div key={`${row.id}-${index}`} className="text-slate-600">
                                          <div className="font-semibold text-slate-800">
                                            {entry.title || `Work Item ${index + 1}`}
                                          </div>
                                          <div className="text-xs text-slate-500 whitespace-pre-wrap">
                                            {entry.notes}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="space-y-2">
                                      {row.entries.some((entry) => entry.evidence_link) ? row.entries.map((entry, index) => (
                                        entry.evidence_link ? (
                                          <a
                                            key={`${row.id}-link-${index}`}
                                            href={entry.evidence_link}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block text-indigo-600 hover:text-indigo-700 break-all"
                                          >
                                            {entry.title || `Link ${index + 1}`}
                                          </a>
                                        ) : null
                                      )) : (
                                        <span className="text-slate-400">No links</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-slate-600">
                                    +{row.rewardXp} XP / ${row.rewardCash}
                                  </td>
                                </tr>
                              ))}
                              {selectedStudentEntry.report.workLogRows.length === 0 && (
                                <tr>
                                  <td
                                    colSpan="5"
                                    className="px-4 py-8 text-center text-slate-400 italic"
                                  >
                                    No daily work logs found.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                    <p className="text-lg font-bold text-slate-700">Select a student</p>
                    <p className="text-sm text-slate-500 mt-2">
                      Choose a student from the class list to load contract, mission, and side hustle history.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
