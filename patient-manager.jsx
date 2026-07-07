/**
 * CHANGELOG (patient-manager.jsx / patient-manager.html — must stay in sync)
 * 1.0  גרסת בסיס
 * 1.1  תוכנית טיפול/יעדים, תבניות תיעוד לפי סוג פגישה, הוספה ל-Google Calendar
 * 1.2  שדה אימייל, "העתקת פרטי חיוב"/שליחה במייל בתיק האישי, גרף מגמת הכנסה
 * 1.3  בדיקת התנגשות לפי חפיפת טווחי זמן (במקום התאמת שעה מדויקת) + שדה משך פגישה (ברירת מחדל 60 דק')
 * 1.4  הסרת window.alert האחרון בקוד — הוחלף במודל אישור פנימי (InfoModal)
 * 1.5  הוספת ה-CHANGELOG הזה בלבד
 * 1.6  תיקון באג קריטי בנייד: main-area הוסתר לא נכון והצטופף עם רשימת המטופלים (Override ב-CSS דרס הסתרה תקינה), מה שמנע גלילה/לחיצה על אינדקס האותיות
 * 1.7  מסך כניסה עם סיסמה (AuthGate, הגנה בסיסית בלבד — לא הצפנה) + מסך פתיח עם שם ריקי, כפתורי נעילה/שינוי סיסמה בכותרת
 * 1.8  גיבוי/שחזור ידני (JSON) עם מיזוג בטוח לפי updatedAt — לעולם לא מוחק מטופלים/פגישות קיימים, רק ממזג ומעדכן
 * 1.9  תמיכת PWA (manifest.json, sw.js, אייקונים) נוספה לגרסת ה-HTML המתארחת בלבד — לא רלוונטי לקובץ הזה (jsx), רק עלייה במספר הגרסה לצורך אחידות
 * 2.0  גרסת ה-HTML עברה לסנכרון ענן אמיתי (Firebase: Firestore + Authentication) במקום localStorage — שינוי ארכיטקטוני שלא רלוונטי לקובץ הזה (jsx, artifact). נשאר עם window.storage/localStorage כרגיל, רק עלייה במספר הגרסה לצורך אחידות.
 * 2.1  תיקון באג ב-uid (shadowing מול Firebase Auth) ועדכון apiKey/CACHE_NAME בגרסת ה-HTML — לא רלוונטי לקובץ הזה (jsx), רק עלייה במספר הגרסה לצורך אחידות.
 * 2.2  חמישה פיצ'רים חדשים בהשראת סקירת תוכנה מקצועית דומה (טיפולוג): איש קשר לשעת חירום בכרטיס המטופל; מסמכים
 *      דיגיטליים (הסכם טיפול/שאלון קבלה/ויתור סודיות/מותאם אישית) — בקובץ הזה (jsx/localStorage) ללא קישור חתימה
 *      מרחוק אמיתי (זמין רק בגרסת ה-HTML המתארחת דרך sign.html+Firestore); הגדרות תזכורות אוטומטיות (תשתית/תבנית
 *      בלבד, אינה שולחת בפועל עד לחיבור שירות שליחה); כפתור העתקה+פתיחה בחשבונית ירוקה (טקסט מפורמט, ללא
 *      אינטגרציית API אמיתית — דורשת שרת ביניים); דוחות מתקדמים בסטטיסטיקה (השוואה לתקופה קודמת, ממוצע ימים בין פגישות).
 * 2.3  תבניות מסמכים ניתנות לעריכה קבועה (נשמרות ב-localStorage, שחזור לברירת מחדל לכל תבנית). לוגו מרפאה —
 *      בקובץ הזה (jsx/artifact) נשמר כ-base64 ב-localStorage (אין Firebase Storage), מוצג גדול במסך הכניסה,
 *      קטן בכותרת, בתיק האישי, ובמסמכים. "הגדרות תזכורות" הפך ל"הגדרות המרפאה" (3 לשוניות). נוסף כפתור
 *      "שליחה ב-Gmail" (buildGmailComposeLink) לצד מייל ברירת המחדל.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Users, Calendar as CalendarIcon, Plus, X, Edit2, Trash2, Phone,
  Clock, ChevronRight, ChevronLeft, Search, Download, CheckCircle2,
  User, ArrowRight, Tag, FileText, CalendarPlus, AlertCircle, Copy, Bell, Mic, Square, Printer, BarChart3, Target, ClipboardList, Mail, Lock, Key, Upload, HardDrive, Settings, Link2, MessageCircle
} from "lucide-react";

const COLORS = {
  bg: "#FAF7F1",
  surface: "#FFFFFF",
  primary: "#24443F",
  primaryLight: "#3F6359",
  sage: "#8A9A7E",
  clay: "#C17A52",
  text: "#2A2A24",
  muted: "#8C8577",
  border: "#E7E1D3",
  danger: "#AE4F45",
  success: "#2E7D32",
};

const HEB_DAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const HEB_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now());
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const todayStr = () => new Date().toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(2, "0");

function formatHeDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ב${HEB_MONTHS[m - 1]} ${y}`;
}
function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${pad(d)}.${pad(m)}.${y}`;
}
const DEFAULT_SESSION_DURATION = 60; // minutes — 50 min session + 10 min buffer, editable per session/recurring slot

function generateICS(patientName, dateStr, timeStr, notes, duration) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "09:00").split(":").map(Number);
  const start = new Date(y, m - 1, d, hh, mm);
  const end = new Date(start.getTime() + (duration || DEFAULT_SESSION_DURATION) * 60000);
  const fmt = (dt) => dt.getFullYear() + pad(dt.getMonth() + 1) + pad(dt.getDate()) + "T" + pad(dt.getHours()) + pad(dt.getMinutes()) + "00";
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Patient Manager//HE",
    "BEGIN:VEVENT",
    "UID:" + uid() + "@patient-manager",
    "DTSTAMP:" + fmt(new Date()),
    "DTSTART:" + fmt(start),
    "DTEND:" + fmt(end),
    "SUMMARY:פגישה עם " + patientName,
    "DESCRIPTION:" + (notes || "").replace(/\n/g, "\\n"),
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `פגישה-${patientName}-${dateStr}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function googleCalendarUrl(patientName, dateStr, timeStr, notes, duration) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "09:00").split(":").map(Number);
  const start = new Date(y, m - 1, d, hh, mm);
  const end = new Date(start.getTime() + (duration || DEFAULT_SESSION_DURATION) * 60000);
  const fmt = (dt) => dt.getFullYear() + pad(dt.getMonth() + 1) + pad(dt.getDate()) + "T" + pad(dt.getHours()) + pad(dt.getMinutes()) + "00";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "פגישה עם " + patientName,
    dates: fmt(start) + "/" + fmt(end),
    details: notes || "",
  });
  return "https://calendar.google.com/calendar/render?" + params.toString();
}

const TAG_COLORS = {
  "טראומה": "#AE4F45",
  "אוטיזם": "#3F6359",
  "חרדה": "#C17A52",
  "דיכאון": "#7A6FA0",
};
function tagColor(tag) {
  return TAG_COLORS[tag] || COLORS.sage;
}

function isEndOfMonthEvening() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return now.getDate() === lastDay && now.getHours() >= 20;
}

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const DEFAULT_SESSION_TYPES = ["טיפול", "הדרכה הורית", "הדרכה", "ייעוץ עסקי", "ייעוץ NLP"];
const SESSION_NOTE_TEMPLATES = {
  "טיפול": "נושאים שעלו בפגישה:\n\nהתקדמות ביחס ליעדי הטיפול:\n\nמטלות/המשך לפגישה הבאה:\n",
  "הדרכה הורית": "נושאים שעלו מול ההורים:\n\nכלים/המלצות שניתנו:\n\nמעקב ליישום עד הפגישה הבאה:\n",
  "הדרכה": "נושאי ההדרכה:\n\nתובנות מרכזיות:\n\nהמשך מומלץ:\n",
  "ייעוץ עסקי": "רקע/צורך שהוצג:\n\nהמלצות שניתנו:\n\nצעדים הבאים:\n",
  "ייעוץ NLP": "טכניקה שהופעלה בפגישה:\n\nתגובת המטופל/ת:\n\nהמשך מומלץ:\n",
};
const ALEF_BET = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ", "ק", "ר", "ש", "ת"];
const APP_VERSION = "2.3";

function fmtDate(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

/** Merge a patient's explicit sessions with virtual weekly-recurring occurrences within a date range (inclusive, 'YYYY-MM-DD' strings). Explicit sessions always take precedence over a virtual slot on the same date. */
function getOccurrencesInRange(patient, startDate, endDate) {
  const results = [];
  (patient.sessions || []).forEach((s) => {
    if (s.date >= startDate && s.date <= endDate) results.push({ date: s.date, time: s.time, status: s.status, duration: s.duration || DEFAULT_SESSION_DURATION, session: s, virtual: false });
  });
  if (patient.recurring && patient.recurring.enabled) {
    const explicitDates = new Set(results.map((r) => r.date));
    let cur = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    while (cur <= end) {
      if (cur.getDay() === Number(patient.recurring.day)) {
        const ds = fmtDate(cur);
        if (!explicitDates.has(ds)) results.push({ date: ds, time: patient.recurring.time, status: "scheduled", duration: patient.recurring.duration || DEFAULT_SESSION_DURATION, virtual: true, type: patient.recurring.type || "" });
      }
      cur.setDate(cur.getDate() + 1);
    }
  }
  return results.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

function timeToMinutes(t) {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + m;
}
/** Do two [start, start+duration) time ranges (same day) overlap? */
function rangesOverlap(timeA, durationA, timeB, durationB) {
  const aStart = timeToMinutes(timeA), aEnd = aStart + (durationA || DEFAULT_SESSION_DURATION);
  const bStart = timeToMinutes(timeB), bEnd = bStart + (durationB || DEFAULT_SESSION_DURATION);
  return aStart < bEnd && bStart < aEnd;
}

/** Returns the name of a conflicting patient (if any) whose slot overlaps this date/time/duration window, ignoring cancelled slots. */
function findConflict(patients, date, time, duration, excludePatientId, excludeSessionId) {
  for (const p of patients || []) {
    if (p.id === excludePatientId) continue;
    const hit = getOccurrencesInRange(p, date, date).find((o) => o.status !== "cancelled" && rangesOverlap(time, duration, o.time, o.duration));
    if (hit) return p.name;
  }
  const self = (patients || []).find((p) => p.id === excludePatientId);
  if (self) {
    const dup = (self.sessions || []).find((s) => s.date === date && s.status !== "cancelled" && s.id !== excludeSessionId && rangesOverlap(time, duration, s.time, s.duration || DEFAULT_SESSION_DURATION));
    if (dup) return `${self.name} (פגישה כפולה לאותו מטופל/ת)`;
  }
  return null;
}

function nextDateForWeekday(day) {
  const d = new Date();
  const diff = (Number(day) - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return fmtDate(d);
}

function getPeriodRange(mode, anchor) {
  const d = new Date(anchor + "T00:00:00");
  if (mode === "day") return { start: anchor, end: anchor, label: formatHeDate(anchor) };
  if (mode === "week") {
    const start = new Date(d); start.setDate(d.getDate() - d.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { start: fmtDate(start), end: fmtDate(end), label: `${formatShortDate(fmtDate(start))} – ${formatShortDate(fmtDate(end))}` };
  }
  if (mode === "year") {
    const y = d.getFullYear();
    return { start: `${y}-01-01`, end: `${y}-12-31`, label: `${y}` };
  }
  const y = d.getFullYear(), m = d.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return { start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-${pad(lastDay)}`, label: `${HEB_MONTHS[m]} ${y}` };
}

function shiftAnchor(mode, anchor, dir) {
  const d = new Date(anchor + "T00:00:00");
  if (mode === "day") d.setDate(d.getDate() + dir);
  else if (mode === "week") d.setDate(d.getDate() + dir * 7);
  else if (mode === "year") d.setFullYear(d.getFullYear() + dir);
  else d.setMonth(d.getMonth() + dir);
  return fmtDate(d);
}

function monthlySessions(patients, y, m) {
  const list = [];
  (patients || []).forEach((p) => (p.sessions || []).forEach((s) => {
    const eligible = s.status === "completed" || (s.status === "cancelled" && s.charged);
    if (!eligible) return;
    const [sy, sm] = s.date.split("-").map(Number);
    if (sy === y && sm === m + 1) {
      list.push({ ...s, patientId: p.id, patientName: p.name, price: s.price ?? p.sessionRate ?? 0 });
    }
  }));
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

function buildSummaryText(y, m, sessions) {
  const lines = [`סיכום חודשי — ${HEB_MONTHS[m]} ${y}`, ""];
  const grouped = {};
  sessions.forEach((s) => { grouped[s.patientName] = grouped[s.patientName] || []; grouped[s.patientName].push(s); });
  let grand = 0;
  Object.entries(grouped).forEach(([name, arr]) => {
    lines.push(`${name}:`);
    arr.forEach((s) => {
      const tag = s.status === "cancelled" ? ` (ביטול בחיוב${s.cancelReason ? " — " + s.cancelReason : ""})` : (s.type ? ` (${s.type})` : "");
      lines.push(`  ${formatShortDate(s.date)} — ₪${Number(s.price) || 0}${tag}`);
      grand += Number(s.price) || 0;
    });
    const subtotal = arr.reduce((a, s) => a + (Number(s.price) || 0), 0);
    lines.push(`  סה"כ ${name}: ₪${subtotal}`);
    lines.push("");
  });
  lines.push(`סה"כ כללי לחודש: ₪${grand}`);
  return lines.join("\n");
}

function buildPatientBillingText(patient, items) {
  const lines = [`פרטי חיוב — ${patient.name}`];
  if (patient.phone) lines.push(`טלפון: ${patient.phone}`);
  if (patient.email) lines.push(`אימייל: ${patient.email}`);
  lines.push("");
  let total = 0;
  items.forEach((s) => {
    const tag = s.status === "cancelled" ? ` (ביטול בחיוב${s.cancelReason ? " — " + s.cancelReason : ""})` : (s.type ? ` (${s.type})` : "");
    lines.push(`${formatShortDate(s.date)} — ₪${Number(s.price) || 0}${tag}`);
    total += Number(s.price) || 0;
  });
  lines.push("");
  lines.push(`סה"כ לתשלום: ₪${total}`);
  return lines.join("\n");
}
function buildMailtoLink(patient, items) {
  const body = buildPatientBillingText(patient, items);
  const subject = `פרטי חיוב — ${patient.name}`;
  return `mailto:${encodeURIComponent(patient.email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
function buildGmailComposeLink(to, subject, body) {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to || "")}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
function buildGreenInvoiceText(patient, items) {
  const lines = [`לקוח/ה: ${patient.name}`];
  if (patient.phone) lines.push(`טלפון: ${patient.phone}`);
  if (patient.email) lines.push(`אימייל: ${patient.email}`);
  lines.push("", "פריטים:");
  let total = 0;
  items.forEach((s) => {
    const desc = s.status === "cancelled" ? `ביטול בחיוב${s.cancelReason ? " — " + s.cancelReason : ""}` : (s.type || "פגישה טיפולית");
    lines.push(`${formatShortDate(s.date)} | ${desc} | ₪${Number(s.price) || 0}`);
    total += Number(s.price) || 0;
  });
  lines.push("", `סה"כ: ₪${total}`);
  return lines.join("\n");
}

function exportBackup(patients, sessionTypes) {
  const payload = { exportedAt: new Date().toISOString(), appVersion: APP_VERSION, patients, sessionTypes };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `גיבוי-מטופלים-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * מיזוג "בטוח": אף פעם לא מוחק מטופל/פגישה שקיימים מקומית.
 * לכל מטופל/פגישה שמופיעים בשני הצדדים — הגרסה עם ה-updatedAt המאוחר יותר מנצחת.
 * מטופלים/פגישות שקיימים רק מקומית או רק בקובץ המיובא — תמיד נשמרים (union).
 */
function mergePatients(localPatients, incomingPatients) {
  const result = [...(localPatients || [])];
  let added = 0;
  let updated = 0;
  (incomingPatients || []).forEach((inc) => {
    const idx = result.findIndex((p) => p.id === inc.id);
    if (idx === -1) {
      result.push(inc);
      added++;
      return;
    }
    const loc = result[idx];
    const incNewer = (inc.updatedAt || inc.createdAt || "") > (loc.updatedAt || loc.createdAt || "");
    const sessionMap = new Map((loc.sessions || []).map((s) => [s.id, s]));
    (inc.sessions || []).forEach((s) => {
      const existing = sessionMap.get(s.id);
      if (!existing) {
        sessionMap.set(s.id, s);
      } else {
        const sNewer = (s.updatedAt || "") > (existing.updatedAt || "");
        sessionMap.set(s.id, sNewer ? s : existing);
      }
    });
    const mergedSessions = Array.from(sessionMap.values()).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const base = incNewer ? inc : loc;
    result[idx] = { ...base, sessions: mergedSessions };
    updated++;
  });
  return { merged: result, added, updated };
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("ErrorBoundary caught:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div dir="rtl" style={{ padding: 24, fontFamily: "'Segoe UI', Heebo, Arial, sans-serif" }}>
          <div style={{ fontWeight: 700, color: COLORS.danger, marginBottom: 8, fontSize: 15 }}>אירעה שגיאה בתצוגה הזו</div>
          <div style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 12, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, color: COLORS.text, direction: "ltr", textAlign: "left" }}>
            {String((this.state.error && this.state.error.message) || this.state.error)}
          </div>
          <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 10 }}>אפשר להעתיק את הטקסט האדום/אפור למעלה ולשלוח אותו כדי שאפשר יהיה לתקן במדויק.</p>
          <button onClick={() => this.setState({ error: null })} style={{ ...btnPrimary(), width: "auto", marginTop: 4 }}>נסה שוב</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const AUTH_KEY = "authHash";

function AuthGate({ children }) {
  const [phase, setPhase] = useState("loading"); // loading | setup | locked
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [error, setError] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [publicLogoUrl, setPublicLogoUrl] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(AUTH_KEY);
        setPhase(res && res.value ? "locked" : "setup");
      } catch {
        setPhase("setup");
      }
    })();
    (async () => {
      try {
        const res = await window.storage.get("logoUrl", false);
        if (res) setPublicLogoUrl(res.value);
      } catch { /* no logo saved yet */ }
    })();
  }, []);

  async function handleSetup() {
    if (pwd.length < 4) { setError("הסיסמה צריכה להיות לפחות 4 תווים."); return; }
    if (pwd !== pwd2) { setError("הסיסמאות לא תואמות."); return; }
    const hash = await sha256Hex(pwd);
    await window.storage.set(AUTH_KEY, hash);
    setUnlocked(true);
    setPwd(""); setPwd2(""); setError("");
  }

  async function handleLogin() {
    try {
      const res = await window.storage.get(AUTH_KEY);
      const hash = await sha256Hex(pwd);
      if (res && res.value === hash) {
        setUnlocked(true); setPwd(""); setError("");
      } else {
        setError("סיסמה שגויה. נסי שוב.");
      }
    } catch {
      setError("שגיאה בבדיקת הסיסמה. נסי שוב.");
    }
  }

  if (phase === "loading") {
    return <div style={{ background: COLORS.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: COLORS.muted }}>טוען…</div></div>;
  }

  if (unlocked) {
    return children({ onRelock: () => setUnlocked(false) });
  }

  const isSetup = phase === "setup";
  return (
    <div dir="rtl" style={{ fontFamily: "'Segoe UI', Heebo, Arial, sans-serif", background: COLORS.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: COLORS.surface, borderRadius: 16, padding: "32px 28px", width: "100%", maxWidth: 340, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
        {publicLogoUrl ? (
          <img src={publicLogoUrl} alt="לוגו המרפאה" style={{ maxWidth: 200, maxHeight: 140, margin: "0 auto 14px", display: "block" }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: 14, background: COLORS.clay, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <User size={28} color="#fff" />
          </div>
        )}
        <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.primary, marginBottom: 2 }}>שלום ריקי 🌿</div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 22 }}>מרפאה — כרטיסי מטופלים</div>
        {isSetup && <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 14, lineHeight: 1.5 }}>זו הכניסה הראשונה — בחרי סיסמה לאפליקציה.</p>}
        <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
          placeholder={isSetup ? "סיסמה חדשה" : "סיסמה"}
          onKeyDown={(e) => e.key === "Enter" && (isSetup ? document.getElementById("pw2input")?.focus() || handleSetup() : handleLogin())}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 15, marginBottom: 10, textAlign: "center" }} autoFocus />
        {isSetup && (
          <input id="pw2input" type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)}
            placeholder="אימות סיסמה" onKeyDown={(e) => e.key === "Enter" && handleSetup()}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 15, marginBottom: 10, textAlign: "center" }} />
        )}
        {error && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <button onClick={isSetup ? handleSetup : handleLogin} style={{ ...btnPrimary(), marginTop: 4 }}>
          {isSetup ? "שמירת סיסמה וכניסה" : "כניסה"}
        </button>
        <p style={{ fontSize: 11, color: COLORS.muted, marginTop: 16, lineHeight: 1.5 }}>
          שימי לב: זו הגנה בסיסית מפני הצצה מקרית באותו מכשיר, לא הצפנה מלאה.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return <AuthGate>{(gateProps) => <AppInner {...gateProps} />}</AuthGate>;
}

function AppInner({ onRelock }) {
  const [patients, setPatients] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [activeTab, setActiveTab] = useState("patients");
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [prefillSession, setPrefillSession] = useState(null);
  const [forceCancelStatus, setForceCancelStatus] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [sumMonth, setSumMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [showBanner, setShowBanner] = useState(() => isEndOfMonthEvening());
  const [sessionTypes, setSessionTypes] = useState(DEFAULT_SESSION_TYPES);
  const [documentModalFor, setDocumentModalFor] = useState(null); // patient object, or null
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [reminderSettings, setReminderSettings] = useState({ enabled: false, hoursBefore: 24, template: "שלום {שם המטופל}, זוהי תזכורת לתור שלך ב-{תאריך} בשעה {שעה}. נא אשר/י הגעה. {שם המרפאה}" });
  const [logoUrl, setLogoUrl] = useState(null);
  const [documentTemplates, setDocumentTemplates] = useState(DEFAULT_DOCUMENT_TEMPLATES);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("patients", false);
        setPatients(res ? JSON.parse(res.value) : []);
      } catch {
        setPatients([]);
      } finally {
        setLoading(false);
      }
    })();
    (async () => {
      try {
        const res = await window.storage.get("sessionTypes", false);
        if (res) {
          const custom = JSON.parse(res.value);
          setSessionTypes(Array.from(new Set([...DEFAULT_SESSION_TYPES, ...custom])));
        }
      } catch { /* keep defaults */ }
    })();
    (async () => {
      try {
        const res = await window.storage.get("reminderSettings", false);
        if (res) setReminderSettings((prev) => ({ ...prev, ...JSON.parse(res.value), enabled: false }));
      } catch { /* keep defaults */ }
    })();
    (async () => {
      try {
        const res = await window.storage.get("logoUrl", false);
        if (res) setLogoUrl(res.value);
      } catch { /* no logo saved yet */ }
    })();
    (async () => {
      try {
        const res = await window.storage.get("documentTemplates", false);
        if (res) setDocumentTemplates((prev) => ({ ...prev, ...JSON.parse(res.value) }));
      } catch { /* keep defaults */ }
    })();
  }, []);

  function addSessionType(newType) {
    setSessionTypes((prev) => {
      if (prev.includes(newType)) return prev;
      const next = [...prev, newType];
      window.storage.set("sessionTypes", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  function saveReminderSettings(next) {
    const safe = { ...next, enabled: false };
    setReminderSettings(safe);
    window.storage.set("reminderSettings", JSON.stringify(safe)).catch(() => {});
  }

  function saveDocumentTemplates(next) {
    setDocumentTemplates(next);
    window.storage.set("documentTemplates", JSON.stringify(next)).catch(() => {});
  }

  function uploadLogo(dataUrl) {
    setLogoUrl(dataUrl);
    window.storage.set("logoUrl", dataUrl).catch(() => {});
  }

  function addDocument(patientId, docData) {
    const newDoc = { id: uid(), title: docData.title, content: docData.content, createdAt: new Date().toISOString(), status: "sent" };
    persist(patients.map((p) => (p.id === patientId ? { ...p, documents: [...(p.documents || []), newDoc], updatedAt: new Date().toISOString() } : p)));
    setDocumentModalFor(null);
  }

  const persist = useCallback(async (next) => {
    setPatients(next);
    try {
      await window.storage.set("patients", JSON.stringify(next), false);
    } catch {
      setError("שמירת הנתונים נכשלה. נסי שוב.");
      setTimeout(() => setError(null), 3000);
    }
  }, []);

  const selectedPatient = useMemo(
    () => (patients || []).find((p) => p.id === selectedId) || null,
    [patients, selectedId]
  );

  const filteredPatients = useMemo(() => {
    if (!patients) return [];
    const q = search.trim();
    const base = !q ? patients : patients.filter(
      (p) => p.name.includes(q) || (p.tags || []).some((t) => t.includes(q))
    );
    return [...base].sort((a, b) => a.name.localeCompare(b.name, "he"));
  }, [patients, search]);

  const groupedPatients = useMemo(() => {
    const map = {};
    filteredPatients.forEach((p) => {
      const letter = (p.name.trim()[0] || "#").toUpperCase();
      map[letter] = map[letter] || [];
      map[letter].push(p);
    });
    return map;
  }, [filteredPatients]);

  const letterRefs = useRef({});
  function scrollToLetter(letter) {
    letterRefs.current[letter]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function nextAppointment(patient) {
    const t = todayStr();
    const future = new Date(); future.setDate(future.getDate() + 90);
    return getOccurrencesInRange(patient, t, fmtDate(future)).filter((o) => o.status !== "cancelled")[0];
  }

  function savePatient(data) {
    if (editingPatient) {
      persist(patients.map((p) => (p.id === editingPatient.id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p)));
    } else {
      const now = new Date().toISOString();
      const np = { id: uid(), sessions: [], createdAt: now, updatedAt: now, ...data };
      persist([...(patients || []), np]);
      setSelectedId(np.id);
      setActiveTab("patients");
    }
    setShowPatientForm(false);
    setEditingPatient(null);
  }

  function deletePatient(id) {
    persist(patients.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(null);
    setConfirmDelete(null);
  }

  function saveSession(patientId, data) {
    const p = patients.find((x) => x.id === patientId);
    const now = new Date().toISOString();
    let sessions;
    if (editingSession) {
      sessions = p.sessions.map((s) => (s.id === editingSession.id ? { ...s, ...data, updatedAt: now } : s));
    } else {
      sessions = [...(p.sessions || []), { id: uid(), updatedAt: now, ...data }];
    }
    persist(patients.map((x) => (x.id === patientId ? { ...x, sessions, updatedAt: now } : x)));
    setShowSessionForm(false);
    setEditingSession(null);
  }

  function deleteSession(patientId, sessionId) {
    const p = patients.find((x) => x.id === patientId);
    persist(patients.map((x) => (x.id === patientId ? { ...x, sessions: x.sessions.filter((s) => s.id !== sessionId) } : x)));
  }

  function openCancelFor(patient, occ) {
    if (occ.virtual) {
      setEditingSession(null);
      setPrefillSession({ date: occ.date, time: occ.time });
    } else {
      setEditingSession(occ.session);
      setPrefillSession(null);
    }
    setForceCancelStatus(true);
    setShowSessionForm(true);
  }

  function updateRecurring(patientId, recurring) {
    persist(patients.map((x) => (x.id === patientId ? { ...x, recurring } : x)));
    setShowRecurringForm(false);
  }

  if (loading) {
    return (
      <div style={{ background: COLORS.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', Heebo, Arial, sans-serif" }}>
        <div style={{ color: COLORS.muted }}>טוען…</div>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ fontFamily: "'Segoe UI', Heebo, Arial, sans-serif", background: COLORS.bg, minHeight: "100vh", color: COLORS.text }}>
      <style>{`
        * { box-sizing: border-box; }
        input, textarea { font-family: inherit; }
        input:focus, textarea:focus, button:focus-visible { outline: 2px solid ${COLORS.primaryLight}; outline-offset: 1px; }
        ::placeholder { color: ${COLORS.muted}; opacity: 0.8; }
        .scrollbar::-webkit-scrollbar { width: 6px; }
        .scrollbar::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
      `}</style>

      {error && (
        <div style={{ position: "fixed", top: 12, right: "50%", transform: "translateX(50%)", background: COLORS.danger, color: "#fff", padding: "8px 16px", borderRadius: 8, zIndex: 100, fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Header */}
      <header style={{ background: COLORS.primary, color: "#fff", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {logoUrl ? (
            <img src={logoUrl} alt="לוגו המרפאה" style={{ height: 30, maxWidth: 90, objectFit: "contain" }} />
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: 8, background: COLORS.clay, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={17} color="#fff" />
            </div>
          )}
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.3 }}>מרפאה — כרטיסי מטופלים</span>
          <span style={{ fontSize: 11, opacity: 0.6, marginRight: 4 }}>v{APP_VERSION}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div className="hide-mobile" style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <HeaderTab label="מטופלים" icon={Users} active={activeTab === "patients"} onClick={() => setActiveTab("patients")} />
            <HeaderTab label="יומן" icon={CalendarIcon} active={activeTab === "calendar"} onClick={() => { setActiveTab("calendar"); setSelectedId(null); }} />
            <HeaderTab label="סיכום חודשי" icon={FileText} active={activeTab === "summary"} onClick={() => { setActiveTab("summary"); setSelectedId(null); }} />
            <HeaderTab label="סטטיסטיקה" icon={BarChart3} active={activeTab === "stats"} onClick={() => { setActiveTab("stats"); setSelectedId(null); }} />
          </div>
          <button onClick={() => setShowBackupModal(true)} title="גיבוי ושחזור" style={{ background: "none", border: "none", color: "#fff", opacity: 0.75, cursor: "pointer", display: "flex", padding: 6 }}><HardDrive size={16} /></button>
          <button onClick={() => setShowReminderSettings(true)} title="הגדרות המרפאה (תזכורות, תבניות מסמכים, לוגו)" style={{ background: "none", border: "none", color: "#fff", opacity: 0.75, cursor: "pointer", display: "flex", padding: 6 }}><Settings size={16} /></button>
          <button onClick={() => setShowChangePassword(true)} title="שינוי סיסמה" style={{ background: "none", border: "none", color: "#fff", opacity: 0.75, cursor: "pointer", display: "flex", padding: 6 }}><Key size={16} /></button>
          {onRelock && <button onClick={onRelock} title="נעילה" style={{ background: "none", border: "none", color: "#fff", opacity: 0.75, cursor: "pointer", display: "flex", padding: 6 }}><Lock size={16} /></button>}
        </div>
      </header>

      {showBanner && (
        <div style={{ background: COLORS.clay, color: "#fff", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
            <Bell size={16} /> היום סוף החודש — כדאי להכין את סיכום התשלומים לטאב.
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => { setActiveTab("summary"); setSelectedId(null); setShowBanner(false); }}
              style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              לסיכום החודשי
            </button>
            <button onClick={() => setShowBanner(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", display: "flex" }}><X size={16} /></button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
        {/* Sidebar - patient list (desktop always, mobile only on patients tab w/o selection) */}
        <div
          className="sidebar"
          style={{
            width: 320, flexShrink: 0, borderLeft: `1px solid ${COLORS.border}`,
            background: COLORS.surface, display: activeTab === "patients" && !selectedId ? "flex" : "none",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: 14, borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ position: "relative", marginBottom: 10 }}>
              <Search size={16} color={COLORS.muted} style={{ position: "absolute", right: 10, top: 10 }} />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש מטופל/ת או תגית…"
                style={{ width: "100%", padding: "8px 32px 8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14 }}
              />
            </div>
            <button onClick={() => { setEditingPatient(null); setShowPatientForm(true); }}
              style={btnPrimary()}>
              <Plus size={16} /> מטופל/ת חדש/ה
            </button>
          </div>
          <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
            <div className="scrollbar" style={{ overflowY: "auto", height: "100%", paddingLeft: 22 }}>
              {filteredPatients.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>
                  {patients.length === 0 ? "עדיין אין מטופלים. הוסיפי את הראשון/ה." : "לא נמצאו תוצאות."}
                </div>
              )}
              {Object.keys(groupedPatients).sort((a, b) => a.localeCompare(b, "he")).map((letter) => (
                <div key={letter} ref={(el) => { letterRefs.current[letter] = el; }}>
                  <div style={{ position: "sticky", top: 0, background: COLORS.bg, color: COLORS.primary, fontWeight: 800, fontSize: 12, padding: "4px 16px", borderBottom: `1px solid ${COLORS.border}`, zIndex: 1 }}>
                    {letter}
                  </div>
                  {groupedPatients[letter].map((p) => {
                    const na = nextAppointment(p);
                    return (
                      <div key={p.id} onClick={() => { setSelectedId(p.id); }}
                        style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#F6F2E9"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <span style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</span>
                          {na && <span style={{ fontSize: 11, color: COLORS.clay, fontWeight: 600 }}>{formatShortDate(na.date)}</span>}
                        </div>
                        {p.tags && p.tags.length > 0 && (
                          <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                            {p.tags.slice(0, 3).map((t) => <TagChip key={t} tag={t} />)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {Object.keys(groupedPatients).length > 1 && (
              <div style={{ position: "absolute", left: 2, top: 4, bottom: 4, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                {ALEF_BET.map((l) => {
                  const has = !!groupedPatients[l];
                  return (
                    <button key={l} disabled={!has} onClick={() => scrollToLetter(l)} title={l} style={{
                      background: "none", border: "none", cursor: has ? "pointer" : "default",
                      color: has ? COLORS.primary : COLORS.border, fontSize: 9.5, fontWeight: 700,
                      lineHeight: "12px", padding: 0, width: 16,
                    }}>{l}</button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Main area */}
        <div style={{ flex: 1, display: activeTab === "patients" && !selectedId ? "none" : "block", minWidth: 0 }} className="main-area">
          <ErrorBoundary key={activeTab + (selectedId || "")}>
          {activeTab === "calendar" ? (
            <CalendarView
              patients={patients} calMonth={calMonth} setCalMonth={setCalMonth}
              onPickPatient={(id) => { setSelectedId(id); setActiveTab("patients"); }}
            />
          ) : activeTab === "summary" ? (
            <MonthlySummary patients={patients} sumMonth={sumMonth} setSumMonth={setSumMonth}
              onPickPatient={(id) => { setSelectedId(id); setActiveTab("patients"); }} />
          ) : activeTab === "stats" ? (
            <StatisticsView patients={patients} />
          ) : selectedPatient ? (
            <PatientDetail
              patient={selectedPatient}
              onBack={() => setSelectedId(null)}
              onEdit={() => { setEditingPatient(selectedPatient); setShowPatientForm(true); }}
              onDelete={() => setConfirmDelete(selectedPatient)}
              onAddSession={() => { setEditingSession(null); setPrefillSession(null); setForceCancelStatus(false); setShowSessionForm(true); }}
              onAddSessionAt={(date, time, type, duration) => { setEditingSession(null); setPrefillSession({ date, time, type, duration }); setForceCancelStatus(false); setShowSessionForm(true); }}
              onEditSession={(s) => { setEditingSession(s); setPrefillSession(null); setForceCancelStatus(false); setShowSessionForm(true); }}
              onDeleteSession={(sid) => deleteSession(selectedPatient.id, sid)}
              onCancelOccurrence={(occ) => openCancelFor(selectedPatient, occ)}
              onEditRecurring={() => setShowRecurringForm(true)}
              onAddDocument={() => setDocumentModalFor(selectedPatient)}
              logoUrl={logoUrl}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: COLORS.muted, flexDirection: "column", gap: 8, padding: 40 }}>
              <Users size={36} color={COLORS.border} />
              <span>בחרי מטופל/ת מהרשימה בצד</span>
            </div>
          )}
          </ErrorBoundary>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="bottom-nav" style={{ display: "none", position: "fixed", bottom: 0, right: 0, left: 0, background: COLORS.surface, borderTop: `1px solid ${COLORS.border}`, padding: "6px 0" }}>
        <div style={{ display: "flex" }}>
          <BottomTab label="מטופלים" icon={Users} active={activeTab === "patients"} onClick={() => { setActiveTab("patients"); setSelectedId(null); }} />
          <BottomTab label="יומן" icon={CalendarIcon} active={activeTab === "calendar"} onClick={() => { setActiveTab("calendar"); setSelectedId(null); }} />
          <BottomTab label="סיכום" icon={FileText} active={activeTab === "summary"} onClick={() => { setActiveTab("summary"); setSelectedId(null); }} />
          <BottomTab label="סטטיסטיקה" icon={BarChart3} active={activeTab === "stats"} onClick={() => { setActiveTab("stats"); setSelectedId(null); }} />
        </div>
      </div>

      {showPatientForm && (
        <PatientFormModal
          initial={editingPatient}
          allPatients={patients}
          onSave={savePatient}
          onClose={() => { setShowPatientForm(false); setEditingPatient(null); }}
        />
      )}
      {showSessionForm && selectedPatient && (
        <SessionFormModal
          patientName={selectedPatient.name}
          patientId={selectedPatient.id}
          allPatients={patients}
          initial={editingSession}
          defaultPrice={selectedPatient.sessionRate || 0}
          defaultDuration={selectedPatient.recurring?.duration || DEFAULT_SESSION_DURATION}
          prefillDate={prefillSession?.date}
          prefillTime={prefillSession?.time}
          prefillType={prefillSession?.type}
          prefillDuration={prefillSession?.duration}
          forceStatus={forceCancelStatus ? "cancelled" : undefined}
          sessionTypes={sessionTypes}
          onAddSessionType={addSessionType}
          onSave={(data) => saveSession(selectedPatient.id, data)}
          onClose={() => { setShowSessionForm(false); setEditingSession(null); setPrefillSession(null); setForceCancelStatus(false); }}
        />
      )}
      {showRecurringForm && selectedPatient && (
        <RecurringFormModal
          patient={selectedPatient}
          allPatients={patients}
          sessionTypes={sessionTypes}
          onAddSessionType={addSessionType}
          onSave={(recurring) => updateRecurring(selectedPatient.id, recurring)}
          onClose={() => setShowRecurringForm(false)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title={`למחוק את הכרטיס של ${confirmDelete.name}?`}
          body="פעולה זו תמחק גם את כל היסטוריית הפגישות. לא ניתן לשחזר."
          onConfirm={() => deletePatient(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {documentModalFor && <DocumentModal patient={documentModalFor} templates={documentTemplates} logoUrl={logoUrl} onSave={(docData) => addDocument(documentModalFor.id, docData)} onClose={() => setDocumentModalFor(null)} />}
      {showReminderSettings && (
        <SettingsModal
          settings={reminderSettings} onSaveSettings={saveReminderSettings}
          templates={documentTemplates} onSaveTemplates={saveDocumentTemplates}
          logoUrl={logoUrl} onUploadLogo={uploadLogo}
          onClose={() => setShowReminderSettings(false)}
        />
      )}
      {showBackupModal && (
        <BackupModal
          patients={patients}
          sessionTypes={sessionTypes}
          onMerge={(mergedPatients, mergedTypes) => {
            persist(mergedPatients);
            setSessionTypes(mergedTypes);
            window.storage.set("sessionTypes", JSON.stringify(mergedTypes)).catch(() => {});
          }}
          onClose={() => setShowBackupModal(false)}
        />
      )}

      <style>{`
        @media (max-width: 860px) {
          .hide-mobile { display: none !important; }
          .sidebar { width: 100% !important; border-left: none !important; }
          .bottom-nav { display: block !important; }
          body { padding-bottom: 56px; }
        }
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function HeaderTab({ label, icon: Icon, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8,
      background: active ? "rgba(255,255,255,0.16)" : "transparent", color: "#fff", border: "none",
      cursor: "pointer", fontSize: 14, fontWeight: 600,
    }}>
      <Icon size={15} /> {label}
    </button>
  );
}
function BottomTab({ label, icon: Icon, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 0",
      background: "transparent", border: "none", color: active ? COLORS.primary : COLORS.muted, cursor: "pointer",
    }}>
      <Icon size={20} />
      <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
    </button>
  );
}
function TagChip({ tag, onRemove, onEdit }) {
  const c = tagColor(tag);
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color: c, background: c + "1C", padding: "2px 8px",
      borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <span onClick={onEdit ? () => onEdit(tag) : undefined} style={{ cursor: onEdit ? "pointer" : "default" }} title={onEdit ? "לחיצה לעריכה" : undefined}>{tag}</span>
      {onRemove && <X size={11} style={{ cursor: "pointer" }} onClick={onRemove} />}
    </span>
  );
}
function btnPrimary(extra) {
  return {
    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    background: COLORS.primary, color: "#fff", border: "none", borderRadius: 8, padding: "9px 12px",
    fontSize: 14, fontWeight: 600, cursor: "pointer", ...extra,
  };
}

function PatientDetail({ patient, onBack, onEdit, onDelete, onAddSession, onAddSessionAt, onEditSession, onDeleteSession, onCancelOccurrence, onEditRecurring, onAddDocument, logoUrl }) {
  const t = todayStr();
  const sessions = [...(patient.sessions || [])].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const history = sessions.filter((s) => s.status !== "scheduled" || s.date < t);
  const [showFile, setShowFile] = useState(false);

  const future = new Date(); future.setDate(future.getDate() + 60);
  const occurrences = getOccurrencesInRange(patient, t, fmtDate(future))
    .filter((o) => o.status === "scheduled")
    .slice(0, 6);

  return (
    <div className="scrollbar" style={{ height: "100%", overflowY: "auto", padding: "20px 28px 80px" }}>
      <button onClick={onBack} className="hide-mobile-inline" style={{ display: "none" }}></button>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.primary, display: "flex" }}>
          <ArrowRight size={20} />
        </button>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{patient.name}</h2>
        <div style={{ marginRight: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => setShowFile(true)} style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}`, padding: "6px 12px", fontSize: 13 }}>
            <FileText size={14} /> תיק אישי
          </button>
          <IconBtn icon={Edit2} onClick={onEdit} title="עריכת פרטים" />
          <IconBtn icon={Trash2} onClick={onDelete} title="מחיקת כרטיס" danger />
        </div>
      </div>

      {showFile && <PatientFileView patient={patient} logoUrl={logoUrl} onClose={() => setShowFile(false)} />}

      {(patient.tags && patient.tags.length > 0) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
          {patient.tags.map((t) => <TagChip key={t} tag={t} />)}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "10px 0 14px", fontSize: 14, color: COLORS.muted }}>
        {patient.phone && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Phone size={14} /> {patient.phone}</span>}
        {patient.email && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Mail size={14} /> {patient.email}</span>}
        {(patient.emergencyContactName || patient.emergencyContactPhone) && (
          <span style={{ display: "flex", alignItems: "center", gap: 5 }} title="איש קשר לשעת חירום">
            <AlertCircle size={14} color={COLORS.clay} />
            איש קשר לחירום: {patient.emergencyContactName}{patient.emergencyContactName && patient.emergencyContactPhone ? " · " : ""}{patient.emergencyContactPhone}
          </span>
        )}
      </div>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
        background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <Clock size={15} color={COLORS.primary} />
          {patient.recurring?.enabled ? (
            <span>פגישה קבועה: כל יום <strong>{WEEKDAYS[patient.recurring.day]}</strong> בשעה <strong>{patient.recurring.time}</strong> ({patient.recurring.duration || DEFAULT_SESSION_DURATION} דק')</span>
          ) : (
            <span style={{ color: COLORS.muted }}>אין פגישה קבועה מוגדרת</span>
          )}
        </div>
        <button onClick={onEditRecurring} style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}`, padding: "6px 12px", fontSize: 13 }}>
          {patient.recurring?.enabled ? "עריכה" : "הגדרת פגישה קבועה"}
        </button>
      </div>

      {patient.treatmentGoals && (
        <div style={{ background: "#EFF3ED", border: `1px solid ${COLORS.sage}55`, borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 5, color: COLORS.primary }}><Target size={14} /> תוכנית טיפול / יעדים</div>
          {patient.treatmentGoals}
        </div>
      )}

      {patient.generalNotes && (
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 5, color: COLORS.primary }}><FileText size={14} /> רקע כללי</div>
          {patient.generalNotes}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: COLORS.primary }}>מסלול טיפולי</h3>
        <button onClick={onAddSession} style={{ ...btnPrimary(), width: "auto", background: COLORS.clay, padding: "7px 12px" }}>
          <CalendarPlus size={15} /> קביעת פגישה
        </button>
      </div>

      {occurrences.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          {occurrences.map((o, idx) => (
            <div key={o.virtual ? "v-" + o.date : o.session.id} style={{
              display: "flex", alignItems: "center", gap: 12, background: "#FDF4EC",
              border: `1px solid ${COLORS.clay}44`, borderRadius: 10, padding: "10px 14px", marginBottom: 8,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.clay, boxShadow: `0 0 0 4px ${COLORS.clay}22`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {idx === 0 ? "הפגישה הבאה" : "פגישה מתוכננת"} — {formatHeDate(o.date)}
                  {o.virtual && <span style={{ fontWeight: 400, color: COLORS.muted, fontSize: 12 }}> · מתגלגלת{patient.recurring?.type ? ` · ${patient.recurring.type}` : ""}</span>}
                  {!o.virtual && o.session.type && <span style={{ fontWeight: 400, color: COLORS.muted, fontSize: 12 }}> · {o.session.type}</span>}
                </div>
                <div style={{ fontSize: 13, color: COLORS.muted, display: "flex", alignItems: "center", gap: 4 }}><Clock size={12} /> {o.time}</div>
              </div>
              <IconBtn icon={CheckCircle2} onClick={() => (o.virtual ? onAddSessionAt(o.date, o.time, patient.recurring?.type, o.duration) : onEditSession(o.session))} title="עריכה / סיום פגישה" />
              <IconBtn icon={Download} onClick={() => generateICS(patient.name, o.date, o.time, o.virtual ? "" : o.session.notes, o.duration)} title="הורדה ליומן (ICS)" />
              <IconBtn icon={CalendarPlus} href={googleCalendarUrl(patient.name, o.date, o.time, o.virtual ? "" : o.session.notes, o.duration)} title="הוספה ל-Google Calendar" />
              <IconBtn icon={X} onClick={() => onCancelOccurrence(o)} title="ביטול פגישה" danger />
              {!o.virtual && <IconBtn icon={Trash2} onClick={() => onDeleteSession(o.session.id)} title="מחיקה" danger />}
            </div>
          ))}
        </div>
      )}

      {/* timeline */}
      <div style={{ position: "relative", paddingRight: 4 }}>
        {history.length === 0 && occurrences.length === 0 && (
          <div style={{ color: COLORS.muted, fontSize: 14, padding: "10px 0" }}>אין עדיין פגישות מתועדות.</div>
        )}
        {history.map((s, i) => {
          const cancelled = s.status === "cancelled";
          const completed = s.status === "completed";
          return (
            <div key={s.id} style={{ display: "flex", gap: 12, position: "relative" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 14 }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: cancelled ? COLORS.danger : completed ? COLORS.success : COLORS.border, marginTop: 5, flexShrink: 0 }} />
                {i < history.length - 1 && <div style={{ width: 2, flex: 1, background: COLORS.border, marginTop: 2 }} />}
              </div>
              <div style={{ flex: 1, paddingBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6, textDecoration: cancelled ? "line-through" : "none", color: cancelled ? COLORS.danger : COLORS.text }}>
                    {completed && <CheckCircle2 size={14} color={COLORS.success} />}
                    {formatHeDate(s.date)} · {s.time}
                    {cancelled && <span style={{ fontSize: 11, fontWeight: 700 }}>({s.charged ? "בוטלה בחיוב" : "בוטלה"})</span>}
                    {s.type && <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, background: COLORS.bg, borderRadius: 10, padding: "1px 8px" }}>{s.type}</span>}
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <IconBtn icon={Edit2} onClick={() => onEditSession(s)} small />
                    <IconBtn icon={Trash2} onClick={() => onDeleteSession(s.id)} small danger />
                  </div>
                </div>
                {cancelled && s.charged && s.cancelReason && (
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: COLORS.danger }}>סיבת החיוב: {s.cancelReason}</p>
                )}
                {s.notes ? (
                  <p style={{ margin: "4px 0 0", fontSize: 13.5, color: COLORS.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{s.notes}</p>
                ) : (
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted, fontStyle: "italic" }}>אין תיעוד לפגישה זו</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 26, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: COLORS.primary }}>מסמכים (הסכמים / טפסים)</h3>
        <button onClick={onAddDocument} style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}`, padding: "6px 12px", fontSize: 13 }}>
          <Plus size={14} /> מסמך חדש
        </button>
      </div>
      {(!patient.documents || patient.documents.length === 0) ? (
        <p style={{ color: COLORS.muted, fontSize: 13.5, marginBottom: 20 }}>אין עדיין מסמכים למטופל/ת זה/זו.</p>
      ) : (
        <div style={{ marginBottom: 20 }}>
          {patient.documents.map((doc) => <DocumentRow key={doc.id} doc={doc} patient={patient} />)}
        </div>
      )}
    </div>
  );
}

function DocumentRow({ doc, patient }) {
  const [copied, setCopied] = useState(false);
  async function copyContent() {
    try { await navigator.clipboard.writeText(doc.content); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  }
  const waHref = patient.phone
    ? `https://wa.me/${patient.phone.replace(/\D/g, "").replace(/^0/, "972")}?text=${encodeURIComponent(`שלום ${patient.name},\n\n${doc.content}`)}`
    : null;
  const gmailHref = buildGmailComposeLink(patient.email, doc.title, `שלום ${patient.name},\n\n${doc.content}`);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, flexWrap: "wrap" }}>
      <FileText size={16} color={COLORS.primary} />
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{doc.title}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.clay }}>נשלח (גרסת artifact — ללא חתימה דיגיטלית מרחוק; זמין רק בגרסת ה-HTML המתארחת)</div>
      </div>
      <button onClick={copyContent} style={{ ...btnPrimary(), width: "auto", background: copied ? COLORS.primaryLight : "transparent", color: copied ? "#fff" : COLORS.primary, border: `1px solid ${COLORS.border}`, padding: "6px 10px", fontSize: 12.5 }}>
        <Copy size={13} /> {copied ? "הועתק!" : "העתקת תוכן"}
      </button>
      {waHref && (
        <a href={waHref} target="_blank" rel="noopener noreferrer" style={{ ...btnPrimary(), width: "auto", background: "#25D366", padding: "6px 10px", fontSize: 12.5, textDecoration: "none" }}>
          <MessageCircle size={13} /> שליחה בוואטסאפ
        </a>
      )}
      <a href={gmailHref} target="_blank" rel="noopener noreferrer" style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}`, padding: "6px 10px", fontSize: 12.5, textDecoration: "none" }}>
        <Mail size={13} /> שליחה ב-Gmail
      </a>
    </div>
  );
}

function IconBtn({ icon: Icon, onClick, title, danger, small, href }) {
  const style = {
    width: small ? 24 : 30, height: small ? 24 : 30, borderRadius: 7, border: `1px solid ${COLORS.border}`,
    background: COLORS.surface, color: danger ? COLORS.danger : COLORS.primary, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, textDecoration: "none",
  };
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={title} style={style}>
        <Icon size={small ? 13 : 15} />
      </a>
    );
  }
  return (
    <button onClick={onClick} title={title} style={style}>
      <Icon size={small ? 13 : 15} />
    </button>
  );
}

function PatientFileView({ patient, logoUrl, onClose }) {
  const [tab, setTab] = useState("sessions");
  const [financeScope, setFinanceScope] = useState("all");
  const now = new Date();
  const [financeYear, setFinanceYear] = useState(now.getFullYear());
  const [financeMonth, setFinanceMonth] = useState(now.getMonth());

  const sessions = [...(patient.sessions || [])].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const cancelledCount = sessions.filter((s) => s.status === "cancelled").length;
  const billable = sessions.filter((s) => s.status === "completed" || (s.status === "cancelled" && s.charged));
  const totalCharged = billable.reduce((sum, s) => sum + (Number(s.price) || 0), 0);

  function statusLabel(s) {
    if (s.status === "completed") return "התקיימה";
    if (s.status === "cancelled") return s.charged ? "בוטלה (בחיוב)" : "בוטלה";
    return "מתוכננת";
  }
  function statusColor(s) {
    if (s.status === "completed") return COLORS.success;
    if (s.status === "cancelled") return COLORS.danger;
    return COLORS.clay;
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 300, overflowY: "auto" }}>
      <div className="no-print" style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px",
        borderBottom: `1px solid ${COLORS.border}`, position: "sticky", top: 0, background: "#fff", zIndex: 1, flexWrap: "wrap", gap: 10,
      }}>
        <h2 style={{ margin: 0, fontSize: 18, color: COLORS.primary }}>תיק אישי — {patient.name}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={{ ...btnPrimary(), width: "auto" }}>
            <Printer size={15} /> הדפסה
          </button>
          <button onClick={onClose} style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
            <X size={15} /> סגירה
          </button>
        </div>
      </div>

      <div className="no-print" style={{ display: "flex", gap: 8, padding: "10px 24px", borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap" }}>
        <TabButton label="פירוט פגישות" active={tab === "sessions"} onClick={() => setTab("sessions")} />
        <TabButton label="נתונים כספיים" active={tab === "finance"} onClick={() => setTab("finance")} />
      </div>

      {tab === "finance" && (
        <div className="no-print" style={{ display: "flex", gap: 14, alignItems: "center", padding: "10px 24px", borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap", fontSize: 13 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="radio" checked={financeScope === "all"} onChange={() => setFinanceScope("all")} /> כללי (כל הזמן)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="radio" checked={financeScope === "month"} onChange={() => setFinanceScope("month")} /> חודש ושנה ספציפיים
          </label>
          {financeScope === "month" && (
            <>
              <select value={financeMonth} onChange={(e) => setFinanceMonth(Number(e.target.value))} style={{ ...inputStyle(), width: "auto", padding: "6px 8px" }}>
                {HEB_MONTHS.map((mn, i) => <option key={i} value={i}>{mn}</option>)}
              </select>
              <input type="number" value={financeYear} onChange={(e) => setFinanceYear(Number(e.target.value))} style={{ ...inputStyle(), width: 90, padding: "6px 8px" }} />
            </>
          )}
        </div>
      )}

      <div className="print-area" style={{ padding: "28px 32px", maxWidth: 820, margin: "0 auto" }}>
        {logoUrl && <img src={logoUrl} alt="לוגו המרפאה" style={{ maxHeight: 56, marginBottom: 14, display: "block" }} />}
        <h1 style={{ fontSize: 22, marginBottom: 4, color: COLORS.primary }}>{patient.name}</h1>
        <div style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
          {patient.phone && <span>טלפון: {patient.phone}</span>}
          {patient.tags && patient.tags.length > 0 && <span>תגיות: {patient.tags.join(", ")}</span>}
          {patient.recurring?.enabled && <span>פגישה מתגלגלת: יום {WEEKDAYS[patient.recurring.day]}, {patient.recurring.time}</span>}
        </div>

        {tab === "sessions" ? (
          <>
            {patient.treatmentGoals && (
              <div style={{ marginBottom: 14, fontSize: 14, lineHeight: 1.6, background: "#EFF3ED", borderRadius: 8, padding: 12, whiteSpace: "pre-wrap" }}>
                <strong>תוכנית טיפול / יעדים: </strong>{patient.treatmentGoals}
              </div>
            )}
            {patient.generalNotes && (
              <div style={{ marginBottom: 20, fontSize: 14, lineHeight: 1.6, background: COLORS.bg, borderRadius: 8, padding: 12 }}>
                <strong>רקע כללי: </strong>{patient.generalNotes}
              </div>
            )}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
              <SummaryStat label="סה״כ פגישות שתועדו" value={sessions.length} />
              <SummaryStat label="התקיימו" value={completedCount} />
              <SummaryStat label="בוטלו" value={cancelledCount} />
            </div>
            <h3 style={{ fontSize: 16, color: COLORS.primary, marginBottom: 10, borderBottom: `2px solid ${COLORS.border}`, paddingBottom: 6 }}>היסטוריית פגישות (לפי תאריך)</h3>
            {sessions.length === 0 ? (
              <p style={{ color: COLORS.muted }}>אין פגישות מתועדות.</p>
            ) : (
              sessions.map((s) => (
                <div key={s.id} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "12px 0", breakInside: "avoid" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{formatHeDate(s.date)} · {s.time}{s.type && <span style={{ fontWeight: 400, color: COLORS.muted, fontSize: 12 }}> · {s.type}</span>}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: statusColor(s) }}>
                      {statusLabel(s)}{s.price ? ` · ₪${s.price}` : ""}
                    </span>
                  </div>
                  {s.status === "cancelled" && s.charged && s.cancelReason && (
                    <div style={{ fontSize: 12.5, color: COLORS.danger, marginTop: 3 }}>סיבת החיוב: {s.cancelReason}</div>
                  )}
                  {s.notes && <p style={{ fontSize: 13.5, marginTop: 5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{s.notes}</p>}
                </div>
              ))
            )}
          </>
        ) : (
          <FinanceSection billable={billable} scope={financeScope} year={financeYear} month={financeMonth} totalAllTime={totalCharged} patient={patient} />
        )}
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13.5, fontWeight: 600,
      border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
      background: active ? COLORS.primary : "transparent", color: active ? "#fff" : COLORS.text,
    }}>{label}</button>
  );
}

function FinanceSection({ billable, scope, year, month, totalAllTime, patient }) {
  const [copied, setCopied] = useState(false);
  const [copiedGI, setCopiedGI] = useState(false);
  const relevant = scope === "month"
    ? billable.filter((s) => { const [y, m] = s.date.split("-").map(Number); return y === year && m === month + 1; })
    : billable;

  async function copyBilling() {
    try {
      await navigator.clipboard.writeText(buildPatientBillingText(patient, relevant));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — no-op
    }
  }
  async function copyForGreenInvoice() {
    try {
      await navigator.clipboard.writeText(buildGreenInvoiceText(patient, relevant));
      setCopiedGI(true);
      window.open("https://www.greeninvoice.co.il/", "_blank", "noopener,noreferrer");
      setTimeout(() => setCopiedGI(false), 2500);
    } catch {
      // clipboard API unavailable — no-op
    }
  }

  const sessionIncome = relevant.filter((s) => s.status === "completed").reduce((a, s) => a + (Number(s.price) || 0), 0);
  const cancelIncome = relevant.filter((s) => s.status === "cancelled").reduce((a, s) => a + (Number(s.price) || 0), 0);
  const total = sessionIncome + cancelIncome;

  const groups = {};
  relevant.forEach((s) => { const key = s.date.slice(0, 7); groups[key] = groups[key] || []; groups[key].push(s); });
  const sortedKeys = Object.keys(groups).sort();

  return (
    <div>
      <h3 style={{ fontSize: 16, color: COLORS.primary, marginBottom: 4, borderBottom: `2px solid ${COLORS.border}`, paddingBottom: 6 }}>
        נתונים כספיים {scope === "month" ? `— ${HEB_MONTHS[month]} ${year}` : "— כללי (כל הזמן)"}
      </h3>
      <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
        <button onClick={copyBilling} disabled={relevant.length === 0}
          style={{ ...btnPrimary(), width: "auto", background: copied ? COLORS.primaryLight : COLORS.primary, opacity: relevant.length === 0 ? 0.5 : 1, cursor: relevant.length === 0 ? "not-allowed" : "pointer" }}>
          <Copy size={14} /> {copied ? "הועתק!" : "העתקת פרטי חיוב"}
        </button>
        <a href={buildMailtoLink(patient, relevant)}
          style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}`, textDecoration: "none", opacity: relevant.length === 0 ? 0.5 : 1, pointerEvents: relevant.length === 0 ? "none" : "auto" }}>
          <Mail size={14} /> שליחה במייל
        </a>
        <a href={buildGmailComposeLink(patient.email, `פרטי חיוב — ${patient.name}`, buildPatientBillingText(patient, relevant))}
          target="_blank" rel="noopener noreferrer"
          style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}`, textDecoration: "none", opacity: relevant.length === 0 ? 0.5 : 1, pointerEvents: relevant.length === 0 ? "none" : "auto" }}>
          <Mail size={14} /> שליחה ב-Gmail
        </a>
        <button onClick={copyForGreenInvoice} disabled={relevant.length === 0}
          style={{ ...btnPrimary(), width: "auto", background: copiedGI ? COLORS.primaryLight : "transparent", color: copiedGI ? "#fff" : COLORS.primary, border: `1px solid ${COLORS.border}`, opacity: relevant.length === 0 ? 0.5 : 1, cursor: relevant.length === 0 ? "not-allowed" : "pointer" }}>
          <Link2 size={14} /> {copiedGI ? "הועתק, פותח חשבונית ירוקה…" : "העתקה ופתיחה בחשבונית ירוקה"}
        </button>
      </div>
      <p style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 0, marginBottom: 16 }}>
        כולל פגישות שהתקיימו וביטולים שחויבו בלבד. סה"כ מצטבר לכל הזמן: ₪{totalAllTime}. "העתקת פרטי חיוב" מכינה טקסט מוכן להדבקה בחשבונית ירוקה או כל מערכת אחרת. "העתקה ופתיחה בחשבונית ירוקה" מכינה טקסט מפורמט לפי פריטים ופותחת את האתר להדבקה ידנית.
      </p>
      {relevant.length === 0 ? (
        <p style={{ color: COLORS.muted }}>אין נתוני תשלום בטווח שנבחר.</p>
      ) : (
        <>
          {sortedKeys.map((key) => {
            const [gy, gm] = key.split("-").map(Number);
            const items = [...groups[key]].sort((a, b) => a.date.localeCompare(b.date));
            const subtotal = items.reduce((a, s) => a + (Number(s.price) || 0), 0);
            return (
              <div key={key} style={{ marginBottom: 18, breakInside: "avoid" }}>
                {scope === "all" && (
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: COLORS.primary }}>{HEB_MONTHS[gm - 1]} {gy}</div>
                )}
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
                      <th style={{ textAlign: "right", padding: "4px 2px", fontWeight: 700 }}>תאריך</th>
                      <th style={{ textAlign: "right", padding: "4px 2px", fontWeight: 700 }}>תיאור</th>
                      <th style={{ textAlign: "left", padding: "4px 2px", fontWeight: 700 }}>סכום</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((s) => (
                      <tr key={s.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: "4px 2px" }}>{formatHeDate(s.date)}</td>
                        <td style={{ padding: "4px 2px", color: s.status === "cancelled" ? COLORS.danger : COLORS.text }}>
                          {s.status === "cancelled" ? `ביטול בחיוב${s.cancelReason ? " — " + s.cancelReason : ""}` : (s.type || "פגישה")}
                        </td>
                        <td style={{ padding: "4px 2px", textAlign: "left" }}>₪{Number(s.price) || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ textAlign: "left", fontWeight: 700, fontSize: 13, marginTop: 4 }}>סה"כ לחודש: ₪{subtotal}</div>
              </div>
            );
          })}
          <div style={{ background: COLORS.bg, borderRadius: 8, padding: "12px 16px", marginTop: 6, fontSize: 13.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>הכנסה מפגישות</span><span>₪{sessionIncome}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>חיובי ביטול</span><span>₪{cancelIncome}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 15, marginTop: 6, borderTop: `1px solid ${COLORS.border}`, paddingTop: 6 }}>
              <span>סה"כ לתקופה</span><span>₪{total}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryStat({ label, value, highlight }) {
  return (
    <div style={{
      flex: "1 1 130px", background: highlight ? COLORS.primary : COLORS.bg, color: highlight ? "#fff" : COLORS.text,
      borderRadius: 10, padding: "10px 14px",
    }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 12, opacity: 0.85 }}>{label}</div>
    </div>
  );
}

function PatientFormModal({ initial, allPatients, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [tags, setTags] = useState(initial?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [generalNotes, setGeneralNotes] = useState(initial?.generalNotes || "");
  const [treatmentGoals, setTreatmentGoals] = useState(initial?.treatmentGoals || "");
  const [sessionRate, setSessionRate] = useState(initial?.sessionRate ?? "");
  const [emergencyContactName, setEmergencyContactName] = useState(initial?.emergencyContactName || "");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(initial?.emergencyContactPhone || "");
  const [recurringEnabled, setRecurringEnabled] = useState(initial?.recurring?.enabled || false);
  const [recurringDay, setRecurringDay] = useState(initial?.recurring?.day ?? 0);
  const [recurringTime, setRecurringTime] = useState(initial?.recurring?.time || "10:00");
  const [recurringDuration, setRecurringDuration] = useState(initial?.recurring?.duration ?? DEFAULT_SESSION_DURATION);

  const [pendingConflict, setPendingConflict] = useState(null);

  function addTag() {
    const v = tagInput.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setTagInput("");
  }

  function doSave(recurring) {
    onSave({ name: name.trim(), phone, email, tags, generalNotes, treatmentGoals, sessionRate: sessionRate === "" ? 0 : Number(sessionRate), emergencyContactName: emergencyContactName.trim(), emergencyContactPhone: emergencyContactPhone.trim(), recurring });
  }

  function handleSave() {
    const recurring = recurringEnabled ? { enabled: true, day: recurringDay, time: recurringTime, duration: Number(recurringDuration) || DEFAULT_SESSION_DURATION } : null;
    if (recurring) {
      const nd = nextDateForWeekday(recurring.day);
      const conflictName = findConflict(allPatients, nd, recurring.time, recurring.duration, initial?.id);
      if (conflictName) { setPendingConflict({ name: conflictName, recurring, nd }); return; }
    }
    doSave(recurring);
  }

  return (
    <Modal title={initial ? "עריכת פרטי מטופל/ת" : "מטופל/ת חדש/ה"} onClose={onClose}>
      <Field label="שם מלא *">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} style={inputStyle()} placeholder="לדוגמה: דנה כהן" />
      </Field>
      <Field label="טלפון">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle()} placeholder="050-0000000" />
      </Field>
      <Field label="אימייל (לשליחת קבלות)">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle()} placeholder="name@example.com" />
      </Field>
      <Field label="תגיות (התמחות / נושא טיפול)">
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {tags.map((t) => <TagChip key={t} tag={t}
            onRemove={() => setTags(tags.filter((x) => x !== t))}
            onEdit={(val) => { setTagInput(val); setTags(tags.filter((x) => x !== val)); }}
          />)}
        </div>
        {tags.length > 0 && <p style={{ fontSize: 11.5, color: COLORS.muted, margin: "0 0 6px" }}>לחיצה על תגית קיימת טוענת אותה לעריכה.</p>}
        <div style={{ display: "flex", gap: 6 }}>
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            style={{ ...inputStyle(), flex: 1 }} placeholder="לדוגמה: טראומה, אוטיזם…" />
          <button onClick={addTag} style={{ ...btnPrimary(), width: "auto", padding: "0 14px" }}>הוספה</button>
        </div>
      </Field>
      <Field label="רקע כללי / הערות קבועות">
        <textarea value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} rows={4}
          style={{ ...inputStyle(), resize: "vertical" }} placeholder="מידע רקע, נקודות חשובות…" />
      </Field>
      <Field label="תוכנית טיפול / יעדים">
        <textarea value={treatmentGoals} onChange={(e) => setTreatmentGoals(e.target.value)} rows={4}
          style={{ ...inputStyle(), resize: "vertical" }} placeholder="יעדי הטיפול לטווח הארוך ומעקב התקדמות (נפרד מהערות הרקע הכלליות)…" />
      </Field>
      <Field label="מחיר לפגישה (₪) — ברירת מחדל">
        <input type="number" min="0" value={sessionRate} onChange={(e) => setSessionRate(e.target.value)} style={inputStyle()} placeholder="לדוגמה: 350" />
      </Field>
      <Field label="איש קשר לשעת חירום — שם">
        <input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} style={inputStyle()} placeholder="לדוגמה: בן/בת זוג, הורה…" />
      </Field>
      <Field label="איש קשר לשעת חירום — טלפון">
        <input value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} style={inputStyle()} placeholder="050-0000000" />
      </Field>
      <Field label="פגישה מתגלגלת (שבועית קבועה)">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: recurringEnabled ? 10 : 0, cursor: "pointer" }}>
          <input type="checkbox" checked={recurringEnabled} onChange={(e) => setRecurringEnabled(e.target.checked)} />
          קביעת יום ושעה קבועים בכל שבוע
        </label>
        {recurringEnabled && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={recurringDay} onChange={(e) => setRecurringDay(Number(e.target.value))} style={inputStyle()}>
              {WEEKDAYS.map((w, i) => <option key={i} value={i}>יום {w}</option>)}
            </select>
            <input type="time" value={recurringTime} onChange={(e) => setRecurringTime(e.target.value)} style={inputStyle()} />
            <input type="number" min="10" step="5" value={recurringDuration} onChange={(e) => setRecurringDuration(e.target.value)}
              style={{ ...inputStyle(), width: 100 }} title="משך הפגישה בדקות (כולל הפסקה)" placeholder="60" />
          </div>
        )}
      </Field>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button disabled={!name.trim()} onClick={handleSave}
          style={{ ...btnPrimary(), opacity: name.trim() ? 1 : 0.5, cursor: name.trim() ? "pointer" : "not-allowed" }}>
          שמירה
        </button>
        <button onClick={onClose} style={{ ...btnPrimary(), background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}` }}>ביטול</button>
      </div>
      {pendingConflict && (
        <ConfirmModal
          title="התנגשות בלוח הזמנים"
          body={`כבר קיימת פגישה למטופל/ת ${pendingConflict.name} ביום ${WEEKDAYS[pendingConflict.recurring.day]} בשעה ${pendingConflict.recurring.time} (למשל בתאריך ${formatShortDate(pendingConflict.nd)}). לשמור בכל זאת?`}
          onConfirm={() => { const r = pendingConflict.recurring; setPendingConflict(null); doSave(r); }}
          onCancel={() => setPendingConflict(null)}
        />
      )}
    </Modal>
  );
}

function RecurringFormModal({ patient, allPatients, sessionTypes, onAddSessionType, onSave, onClose }) {
  const existing = patient.recurring;
  const [day, setDay] = useState(existing?.day ?? 0);
  const [time, setTime] = useState(existing?.time || "10:00");
  const [duration, setDuration] = useState(existing?.duration ?? DEFAULT_SESSION_DURATION);
  const [type, setType] = useState(existing?.type || "");
  const [addingType, setAddingType] = useState(false);
  const [newTypeInput, setNewTypeInput] = useState("");
  const [pendingConflict, setPendingConflict] = useState(null);
  const [confirmStop, setConfirmStop] = useState(false);

  function commitNewType() {
    const v = newTypeInput.trim();
    if (!v) return;
    if (!sessionTypes.includes(v)) onAddSessionType(v);
    setType(v);
    setAddingType(false);
    setNewTypeInput("");
  }

  function handleSave() {
    const nd = nextDateForWeekday(day);
    const dur = Number(duration) || DEFAULT_SESSION_DURATION;
    const conflictName = findConflict(allPatients, nd, time, dur, patient.id);
    if (conflictName) { setPendingConflict({ name: conflictName, nd }); return; }
    onSave({ enabled: true, day, time, duration: dur, type });
  }

  return (
    <Modal title={existing?.enabled ? "עריכת פגישה קבועה" : "הגדרת פגישה קבועה שבועית"} onClose={onClose} small>
      <Field label="יום קבוע בשבוע">
        <select value={day} onChange={(e) => setDay(Number(e.target.value))} style={inputStyle()}>
          {WEEKDAYS.map((w, i) => <option key={i} value={i}>יום {w}</option>)}
        </select>
      </Field>
      <Field label="שעה קבועה">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle()} />
      </Field>
      <Field label="משך הפגישה (בדקות, כולל הפסקה)">
        <input type="number" min="10" step="5" value={duration} onChange={(e) => setDuration(e.target.value)} style={inputStyle()} placeholder="60" />
      </Field>
      <Field label="סוג פגישה (ברירת מחדל לפגישות אלו)">
        {!addingType ? (
          <select value={type} onChange={(e) => { if (e.target.value === "__new__") setAddingType(true); else setType(e.target.value); }} style={inputStyle()}>
            <option value="">— ללא —</option>
            {sessionTypes.map((st) => <option key={st} value={st}>{st}</option>)}
            <option value="__new__">+ הוספת סוג חדש…</option>
          </select>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <input autoFocus value={newTypeInput} onChange={(e) => setNewTypeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitNewType(); } }}
              style={{ ...inputStyle(), flex: 1 }} placeholder="שם סוג פגישה חדש" />
            <button onClick={commitNewType} style={{ ...btnPrimary(), width: "auto", padding: "0 14px" }}>הוספה</button>
            <button onClick={() => { setAddingType(false); setNewTypeInput(""); }} style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}` }}>ביטול</button>
          </div>
        )}
      </Field>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button onClick={handleSave} style={{ ...btnPrimary(), width: "auto", flex: 1 }}>שמירה</button>
        {existing?.enabled && (
          <button onClick={() => setConfirmStop(true)} style={{ ...btnPrimary(), width: "auto", background: COLORS.danger }}>הפסקת הפגישה הקבועה</button>
        )}
        <button onClick={onClose} style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}` }}>ביטול</button>
      </div>
      {pendingConflict && (
        <ConfirmModal
          title="התנגשות בלוח הזמנים"
          body={`כבר קיימת פגישה למטופל/ת ${pendingConflict.name} ביום ${WEEKDAYS[day]} בשעה ${time} (למשל בתאריך ${formatShortDate(pendingConflict.nd)}). לשמור בכל זאת?`}
          onConfirm={() => { setPendingConflict(null); onSave({ enabled: true, day, time, duration: Number(duration) || DEFAULT_SESSION_DURATION, type }); }}
          onCancel={() => setPendingConflict(null)}
        />
      )}
      {confirmStop && (
        <ConfirmModal
          title="הפסקת הפגישה הקבועה?"
          body={`הפגישה השבועית הקבועה של ${patient.name} תופסק. פגישות שכבר תועדו יישארו בהיסטוריה כרגיל.`}
          onConfirm={() => { setConfirmStop(false); onSave(null); }}
          onCancel={() => setConfirmStop(false)}
        />
      )}
    </Modal>
  );
}

function SessionFormModal({ patientName, patientId, allPatients, initial, defaultPrice, defaultDuration, prefillDate, prefillTime, prefillType, prefillDuration, forceStatus, sessionTypes, onAddSessionType, onSave, onClose }) {
  const [date, setDate] = useState(initial?.date || prefillDate || todayStr());
  const [time, setTime] = useState(initial?.time || prefillTime || "10:00");
  const [duration, setDuration] = useState(initial?.duration ?? prefillDuration ?? defaultDuration ?? DEFAULT_SESSION_DURATION);
  const [status, setStatus] = useState(forceStatus || initial?.status || "scheduled");
  const [notes, setNotes] = useState(initial?.notes ?? (formatHeDate(initial?.date || prefillDate || todayStr()) + "\n"));
  const [price, setPrice] = useState(initial?.price ?? defaultPrice ?? "");
  const [type, setType] = useState(initial?.type || prefillType || "");
  const [addingType, setAddingType] = useState(false);
  const [newTypeInput, setNewTypeInput] = useState("");
  const [charged, setCharged] = useState(initial?.charged || false);
  const [cancelReason, setCancelReason] = useState(initial?.cancelReason || "ביטול לקוח ברגע האחרון");
  const [recording, setRecording] = useState(false);
  const [dictationSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const [showDictationInfo, setShowDictationInfo] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => () => { try { recognitionRef.current?.stop(); } catch {} }, []);

  function toggleDictation() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setShowDictationInfo(true); return; }
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const recognition = new SR();
    recognition.lang = "he-IL";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      }
      if (finalText) {
        setNotes((prev) => prev + (prev && !prev.endsWith("\n") && !prev.endsWith(" ") ? " " : "") + finalText);
      }
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  const [pendingConflict, setPendingConflict] = useState(null);

  function commitNewType() {
    const v = newTypeInput.trim();
    if (!v) return;
    if (!sessionTypes.includes(v)) onAddSessionType(v);
    setType(v);
    setAddingType(false);
    setNewTypeInput("");
  }

  function doSave() {
    const isCancelled = status === "cancelled";
    onSave({
      date, time, status, notes, type,
      duration: Number(duration) || DEFAULT_SESSION_DURATION,
      price: isCancelled && !charged ? 0 : (price === "" ? 0 : Number(price)),
      charged: isCancelled ? charged : false,
      cancelReason: isCancelled && charged ? cancelReason.trim() : "",
    });
  }

  function handleSave() {
    const conflictName = findConflict(allPatients, date, time, Number(duration) || DEFAULT_SESSION_DURATION, patientId, initial?.id);
    if (conflictName) { setPendingConflict(conflictName); return; }
    doSave();
  }

  return (
    <Modal title={initial ? `עדכון פגישה — ${patientName}` : `קביעת פגישה — ${patientName}`} onClose={onClose}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Field label="תאריך" style={{ flex: 1 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle()} />
        </Field>
        <Field label="שעה" style={{ flex: 1 }}>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle()} />
        </Field>
        <Field label="משך (דק')" style={{ flex: "0 0 90px" }}>
          <input type="number" min="10" step="5" value={duration} onChange={(e) => setDuration(e.target.value)} style={inputStyle()} placeholder="60" />
        </Field>
      </div>
      <Field label="סוג פגישה">
        {!addingType ? (
          <select value={type} onChange={(e) => { if (e.target.value === "__new__") setAddingType(true); else setType(e.target.value); }} style={inputStyle()}>
            <option value="">— ללא —</option>
            {sessionTypes.map((st) => <option key={st} value={st}>{st}</option>)}
            <option value="__new__">+ הוספת סוג חדש…</option>
          </select>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <input autoFocus value={newTypeInput} onChange={(e) => setNewTypeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitNewType(); } }}
              style={{ ...inputStyle(), flex: 1 }} placeholder="שם סוג פגישה חדש" />
            <button onClick={commitNewType} style={{ ...btnPrimary(), width: "auto", padding: "0 14px" }}>הוספה</button>
            <button onClick={() => { setAddingType(false); setNewTypeInput(""); }} style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}` }}>ביטול</button>
          </div>
        )}
      </Field>
      <Field label="סטטוס">
        <div style={{ display: "flex", gap: 8 }}>
          <StatusBtn label="מתוכננת" active={status === "scheduled"} onClick={() => setStatus("scheduled")} />
          <StatusBtn label="התקיימה" active={status === "completed"} onClick={() => setStatus("completed")} />
          <StatusBtn label="בוטלה" active={status === "cancelled"} onClick={() => setStatus("cancelled")} danger />
        </div>
      </Field>
      {status === "cancelled" && (
        <Field label="חיוב על הביטול">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: charged ? 10 : 0, cursor: "pointer" }}>
            <input type="checkbox" checked={charged} onChange={(e) => setCharged(e.target.checked)} />
            לחייב על הביטול
          </label>
          {charged && (
            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} style={inputStyle()} placeholder="סיבת החיוב (למשל: ביטול לקוח ברגע האחרון)" />
          )}
        </Field>
      )}
      <Field label="מחיר הפגישה (₪)">
        <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} style={inputStyle()} placeholder="לדוגמה: 350" />
      </Field>
      <Field label="תיעוד הפגישה">
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 6 }}>
          {type && SESSION_NOTE_TEMPLATES[type] && (
            <button type="button" onClick={() => setNotes((prev) => prev + (prev && !prev.endsWith("\n") ? "\n" : "") + SESSION_NOTE_TEMPLATES[type])}
              title="טעינת תבנית תיעוד לפי סוג הפגישה"
              style={{
                display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600,
                padding: "5px 10px", borderRadius: 20, border: `1px solid ${COLORS.border}`,
                background: "transparent", color: COLORS.primary, cursor: "pointer",
              }}>
              <ClipboardList size={13} /> טען תבנית
            </button>
          )}
          <button type="button" onClick={toggleDictation} disabled={!dictationSupported}
            title={dictationSupported ? "הכתבה קולית" : "לא נתמך בדפדפן זה"}
            style={{
              display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600,
              padding: "5px 10px", borderRadius: 20, border: `1px solid ${recording ? COLORS.danger : COLORS.border}`,
              background: recording ? COLORS.danger : "transparent", color: recording ? "#fff" : (dictationSupported ? COLORS.primary : COLORS.muted),
              cursor: dictationSupported ? "pointer" : "not-allowed",
            }}>
            {recording ? <Square size={13} /> : <Mic size={13} />}
            {recording ? "עצירת הקלטה…" : "הכתבה קולית"}
          </button>
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5}
          style={{ ...inputStyle(), resize: "vertical" }} placeholder="מה עלה בפגישה, תובנות, מטלות להמשך…" />
      </Field>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button onClick={handleSave} style={{ ...btnPrimary(), width: "auto", flex: 1 }}>שמירה</button>
        <button onClick={() => generateICS(patientName, date, time, notes, Number(duration) || DEFAULT_SESSION_DURATION)} style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}` }}>
          <Download size={15} /> ליומן
        </button>
        <a href={googleCalendarUrl(patientName, date, time, notes, Number(duration) || DEFAULT_SESSION_DURATION)} target="_blank" rel="noopener noreferrer"
          style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}`, textDecoration: "none" }}>
          <CalendarPlus size={15} /> Google
        </a>
        <button onClick={onClose} style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}` }}>ביטול</button>
      </div>
      {pendingConflict && (
        <ConfirmModal
          title="התנגשות בלוח הזמנים"
          body={`כבר קיימת פגישה למטופל/ת ${pendingConflict} בתאריך ${formatShortDate(date)} בשעה ${time}. לשמור בכל זאת?`}
          onConfirm={() => { setPendingConflict(null); doSave(); }}
          onCancel={() => setPendingConflict(null)}
        />
      )}
      {showDictationInfo && (
        <InfoModal
          title="הכתבה קולית לא נתמכת"
          body="הכתבה קולית נתמכת רק בדפדפן Chrome (במחשב או באנדרואיד)."
          onClose={() => setShowDictationInfo(false)}
        />
      )}
    </Modal>
  );
}

function StatusBtn({ label, active, onClick, danger }) {
  const activeColor = danger ? COLORS.danger : COLORS.primary;
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13.5, fontWeight: 600,
      border: `1px solid ${active ? activeColor : COLORS.border}`,
      background: active ? activeColor : "transparent", color: active ? "#fff" : COLORS.text,
    }}>{label}</button>
  );
}

function ConfirmModal({ title, body, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel} small>
      <p style={{ fontSize: 14, color: COLORS.muted, lineHeight: 1.6, margin: "0 0 16px" }}>{body}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onConfirm} style={{ ...btnPrimary(), background: COLORS.danger }}>כן, למחוק</button>
        <button onClick={onCancel} style={{ ...btnPrimary(), background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}` }}>ביטול</button>
      </div>
    </Modal>
  );
}
function InfoModal({ title, body, onClose }) {
  return (
    <Modal title={title} onClose={onClose} small>
      <p style={{ fontSize: 14, color: COLORS.muted, lineHeight: 1.6, margin: "0 0 16px" }}>{body}</p>
      <button onClick={onClose} style={btnPrimary()}>הבנתי</button>
    </Modal>
  );
}

const DEFAULT_DOCUMENT_TEMPLATES = {
  "הסכם טיפול": `הסכם טיפול\n\nאני הח"מ, {שם המטופל}, מאשר/ת כי אני מסכים/ה לקבל טיפול במסגרת המרפאה.\nהובהר לי כי הטיפול מבוסס על שיתוף פעולה מלא, וכי ניתן להפסיק את הטיפול בכל עת בהודעה מראש.\nידוע לי כי מידע אישי שישותף במסגרת הטיפול יישמר בסודיות, בכפוף לחריגים על פי חוק (כגון סיכון ממשי לחיי אדם).`,
  "שאלון קבלה למטופל חדש": `שאלון קבלה\n\nשם מלא: {שם המטופל}\n\nנא למלא/עדכן בפגישה הראשונה:\n- סיבת הפנייה:\n- רקע רפואי/נפשי רלוונטי:\n- תרופות קבועות (אם יש):\n- ציפיות מהטיפול:`,
  "ויתור סודיות": `כתב ויתור סודיות\n\nאני הח"מ, {שם המטופל}, מאשר/ת ומרשה/ה למטפל/ת לשתף מידע הנוגע לטיפולי עם הגורם/המוסד הבא (יש לפרט בעת השליחה):\n\n[פרטי הגורם ומטרת השיתוף]\n\nהרשאה זו תקפה עד לביטול בכתב.`,
};
function DocumentModal({ patient, templates, logoUrl, onSave, onClose }) {
  const templateKeys = [...Object.keys(templates), "מותאם אישית"];
  const [templateKey, setTemplateKey] = useState(templateKeys[0]);
  const [title, setTitle] = useState(templateKeys[0]);
  const [content, setContent] = useState((templates[templateKeys[0]] || "").replace(/\{שם המטופל\}/g, patient.name));

  function pickTemplate(key) {
    setTemplateKey(key);
    setTitle(key === "מותאם אישית" ? "" : key);
    setContent(key === "מותאם אישית" ? "" : (templates[key] || "").replace(/\{שם המטופל\}/g, patient.name));
  }
  function handleSend() {
    if (!title.trim() || !content.trim()) return;
    onSave({ title: title.trim(), content });
  }

  return (
    <Modal title={`מסמך חדש — ${patient.name}`} onClose={onClose}>
      {logoUrl && <img src={logoUrl} alt="לוגו המרפאה" style={{ maxHeight: 44, marginBottom: 14, display: "block" }} />}
      <Field label="סוג מסמך">
        <select value={templateKey} onChange={(e) => pickTemplate(e.target.value)} style={inputStyle()}>
          {templateKeys.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </Field>
      <Field label="כותרת המסמך"><input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle()} /></Field>
      <Field label="תוכן המסמך (ניתן לעריכה)">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} style={{ ...inputStyle(), resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }} />
      </Field>
      <p style={{ fontSize: 12, color: COLORS.muted, margin: "0 0 14px", lineHeight: 1.5 }}>
        בגרסת ה-artifact הזו (localStorage) אין קישור לחתימה דיגיטלית מרחוק — ניתן להעתיק את התוכן או לשלוח בוואטסאפ/Gmail. חתימה דיגיטלית אמיתית זמינה בגרסת ה-HTML המתארחת בלבד.
      </p>
      <button onClick={handleSend} disabled={!title.trim() || !content.trim()} style={btnPrimary()}>יצירה ושליחה</button>
    </Modal>
  );
}
function SettingsModal({ settings, onSaveSettings, templates, onSaveTemplates, logoUrl, onUploadLogo, onClose }) {
  const [tab, setTab] = useState("reminders");

  const [hoursBefore, setHoursBefore] = useState(settings.hoursBefore ?? 24);
  const [template, setTemplate] = useState(settings.template || "");
  const [preview, setPreview] = useState(null);
  function handleSaveReminders() { onSaveSettings({ ...settings, hoursBefore: Number(hoursBefore) || 24, template }); }
  function showPreview() {
    const sample = template
      .replace("{שם המטופל}", "דנה כהן")
      .replace("{תאריך}", formatShortDate(todayStr()))
      .replace("{שעה}", "10:00")
      .replace("{שם המרפאה}", "מרפאה — כרטיסי מטופלים");
    setPreview(sample);
  }

  const [localTemplates, setLocalTemplates] = useState(templates);
  function updateTemplate(key, val) { setLocalTemplates((prev) => ({ ...prev, [key]: val })); }
  function resetTemplate(key) { setLocalTemplates((prev) => ({ ...prev, [key]: DEFAULT_DOCUMENT_TEMPLATES[key] })); }
  function handleSaveTemplates() { onSaveTemplates(localTemplates); }

  const [logoError, setLogoError] = useState("");
  const fileInputRef = useRef(null);
  function handleLogoFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setLogoError("");
    const reader = new FileReader();
    reader.onload = () => onUploadLogo(reader.result);
    reader.onerror = () => setLogoError("קריאת הקובץ נכשלה. נסי קובץ תמונה אחר.");
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <Modal title="הגדרות המרפאה" onClose={onClose}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <TabButton label="תזכורות" active={tab === "reminders"} onClick={() => setTab("reminders")} />
        <TabButton label="תבניות מסמכים" active={tab === "templates"} onClick={() => setTab("templates")} />
        <TabButton label="לוגו" active={tab === "logo"} onClick={() => setTab("logo")} />
      </div>

      {tab === "reminders" && (
        <>
          <div style={{ background: "#FDF4EC", border: `1px solid ${COLORS.clay}44`, borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, lineHeight: 1.6 }}>
            <strong>בקרוב:</strong> תזכורות אוטומטיות ב-SMS/וואטסאפ למטופלים לפני פגישה. הפיצ׳ר דורש חיבור לשירות שליחת הודעות חיצוני שטרם חובר. ניתן כבר עכשיו להכין את התבנית והתזמון מראש.
          </div>
          <Field label="כמה שעות לפני הפגישה לשלוח תזכורת">
            <input type="number" min="1" value={hoursBefore} onChange={(e) => setHoursBefore(e.target.value)} style={inputStyle()} />
          </Field>
          <Field label="תבנית ההודעה — ניתן להשתמש ב-{שם המטופל} {תאריך} {שעה} {שם המרפאה}">
            <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={4} style={{ ...inputStyle(), resize: "vertical" }} />
          </Field>
          <button onClick={showPreview} style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}`, marginBottom: 14 }}>תצוגה מקדימה</button>
          {preview && <div style={{ background: COLORS.bg, borderRadius: 8, padding: 12, fontSize: 13.5, lineHeight: 1.6, marginBottom: 14, whiteSpace: "pre-wrap" }}>{preview}</div>}
          <button onClick={handleSaveReminders} style={btnPrimary()}>שמירת הגדרות תזכורות</button>
        </>
      )}

      {tab === "templates" && (
        <>
          <p style={{ fontSize: 12.5, color: COLORS.muted, margin: "0 0 14px", lineHeight: 1.5 }}>
            אפשר להתאים כל תבנית לקליניקה של ריקי. השתמשי ב-{"{שם המטופל}"} במקום שבו רוצים שהשם יופיע אוטומטית בעת יצירת מסמך חדש.
          </p>
          {Object.keys(DEFAULT_DOCUMENT_TEMPLATES).map((key) => (
            <Field key={key} label={key}>
              <textarea value={localTemplates[key] || ""} onChange={(e) => updateTemplate(key, e.target.value)} rows={6}
                style={{ ...inputStyle(), resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, marginBottom: 6 }} />
              <button onClick={() => resetTemplate(key)} style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.muted, border: `1px solid ${COLORS.border}`, fontSize: 12.5, padding: "5px 10px" }}>
                שחזור לברירת מחדל
              </button>
            </Field>
          ))}
          <button onClick={handleSaveTemplates} style={btnPrimary()}>שמירת תבניות</button>
        </>
      )}

      {tab === "logo" && (
        <>
          <p style={{ fontSize: 12.5, color: COLORS.muted, margin: "0 0 14px", lineHeight: 1.5 }}>
            הלוגו יופיע גדול במסך הכניסה, ובגודל קטן בכותרת האפליקציה, בתיק האישי להדפסה, ובמסמכים. נשמר מקומית בדפדפן הזה בלבד (גרסת artifact).
          </p>
          {logoUrl && <img src={logoUrl} alt="הלוגו הנוכחי" style={{ maxWidth: 220, maxHeight: 140, marginBottom: 14, display: "block", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 8 }} />}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoFile} style={{ display: "none" }} />
          <button onClick={() => fileInputRef.current?.click()} style={btnPrimary()}>
            <Upload size={14} /> {logoUrl ? "החלפת לוגו" : "העלאת לוגו"}
          </button>
          {logoError && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 10 }}>{logoError}</div>}
        </>
      )}
    </Modal>
  );
}

function ChangePasswordModal({ onClose }) {
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSave() {
    try {
      const res = await window.storage.get(AUTH_KEY);
      const oldHash = await sha256Hex(oldPwd);
      if (!res || res.value !== oldHash) { setError("הסיסמה הנוכחית שגויה."); return; }
      if (newPwd.length < 4) { setError("הסיסמה החדשה צריכה להיות לפחות 4 תווים."); return; }
      if (newPwd !== newPwd2) { setError("הסיסמאות החדשות לא תואמות."); return; }
      const newHash = await sha256Hex(newPwd);
      await window.storage.set(AUTH_KEY, newHash);
      setDone(true);
    } catch {
      setError("שגיאה בשמירת הסיסמה. נסי שוב.");
    }
  }

  return (
    <Modal title="שינוי סיסמה" onClose={onClose} small>
      {done ? (
        <>
          <p style={{ fontSize: 14, color: COLORS.muted, lineHeight: 1.6, margin: "0 0 16px" }}>הסיסמה עודכנה בהצלחה.</p>
          <button onClick={onClose} style={btnPrimary()}>סגירה</button>
        </>
      ) : (
        <>
          <Field label="סיסמה נוכחית"><input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} style={inputStyle()} /></Field>
          <Field label="סיסמה חדשה"><input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} style={inputStyle()} /></Field>
          <Field label="אימות סיסמה חדשה"><input type="password" value={newPwd2} onChange={(e) => setNewPwd2(e.target.value)} style={inputStyle()} /></Field>
          {error && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} style={{ ...btnPrimary(), width: "auto", flex: 1 }}>שמירה</button>
            <button onClick={onClose} style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}` }}>ביטול</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function BackupModal({ patients, sessionTypes, onMerge, onClose }) {
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { added, updated }
  const fileInputRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setError(""); setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.patients)) throw new Error("bad-shape");
        const { merged, added, updated } = mergePatients(patients, parsed.patients);
        const mergedTypes = Array.from(new Set([...(sessionTypes || []), ...((parsed.sessionTypes) || [])]));
        onMerge(merged, mergedTypes);
        setResult({ added, updated });
      } catch {
        setError("קובץ הגיבוי לא תקין או פגום. ודאי שזה קובץ JSON שיוצא מהאפליקציה הזו.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <Modal title="גיבוי ושחזור נתונים" onClose={onClose} small>
      <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6, margin: "0 0 16px" }}>
        גיבוי מוריד קובץ עם כל המטופלים והפגישות. שחזור ממזג קובץ גיבוי עם הנתונים הקיימים —
        <strong> שום דבר לא נמחק</strong>: מטופלים ופגישות שקיימים רק כאן נשארים, ומה שקיים בשני המקומות מתעדכן לפי הגרסה העדכנית ביותר.
      </p>
      <button onClick={() => exportBackup(patients, sessionTypes)} style={{ ...btnPrimary(), marginBottom: 10 }}>
        <Download size={16} /> הורדת גיבוי
      </button>
      <button onClick={() => fileInputRef.current?.click()} style={{ ...btnPrimary(), background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}` }}>
        <Upload size={16} /> שחזור מקובץ גיבוי
      </button>
      <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleFile} style={{ display: "none" }} />
      {error && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 10 }}>{error}</div>}
      {result && (
        <div style={{ background: "#EFF3ED", color: COLORS.primary, fontSize: 13, borderRadius: 8, padding: 10, marginTop: 10, lineHeight: 1.6 }}>
          השחזור הושלם. נוספו {result.added} מטופלים חדשים, עודכנו {result.updated} קיימים. שום דבר לא נמחק.
        </div>
      )}
      <button onClick={onClose} style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}`, marginTop: 14 }}>סגירה</button>
    </Modal>
  );
}

function Modal({ title, children, onClose, small }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(36,68,63,0.35)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} className="scrollbar" style={{
        background: COLORS.surface, borderRadius: 14, padding: 22, width: "100%",
        maxWidth: small ? 380 : 440, maxHeight: "88vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: COLORS.primary }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: COLORS.muted, marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function inputStyle() {
  return { width: "100%", padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, background: "#fff", color: COLORS.text };
}

function CalendarView({ patients, calMonth, setCalMonth, onPickPatient }) {
  const { y, m } = calMonth;
  const first = new Date(y, m, 1);
  const startOffset = first.getDay(); // 0=Sun
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthStart = `${y}-${pad(m + 1)}-01`;
  const monthEnd = `${y}-${pad(m + 1)}-${pad(daysInMonth)}`;

  const byDate = useMemo(() => {
    const map = {};
    (patients || []).forEach((p) => {
      getOccurrencesInRange(p, monthStart, monthEnd).forEach((o) => {
        map[o.date] = map[o.date] || [];
        map[o.date].push({ ...o, patientId: p.id, patientName: p.name });
      });
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.time.localeCompare(b.time)));
    return map;
  }, [patients, monthStart, monthEnd]);

  const t = todayStr();
  const upcoming = useMemo(() => {
    const future = new Date(); future.setDate(future.getDate() + 30);
    const rangeEnd = fmtDate(future);
    const list = [];
    (patients || []).forEach((p) => {
      getOccurrencesInRange(p, t, rangeEnd).forEach((o) => { if (o.status === "scheduled") list.push({ ...o, patientId: p.id, patientName: p.name }); });
    });
    return list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 8);
  }, [patients]);

  function exportAll() {
    if (upcoming.length === 0) return;
    upcoming.forEach((s) => generateICS(s.patientName, s.date, s.time, s.virtual ? "" : s.session.notes, s.duration));
  }

  return (
    <div className="scrollbar" style={{ height: "100%", overflowY: "auto", padding: "20px 28px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setCalMonth((c) => { const nm = c.m - 1; return nm < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: nm }; })} style={navBtn()}><ChevronRight size={16} /></button>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, minWidth: 150, textAlign: "center" }}>{HEB_MONTHS[m]} {y}</h2>
          <button onClick={() => setCalMonth((c) => { const nm = c.m + 1; return nm > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: nm }; })} style={navBtn()}><ChevronLeft size={16} /></button>
        </div>
        <button onClick={exportAll} style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}` }}>
          <Download size={15} /> ייצוא הפגישות הקרובות ליומן
        </button>
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 10, fontSize: 12, color: COLORS.muted, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.clay, display: "inline-block" }} /> מתוכננת</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.success, display: "inline-block" }} /> התקיימה</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.danger, display: "inline-block" }} /> בוטלה</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 24 }}>
        {HEB_DAYS.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: COLORS.muted, padding: "6px 0" }}>{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dateStr = `${y}-${pad(m + 1)}-${pad(d)}`;
          const isToday = dateStr === t;
          const items = byDate[dateStr] || [];
          return (
            <div key={i} style={{
              minHeight: 76, borderRadius: 8, border: `1px solid ${isToday ? COLORS.clay : COLORS.border}`,
              background: isToday ? "#FDF4EC" : COLORS.surface, padding: 5,
            }}>
              <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? COLORS.clay : COLORS.text }}>{d}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 3 }}>
                {items.map((s) => {
                  const cancelled = s.status === "cancelled";
                  const completed = s.status === "completed";
                  return (
                    <div key={s.virtual ? "v-" + s.patientId : s.session.id} onClick={() => onPickPatient(s.patientId)} title={s.patientName} style={{
                      fontSize: 10.5,
                      background: cancelled ? COLORS.danger + "18" : completed ? COLORS.success + "1E" : COLORS.sage + "26",
                      color: cancelled ? COLORS.danger : completed ? COLORS.success : COLORS.primary,
                      borderRadius: 4, padding: "1px 4px", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      textDecoration: cancelled ? "line-through" : "none",
                    }}>{completed ? "✓ " : ""}{s.time} {s.patientName}</div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <h3 style={{ fontSize: 15, color: COLORS.primary, marginBottom: 10 }}>הפגישות הקרובות</h3>
      {upcoming.length === 0 ? (
        <div style={{ color: COLORS.muted, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <AlertCircle size={15} /> אין פגישות מתוכננות בקרוב.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {upcoming.map((s) => (
            <div key={s.virtual ? "v-" + s.patientId + s.date : s.session.id} onClick={() => onPickPatient(s.patientId)} style={{
              display: "flex", alignItems: "center", gap: 12, background: COLORS.surface, border: `1px solid ${COLORS.border}`,
              borderRadius: 10, padding: "10px 14px", cursor: "pointer",
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.clay, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.patientName}{s.virtual && <span style={{ fontWeight: 400, color: COLORS.muted, fontSize: 12 }}> · מתגלגלת</span>}</div>
                <div style={{ fontSize: 12.5, color: COLORS.muted }}>{formatHeDate(s.date)} · {s.time}</div>
              </div>
              <ChevronLeft size={16} color={COLORS.muted} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function navBtn() {
  return { width: 30, height: 30, borderRadius: 7, border: `1px solid ${COLORS.border}`, background: COLORS.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.primary };
}

function MonthlySummary({ patients, sumMonth, setSumMonth, onPickPatient }) {
  const { y, m } = sumMonth;
  const [copied, setCopied] = useState(false);
  const sessions = useMemo(() => monthlySessions(patients, y, m), [patients, y, m]);
  const grouped = useMemo(() => {
    const g = {};
    sessions.forEach((s) => { g[s.patientId] = g[s.patientId] || { name: s.patientName, items: [] }; g[s.patientId].items.push(s); });
    return Object.entries(g);
  }, [sessions]);
  const grandTotal = sessions.reduce((a, s) => a + (Number(s.price) || 0), 0);

  async function copyToClipboard() {
    const text = buildSummaryText(y, m, sessions);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — no-op, text remains visible below for manual copy
    }
  }

  return (
    <div className="scrollbar" style={{ height: "100%", overflowY: "auto", padding: "20px 28px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setSumMonth((c) => { const nm = c.m - 1; return nm < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: nm }; })} style={navBtn()}><ChevronRight size={16} /></button>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, minWidth: 170, textAlign: "center" }}>סיכום חודשי — {HEB_MONTHS[m]} {y}</h2>
          <button onClick={() => setSumMonth((c) => { const nm = c.m + 1; return nm > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: nm }; })} style={navBtn()}><ChevronLeft size={16} /></button>
        </div>
        <button onClick={copyToClipboard} disabled={sessions.length === 0}
          style={{ ...btnPrimary(), width: "auto", background: copied ? COLORS.primaryLight : COLORS.primary, opacity: sessions.length === 0 ? 0.5 : 1, cursor: sessions.length === 0 ? "not-allowed" : "pointer" }}>
          <Copy size={15} /> {copied ? "הועתק!" : "העתקה לטאב"}
        </button>
      </div>
      <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 0, marginBottom: 20 }}>
        סיכום כל הפגישות שסומנו כ"התקיימה" בחודש זה, לפי מטופל/ת, כולל עלות — מוכן להעתקה ולרישום בפאנל הניהול של טאב.
      </p>

      {grouped.length === 0 ? (
        <div style={{ color: COLORS.muted, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <AlertCircle size={15} /> אין פגישות שהושלמו בחודש זה.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            {grouped.map(([pid, g]) => {
              const subtotal = g.items.reduce((a, s) => a + (Number(s.price) || 0), 0);
              return (
                <div key={pid} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span onClick={() => onPickPatient(pid)} style={{ fontWeight: 700, fontSize: 15, cursor: "pointer", color: COLORS.primary }}>{g.name}</span>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>₪{subtotal}</span>
                  </div>
                  {g.items.map((s) => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: s.status === "cancelled" ? COLORS.danger : COLORS.muted, padding: "3px 0" }}>
                      <span>{formatHeDate(s.date)}{s.status === "cancelled" ? <span style={{ fontSize: 11 }}> (ביטול בחיוב{s.cancelReason ? ` — ${s.cancelReason}` : ""})</span> : (s.type && <span style={{ fontSize: 11, color: COLORS.muted }}> ({s.type})</span>)}</span>
                      <span>₪{Number(s.price) || 0}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.primary, color: "#fff", borderRadius: 10, padding: "14px 18px", fontSize: 16, fontWeight: 700 }}>
            <span>סה"כ כללי לחודש</span>
            <span>₪{grandTotal}</span>
          </div>
        </>
      )}
    </div>
  );
}

function StatisticsView({ patients }) {
  const [mode, setMode] = useState("month");
  const [anchor, setAnchor] = useState(todayStr());
  const range = useMemo(() => getPeriodRange(mode, anchor), [mode, anchor]);

  const trend = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear(), m = d.getMonth();
      const revenue = monthlySessions(patients, y, m).reduce((a, s) => a + (Number(s.price) || 0), 0);
      months.push({ y, m, revenue });
    }
    return months;
  }, [patients]);
  const maxTrend = Math.max(1, ...trend.map((t) => t.revenue));

  const occurrences = useMemo(() => {
    const list = [];
    (patients || []).forEach((p) => {
      getOccurrencesInRange(p, range.start, range.end).forEach((o) => list.push({ ...o, patientId: p.id, patientName: p.name }));
    });
    return list;
  }, [patients, range.start, range.end]);

  const completed = occurrences.filter((o) => o.status === "completed");
  const cancelled = occurrences.filter((o) => o.status === "cancelled");
  const cancelledCharged = cancelled.filter((o) => !o.virtual && o.session.charged);
  const scheduled = occurrences.filter((o) => o.status === "scheduled");

  const revenue = completed.reduce((a, o) => a + (Number(o.session?.price) || 0), 0)
    + cancelledCharged.reduce((a, o) => a + (Number(o.session?.price) || 0), 0);

  const activePatientIds = new Set(occurrences.map((o) => o.patientId));
  const totalPatients = (patients || []).length;
  const newPatients = (patients || []).filter((p) => p.createdAt && p.createdAt.slice(0, 10) >= range.start && p.createdAt.slice(0, 10) <= range.end).length;

  const finishedTotal = completed.length + cancelled.length;
  const cancellationRate = finishedTotal ? Math.round((cancelled.length / finishedTotal) * 100) : 0;

  const prevRange = useMemo(() => getPeriodRange(mode, shiftAnchor(mode, anchor, -1)), [mode, anchor]);
  const prevOccurrences = useMemo(() => {
    const list = [];
    (patients || []).forEach((p) => {
      getOccurrencesInRange(p, prevRange.start, prevRange.end).forEach((o) => list.push(o));
    });
    return list;
  }, [patients, prevRange.start, prevRange.end]);
  const prevCompleted = prevOccurrences.filter((o) => o.status === "completed");
  const prevCancelledCharged = prevOccurrences.filter((o) => o.status === "cancelled" && !o.virtual && o.session.charged);
  const prevRevenue = prevCompleted.reduce((a, o) => a + (Number(o.session?.price) || 0), 0)
    + prevCancelledCharged.reduce((a, o) => a + (Number(o.session?.price) || 0), 0);
  const revenueDeltaPct = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : (revenue > 0 ? 100 : 0);
  const sessionsDelta = occurrences.length - prevOccurrences.length;

  const avgDaysBetweenSessions = useMemo(() => {
    const allCompletedDates = [];
    (patients || []).forEach((p) => {
      (p.sessions || []).filter((s) => s.status === "completed").forEach((s) => allCompletedDates.push(s.date));
    });
    const uniqueSorted = Array.from(new Set(allCompletedDates)).sort();
    if (uniqueSorted.length < 2) return null;
    const first = new Date(uniqueSorted[0]);
    const last = new Date(uniqueSorted[uniqueSorted.length - 1]);
    const totalDays = Math.round((last - first) / 86400000);
    return Math.round(totalDays / (uniqueSorted.length - 1));
  }, [patients]);

  const typeCounts = {};
  occurrences.forEach((o) => {
    const t = (o.virtual ? o.type : o.session.type) || "ללא סוג";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });
  const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const maxTypeCount = Math.max(1, ...typeEntries.map(([, c]) => c));

  return (
    <div className="scrollbar" style={{ height: "100%", overflowY: "auto", padding: "20px 28px 80px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[["day", "יום"], ["week", "שבוע"], ["month", "חודש"], ["year", "שנה"]].map(([m, l]) => (
          <TabButton key={m} label={l} active={mode === m} onClick={() => setMode(m)} />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={() => setAnchor(shiftAnchor(mode, anchor, -1))} style={navBtn()}><ChevronRight size={16} /></button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, minWidth: 190, textAlign: "center" }}>{range.label}</h2>
        <button onClick={() => setAnchor(shiftAnchor(mode, anchor, 1))} style={navBtn()}><ChevronLeft size={16} /></button>
        <button onClick={() => setAnchor(todayStr())} style={{ ...btnPrimary(), width: "auto", background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}` }}>היום</button>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <SummaryStat label="סה״כ פגישות בטווח" value={occurrences.length} />
        <SummaryStat label="התקיימו" value={completed.length} />
        <SummaryStat label="בוטלו" value={cancelled.length} />
        <SummaryStat label="מתוכננות" value={scheduled.length} />
        <SummaryStat label="הכנסה בטווח" value={`₪${revenue}`} highlight />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 26 }}>
        <SummaryStat label="מטופלים פעילים / סה״כ" value={`${activePatientIds.size} / ${totalPatients}`} />
        <SummaryStat label="מטופלים חדשים בטווח" value={newPatients} />
        <SummaryStat label="שיעור ביטולים" value={`${cancellationRate}%`} />
      </div>

      <h3 style={{ fontSize: 16, color: COLORS.primary, marginBottom: 10, borderBottom: `2px solid ${COLORS.border}`, paddingBottom: 6 }}>השוואה לתקופה הקודמת</h3>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 26 }}>
        <SummaryStat label="הכנסה — שינוי מהתקופה הקודמת" value={`${revenueDeltaPct > 0 ? "+" : ""}${revenueDeltaPct}%`} />
        <SummaryStat label="פגישות — שינוי מהתקופה הקודמת" value={`${sessionsDelta > 0 ? "+" : ""}${sessionsDelta}`} />
        <SummaryStat label="ממוצע ימים בין פגישות (התקיימו, כלל המטופלים)" value={avgDaysBetweenSessions === null ? "אין מספיק נתונים" : `${avgDaysBetweenSessions} ימים`} />
      </div>

      <h3 style={{ fontSize: 16, color: COLORS.primary, marginBottom: 10, borderBottom: `2px solid ${COLORS.border}`, paddingBottom: 6 }}>פילוח לפי סוג פגישה</h3>
      {typeEntries.length === 0 ? (
        <p style={{ color: COLORS.muted, fontSize: 14 }}>אין נתונים בטווח שנבחר.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {typeEntries.map(([t, count]) => (
            <div key={t}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                <span>{t}</span><span style={{ fontWeight: 700 }}>{count}</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: COLORS.border, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(count / maxTypeCount) * 100}%`, background: COLORS.primary, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ fontSize: 16, color: COLORS.primary, marginBottom: 10, marginTop: 26, borderBottom: `2px solid ${COLORS.border}`, paddingBottom: 6 }}>מגמת הכנסה — 6 החודשים האחרונים</h3>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 140, padding: "6px 2px 0" }}>
        {trend.map((t) => (
          <div key={`${t.y}-${t.m}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.primary }}>₪{t.revenue}</div>
            <div style={{ width: "100%", maxWidth: 46, height: `${Math.max(4, (t.revenue / maxTrend) * 100)}%`, background: COLORS.clay, borderRadius: "4px 4px 0 0" }} />
            <div style={{ fontSize: 11, color: COLORS.muted }}>{HEB_MONTHS[t.m].slice(0, 3)}׳{String(t.y).slice(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
