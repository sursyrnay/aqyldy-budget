import React, { useState, useMemo, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import {
  Wallet, TrendingUp, TrendingDown, Target, AlertTriangle, Plus, Trash2,
  Sparkles, CalendarDays, BarChart3, X, Home, PieChart as PieIcon, Settings,
  ChevronDown, ChevronRight, Clock, ArrowUp, ArrowDown,
} from "lucide-react";

/* ---------- categories & helpers ---------- */
const CATEGORIES = [
  { id: "loan", label: "Несие", color: "#9C4A44", limit: 0.20 },
  { id: "food", label: "Азық-түлік", color: "#C46B3E", limit: 0.25 },
  { id: "utility", label: "Коммуналдық шығын", color: "#3B6E71", limit: 0.15 },
  { id: "toi", label: "Той думан", color: "#B8863B", limit: 0.08 },
  { id: "gift", label: "Сыйлықтар", color: "#A16BA1", limit: 0.05 },
  { id: "transport", label: "Көлік жол жүріс", color: "#5B7A9D", limit: 0.10 },
  { id: "payment", label: "Платеждар", color: "#6B6350", limit: 0.08 },
  { id: "daily", label: "Күнделікті шығындар", color: "#7A8B5A", limit: 0.10 },
  { id: "fun", label: "Ойын сауық", color: "#4E8C8A", limit: 0.08 },
  { id: "shopping", label: "Сатып алу", color: "#8A8378", limit: 0.10 },
];
const catMap = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
const MONTHS = ["Қаңтар","Ақпан","Наурыз","Сәуір","Мамыр","Маусым","Шілде","Тамыз","Қыркүйек","Қазан","Қараша","Желтоқсан"];
const MONTHS_SHORT = ["қаң","ақп","нау","сәу","мам","мау","шіл","там","қыр","қаз","қар","жел"];
const YEARS = Array.from({ length: 2040 - 2024 + 1 }, (_, i) => 2024 + i);

function formatTg(n) { return Math.round(n || 0).toLocaleString("ru-RU") + " ₸"; }
function pad2(n) { return String(n).padStart(2, "0"); }
function monthKey(y, m) { return `${y}-${pad2(m)}`; }
function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
function todayParts() { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() }; }
const now = todayParts();
const defaultYear = YEARS.includes(now.y) ? now.y : 2025;

/* ---------- week helpers: month split into 4 fixed weeks ---------- */
function weekRanges(y, m) {
  const dim = daysInMonth(y, m);
  return [[1, 7], [8, 14], [15, 21], [22, dim]];
}
function currentWeekOf(y, m, d) {
  const ranges = weekRanges(y, m);
  let idx = ranges.findIndex(([s, e]) => d >= s && d <= e);
  if (idx < 0) idx = 3;
  return { year: y, month: m, idx };
}
function prevWeek(w) {
  if (w.idx > 0) return { year: w.year, month: w.month, idx: w.idx - 1 };
  let py = w.year, pm = w.month - 1;
  if (pm < 1) { pm = 12; py -= 1; }
  return { year: py, month: pm, idx: 3 };
}
function prevMonthOf(y, m) {
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
}

/* ---------- storage read helpers (pure, synchronous, derived from saved entries) ---------- */
function loadEntries(y, m) {
  try {
    const raw = localStorage.getItem(`entries:${monthKey(y, m)}`);
    if (!raw) return { incomes: [], expenses: [] };
    const v = JSON.parse(raw);
    return { incomes: v.incomes || [], expenses: v.expenses || [] };
  } catch (e) { return { incomes: [], expenses: [] }; }
}
function catBreakdown(expenses) {
  return CATEGORIES.map((c) => ({
    ...c, value: expenses.filter((e) => e.cat === c.id).reduce((s, e) => s + Number(e.amount || 0), 0),
  })).filter((c) => c.value > 0);
}
function getWeekData(w) {
  const { incomes, expenses } = loadEntries(w.year, w.month);
  const [start, end] = weekRanges(w.year, w.month)[w.idx];
  const exp = expenses.filter((e) => e.day >= start && e.day <= end);
  const inc = incomes.filter((i) => i.day >= start && i.day <= end);
  return {
    totalIncome: inc.reduce((s, i) => s + Number(i.amount || 0), 0),
    totalExpense: exp.reduce((s, e) => s + Number(e.amount || 0), 0),
    byCat: catBreakdown(exp),
    range: [start, end],
  };
}
function getMonthData(y, m) {
  const { incomes, expenses } = loadEntries(y, m);
  return {
    totalIncome: incomes.reduce((s, i) => s + Number(i.amount || 0), 0),
    totalExpense: expenses.reduce((s, e) => s + Number(e.amount || 0), 0),
    byCat: catBreakdown(expenses),
  };
}
function isWeekComplete(w, curY, curM, curD) {
  const [, end] = weekRanges(w.year, w.month)[w.idx];
  if (w.year !== curY) return w.year < curY;
  if (w.month !== curM) return w.month < curM;
  return curD > end;
}
function listCompletedWeeks(curY, curM, curD) {
  const cur = currentWeekOf(curY, curM, curD);
  const out = [];
  let w = prevWeek(cur);
  let steps = 0;
  while (steps < 40 && out.length < 14) {
    const data = getWeekData(w);
    if (data.totalIncome > 0 || data.totalExpense > 0) out.push({ week: w, data });
    w = prevWeek(w);
    steps++;
  }
  return out;
}
function listCompletedMonths(curY, curM) {
  const out = [];
  let { year: y, month: m } = prevMonthOf(curY, curM);
  let steps = 0;
  while (steps < 30 && out.length < 14) {
    const data = getMonthData(y, m);
    if (data.totalIncome > 0 || data.totalExpense > 0) out.push({ year: y, month: m, ...data });
    const p = prevMonthOf(y, m);
    y = p.year; m = p.month;
    steps++;
  }
  return out;
}

/* ================================================================== */
export default function App() {
  const [tab, setTab] = useState("home");
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(now.m);
  const [day, setDay] = useState(now.day);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const skipSave = useRef(false);

  const [goalName, setGoalName] = useState("Ноутбукке жинақ");
  const [goalTarget, setGoalTarget] = useState(400000);
  const [goalSaved, setGoalSaved] = useState(60000);

  const [newIncome, setNewIncome] = useState({ label: "", amount: "" });
  const [newExpense, setNewExpense] = useState({ label: "", amount: "", cat: "food" });
  const [entryMode, setEntryMode] = useState("expense");
  const [storageError, setStorageError] = useState(false);

  const dim = daysInMonth(year, month);

  useEffect(() => {
    setLoading(true); setLoaded(false); skipSave.current = true;
    const key = `entries:${monthKey(year, month)}`;
    try {
      const raw = localStorage.getItem(key);
      const val = raw ? JSON.parse(raw) : { incomes: [], expenses: [], goal: null };
      setIncomes(val.incomes || []); setExpenses(val.expenses || []);
      if (val.goal) {
        setGoalName(val.goal.name ?? "Ноутбукке жинақ");
        setGoalTarget(val.goal.target ?? 400000);
        setGoalSaved(val.goal.saved ?? 0);
      }
    } catch (e) { setIncomes([]); setExpenses([]); }
    finally { setLoading(false); setLoaded(true); setTimeout(() => { skipSave.current = false; }, 0); }
    setDay((d) => Math.min(d, daysInMonth(year, month)));
    // eslint-disable-next-line
  }, [year, month]);

  useEffect(() => {
    if (!loaded || skipSave.current) return;
    const key = `entries:${monthKey(year, month)}`;
    try {
      localStorage.setItem(key, JSON.stringify({ incomes, expenses, goal: { name: goalName, target: goalTarget, saved: goalSaved } }));
      setStorageError(false);
    } catch (e) { setStorageError(true); }
    // eslint-disable-next-line
  }, [incomes, expenses, goalName, goalTarget, goalSaved, loaded]);

  const totalIncome = useMemo(() => incomes.reduce((s, i) => s + Number(i.amount || 0), 0), [incomes]);
  const totalExpense = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount || 0), 0), [expenses]);
  const balance = totalIncome - totalExpense;
  const byCategory = useMemo(() => catBreakdown(expenses), [expenses]);

  const alertsList = useMemo(() => {
    if (totalIncome <= 0) return [];
    return CATEGORIES.map((c) => {
      const spent = expenses.filter((e) => e.cat === c.id).reduce((s, e) => s + Number(e.amount || 0), 0);
      return { ...c, spent, share: spent / totalIncome };
    }).filter((c) => c.share > c.limit && c.spent > 0);
  }, [expenses, totalIncome]);

  const goalPct = Math.min(100, Math.round((goalSaved / (goalTarget || 1)) * 100));

  function addIncome() {
    if (!newIncome.label || !newIncome.amount) return;
    setIncomes((p) => [...p, { id: Date.now(), label: newIncome.label, amount: Number(newIncome.amount), day }]);
    setNewIncome({ label: "", amount: "" }); setTab("home");
  }
  function addExpense() {
    if (!newExpense.label || !newExpense.amount) return;
    setExpenses((p) => [...p, { id: Date.now(), label: newExpense.label, amount: Number(newExpense.amount), cat: newExpense.cat, day }]);
    setNewExpense({ label: "", amount: "", cat: newExpense.cat }); setTab("home");
  }
  function removeIncome(id) { setIncomes((p) => p.filter((i) => i.id !== id)); }
  function removeExpense(id) { setExpenses((p) => p.filter((e) => e.id !== id)); }

  const smartTip = useMemo(() => {
    if (totalIncome === 0 && totalExpense === 0) return "Кіріс пен шығысты толтырып, талдауды бастаңыз.";
    if (alertsList.length === 0 && balance > 0) return `Жақсы! Бюджетіңіз теңгерімде. «${goalName}» мақсатына жинауды жалғастырыңыз.`;
    if (alertsList.length > 0) {
      const worst = [...alertsList].sort((a, b) => b.share - a.share)[0];
      return `«${worst.label}» санатына табыстың ${Math.round(worst.share * 100)}%-ы жұмсалды (шек — ${Math.round(worst.limit * 100)}%).`;
    }
    if (balance < 0) return `Назар аударыңыз: шығыс кірістен ${formatTg(-balance)} артық.`;
    return "Кіріс пен шығысты толтырыңыз.";
  }, [alertsList, balance, goalName, totalIncome, totalExpense]);

  return (
    <div style={s.appShell}>
      <div style={s.phone}>
        <div style={s.topBar}>
          <div style={s.topBarTitleRow}>
            <div style={s.logoDot}><Wallet size={17} color="white" /></div>
            <div style={{ fontWeight: 800, fontSize: 16.5 }}>Ақылды бюджет</div>
          </div>
          <button style={s.dateChip} onClick={() => setDatePickerOpen(true)}>
            <CalendarDays size={13} />{day}-{MONTHS[month - 1].slice(0, 3)}-{year}<ChevronDown size={13} />
          </button>
        </div>

        <div style={s.content}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#9C947F", fontSize: 13 }}>Жүктелуде…</div>
          ) : tab === "home" ? (
            <HomeScreen totalIncome={totalIncome} totalExpense={totalExpense} balance={balance}
              byCategory={byCategory} alertsList={alertsList} smartTip={smartTip}
              goalName={goalName} goalTarget={goalTarget} goalSaved={goalSaved} goalPct={goalPct}
              incomes={incomes} expenses={expenses} removeIncome={removeIncome} removeExpense={removeExpense} />
          ) : tab === "add" ? (
            <AddScreen entryMode={entryMode} setEntryMode={setEntryMode}
              newIncome={newIncome} setNewIncome={setNewIncome} addIncome={addIncome}
              newExpense={newExpense} setNewExpense={setNewExpense} addExpense={addExpense}
              day={day} monthLabel={MONTHS[month - 1]} />
          ) : tab === "analysis" ? (
            <AnalysisScreen year={year} month={month} day={day} />
          ) : (
            <SettingsScreen goalName={goalName} setGoalName={setGoalName} goalTarget={goalTarget} setGoalTarget={setGoalTarget} goalSaved={goalSaved} setGoalSaved={setGoalSaved} />
          )}
        </div>

        <div style={s.bottomBar}>
          <TabBtn active={tab === "home"} onClick={() => setTab("home")} icon={<Home size={20} />} label="Басты" />
          <TabBtn active={tab === "add"} onClick={() => setTab("add")} icon={<Plus size={22} />} label="Жазба" accent />
          <TabBtn active={tab === "analysis"} onClick={() => setTab("analysis")} icon={<PieIcon size={20} />} label="Талдау" />
          <TabBtn active={tab === "settings"} onClick={() => setTab("settings")} icon={<Settings size={20} />} label="Баптар" />
        </div>

        {datePickerOpen && (
          <DateSheet year={year} month={month} day={day} dim={dim} setYear={setYear} setMonth={setMonth} setDay={setDay} onClose={() => setDatePickerOpen(false)} />
        )}
      </div>
    </div>
  );
}

/* ================= HOME ================= */
function HomeScreen({ totalIncome, totalExpense, balance, byCategory, alertsList, smartTip,
  goalName, goalTarget, goalSaved, goalPct, incomes, expenses, removeIncome, removeExpense }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatCard icon={<TrendingUp size={16} color="#3B6E71" />} label="Кіріс" value={formatTg(totalIncome)} bg="#EAF1EE" />
        <StatCard icon={<TrendingDown size={16} color="#9C4A44" />} label="Шығыс" value={formatTg(totalExpense)} bg="#F5E9E6" />
      </div>
      <StatCard icon={<Wallet size={16} color={balance >= 0 ? "#3B6E71" : "#9C4A44"} />} label="Қалдық" value={formatTg(balance)} bg={balance >= 0 ? "#EAF1EE" : "#F5E9E6"} wide />
      <div style={s.tipBox}><Sparkles size={16} color="#B8863B" style={{ marginTop: 1, flexShrink: 0 }} /><div style={{ fontSize: 12.6, lineHeight: 1.45 }}>{smartTip}</div></div>
      {alertsList.slice(0, 2).map((a) => (
        <div key={a.id} style={s.alertBox}><AlertTriangle size={15} color="#9C4A44" style={{ flexShrink: 0 }} /><span style={{ fontSize: 12 }}><b>{a.label}</b>: {Math.round(a.share * 100)}% (шек {Math.round(a.limit * 100)}%)</span></div>
      ))}
      <div style={s.card}>
        <div style={s.cardTitle}>Шығын құрылымы</div>
        {byCategory.length === 0 ? <div style={{ color: "#9C947F", fontSize: 12.5, padding: "24px 0", textAlign: "center" }}>Шығын енгізіңіз</div> : (
          <ResponsiveContainer width="100%" height={190}>
            <PieChart><Pie data={byCategory} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
              {byCategory.map((c, i) => <Cell key={i} fill={c.color} />)}
            </Pie><Tooltip formatter={(v) => formatTg(v)} /></PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, ...s.cardTitle }}><Target size={15} color="#C46B3E" /> {goalName}</div>
        <div style={s.progressTrack}><div style={{ ...s.progressFill, width: `${goalPct}%` }} /></div>
        <div style={{ fontSize: 11.5, color: "#9C947F", marginTop: 6 }}>{goalPct}% · қалды {formatTg(Math.max(0, goalTarget - goalSaved))}</div>
      </div>
      <div style={s.card}>
        <div style={s.cardTitle}>Соңғы жазбалар</div>
        {[...expenses.map(e => ({ ...e, type: "expense" })), ...incomes.map(i => ({ ...i, type: "income" }))]
          .sort((a, b) => b.id - a.id).slice(0, 6).map((it) => (
            <div key={it.id} style={s.entryRow}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</div>
                <div style={{ fontSize: 10.5, color: "#9C947F" }}>{it.type === "expense" ? catMap[it.cat]?.label : "Кіріс"} · {it.day}-күн</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 12.5, color: it.type === "expense" ? "#9C4A44" : "#3B6E71" }}>{it.type === "expense" ? "-" : "+"}{formatTg(it.amount)}</span>
                <Trash2 size={13} color="#C9C2B0" onClick={() => it.type === "expense" ? removeExpense(it.id) : removeIncome(it.id)} />
              </div>
            </div>
          ))}
        {incomes.length === 0 && expenses.length === 0 && <div style={{ color: "#9C947F", fontSize: 12.5, textAlign: "center", padding: "12px 0" }}>Жазба жоқ</div>}
      </div>
    </div>
  );
}

/* ================= ADD ================= */
function AddScreen({ entryMode, setEntryMode, newIncome, setNewIncome, addIncome, newExpense, setNewExpense, addExpense, day, monthLabel }) {
  return (
    <div>
      <div style={s.segmentWrap}>
        <button onClick={() => setEntryMode("expense")} style={{ ...s.segmentBtn, ...(entryMode === "expense" ? s.segmentActiveExpense : {}) }}>Шығыс</button>
        <button onClick={() => setEntryMode("income")} style={{ ...s.segmentBtn, ...(entryMode === "income" ? s.segmentActiveIncome : {}) }}>Кіріс</button>
      </div>
      <div style={{ fontSize: 12, color: "#9C947F", margin: "10px 2px 14px" }}>{day}-күн, {monthLabel} айына жазба қосу</div>
      {entryMode === "expense" ? (
        <div style={s.card}>
          <FieldLabel>Атауы</FieldLabel>
          <input style={s.input} placeholder="мыс. Апталық азық-түлік" value={newExpense.label} onChange={(e) => setNewExpense({ ...newExpense, label: e.target.value })} />
          <FieldLabel>Сомасы, ₸</FieldLabel>
          <input style={s.input} type="number" inputMode="numeric" placeholder="0" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} />
          <FieldLabel>Санат</FieldLabel>
          <div style={s.catGrid}>
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setNewExpense({ ...newExpense, cat: c.id })}
                style={{ ...s.catChip, borderColor: newExpense.cat === c.id ? c.color : "#E4DCCB", background: newExpense.cat === c.id ? `${c.color}18` : "white", color: newExpense.cat === c.id ? c.color : "#2B2620" }}>
                {c.label}
              </button>
            ))}
          </div>
          <button onClick={addExpense} style={{ ...s.primaryBtn, background: "#9C4A44" }}>Шығысты қосу</button>
        </div>
      ) : (
        <div style={s.card}>
          <FieldLabel>Атауы</FieldLabel>
          <input style={s.input} placeholder="мыс. Айлық жалақы" value={newIncome.label} onChange={(e) => setNewIncome({ ...newIncome, label: e.target.value })} />
          <FieldLabel>Сомасы, ₸</FieldLabel>
          <input style={s.input} type="number" inputMode="numeric" placeholder="0" value={newIncome.amount} onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })} />
          <button onClick={addIncome} style={{ ...s.primaryBtn, background: "#3B6E71" }}>Кірісті қосу</button>
        </div>
      )}
    </div>
  );
}

/* ================= ANALYSIS (weekly + monthly, rolling, auto) ================= */
function AnalysisScreen({ year, month, day }) {
  const [openWeek, setOpenWeek] = useState(null);   // {week,data} | null
  const [openMonth, setOpenMonth] = useState(null); // {year,month,...} | null

  const cur = currentWeekOf(year, month, day);
  const curWeekRange = weekRanges(year, month)[cur.idx];
  const weeks = useMemo(() => listCompletedWeeks(year, month, day), [year, month, day]);
  const months = useMemo(() => listCompletedMonths(year, month), [year, month]);

  // attach "previous period" comparison to each listed item
  const weeksWithCompare = weeks.map((item, i) => {
    const prev = i + 1 < weeks.length ? weeks[i + 1].data : getWeekData(prevWeek(item.week));
    return { ...item, prev };
  });
  const monthsWithCompare = months.map((item, i) => {
    const prevKey = prevMonthOf(item.year, item.month);
    const prev = getMonthData(prevKey.year, prevKey.month);
    return { ...item, prev };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={s.sectionTitle}><Clock size={16} color="#C46B3E" /> Апталық талдау</div>
        <div style={s.pendingNote}>
          Ағымдағы апта ({curWeekRange[0]}–{curWeekRange[1]}-күндер) әлі аяқталған жоқ. Апта аяқталғанда талдау автоматты түрде осы жерде пайда болады.
        </div>
        {weeksWithCompare.length === 0 ? (
          <div style={s.emptyNote}>Әзірге аяқталған апта деректері жоқ.</div>
        ) : weeksWithCompare.map((item, i) => (
          <PeriodRow key={i}
            title={`${item.week.idx + 1}-апта, ${item.data.range[0]}–${item.data.range[1]} ${MONTHS_SHORT[item.week.month - 1]}`}
            expense={item.data.totalExpense} prevExpense={item.prev.totalExpense}
            onClick={() => setOpenWeek(item)} />
        ))}
      </div>

      <div>
        <div style={s.sectionTitle}><BarChart3 size={16} color="#3B6E71" /> Айлық талдау</div>
        <div style={s.pendingNote}>
          {MONTHS[month - 1]} айы әлі аяқталған жоқ. Ай аяқталғанда толық талдау (кіріс-шығыс, нені қысқарту керек, өткен аймен салыстыру) осы жерде автоматты шығады.
        </div>
        {monthsWithCompare.length === 0 ? (
          <div style={s.emptyNote}>Әзірге аяқталған ай деректері жоқ.</div>
        ) : monthsWithCompare.map((item, i) => (
          <PeriodRow key={i}
            title={`${MONTHS[item.month - 1]} ${item.year}`}
            expense={item.totalExpense} prevExpense={item.prev.totalExpense}
            onClick={() => setOpenMonth(item)} />
        ))}
      </div>

      {openWeek && <WeekDetailModal item={openWeek} onClose={() => setOpenWeek(null)} />}
      {openMonth && <MonthDetailModal item={openMonth} onClose={() => setOpenMonth(null)} />}
    </div>
  );
}

function PeriodRow({ title, expense, prevExpense, onClick }) {
  const diff = expense - prevExpense;
  const up = diff > 0;
  const hasPrev = prevExpense > 0;
  return (
    <button onClick={onClick} style={s.periodRow}>
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 11, color: "#9C947F" }}>Шығыс: {formatTg(expense)}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {hasPrev && (
          <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 11, fontWeight: 700, color: up ? "#9C4A44" : "#3B6E71" }}>
            {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{Math.abs(Math.round((diff / prevExpense) * 100))}%
          </span>
        )}
        <ChevronRight size={16} color="#C9C2B0" />
      </div>
    </button>
  );
}

function compareCategories(curCat, prevCat) {
  const prevMap = Object.fromEntries(prevCat.map((c) => [c.id, c.value]));
  return curCat
    .map((c) => ({ ...c, prevValue: prevMap[c.id] || 0, diff: c.value - (prevMap[c.id] || 0) }))
    .filter((c) => c.diff > 0)
    .sort((a, b) => b.diff - a.diff);
}

function WeekDetailModal({ item, onClose }) {
  const { week, data, prev } = item;
  const increased = compareCategories(data.byCat, prev.byCat);
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{week.idx + 1}-апта талдауы</div>
      <div style={{ fontSize: 12, color: "#9C947F", marginBottom: 12 }}>{data.range[0]}–{data.range[1]} {MONTHS[week.month - 1]}, {week.year}</div>
      <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
        <MiniStat label="Кіріс" value={formatTg(data.totalIncome)} color="#3B6E71" />
        <MiniStat label="Шығыс" value={formatTg(data.totalExpense)} color="#9C4A44" />
        <MiniStat label="Қалдық" value={formatTg(data.totalIncome - data.totalExpense)} color={data.totalIncome - data.totalExpense >= 0 ? "#3B6E71" : "#9C4A44"} />
      </div>
      {prev.totalExpense > 0 || prev.totalIncome > 0 ? (
        increased.length > 0 ? (
          <div style={{ background: "#FBEDEC", border: "1px solid #E7C3C0", borderRadius: 12, padding: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>⚠ Алдыңғы аптамен салыстырғанда:</div>
            {increased.map((c) => (
              <div key={c.id} style={{ fontSize: 12.3, marginBottom: 4 }}>
                Сіз бұл апта <b>«{c.label}»</b> санатына алдыңғы аптамен салыстырғанда <b>{formatTg(c.diff)}</b> көп жұмсадыңыз ({formatTg(c.prevValue)} → {formatTg(c.value)}).
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: "#EAF1EE", border: "1px solid #C9DED6", borderRadius: 12, padding: 12, marginBottom: 10, fontSize: 12.5 }}>
            Жақсы! Алдыңғы аптамен салыстырғанда ешбір санатта шығын көбеймеген.
          </div>
        )
      ) : (
        <div style={{ fontSize: 12, color: "#9C947F", marginBottom: 10 }}>Алдыңғы апта деректері жоқ, салыстыру жасалмады.</div>
      )}
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Санаттар бойынша шығыс:</div>
      {data.byCat.length === 0 ? <div style={{ fontSize: 12, color: "#9C947F" }}>Шығын жоқ</div> : data.byCat.map((c) => (
        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.3, borderTop: "1px dashed #EEE6D6", padding: "5px 0" }}>
          <span>{c.label}</span><span style={{ fontWeight: 700 }}>{formatTg(c.value)}</span>
        </div>
      ))}
      <button onClick={onClose} style={{ ...s.primaryBtn, background: "#2B2620", marginTop: 16 }}>Жабу</button>
    </Overlay>
  );
}

function MonthDetailModal({ item, onClose }) {
  const { year, month, totalIncome, totalExpense, byCat, prev } = item;
  const balance = totalIncome - totalExpense;
  const overLimit = totalIncome > 0 ? byCat.map((c) => ({ ...c, share: c.value / totalIncome })).filter((c) => c.share > c.limit) : [];
  const increased = compareCategories(byCat, prev.byCat);
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>{MONTHS[month - 1]} {year} — толық талдау</div>
      <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
        <MiniStat label="Кіріс" value={formatTg(totalIncome)} color="#3B6E71" />
        <MiniStat label="Шығыс" value={formatTg(totalExpense)} color="#9C4A44" />
        <MiniStat label="Қалдық" value={formatTg(balance)} color={balance >= 0 ? "#3B6E71" : "#9C4A44"} />
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Нені қысқарту керек:</div>
      {overLimit.length === 0 ? (
        <div style={{ fontSize: 12.3, color: "#3B6E71", marginBottom: 12 }}>Барлық санаттар лимит шегінде, қысқартудың қажеті жоқ.</div>
      ) : overLimit.map((c) => (
        <div key={c.id} style={{ fontSize: 12.3, marginBottom: 4 }}>
          <b>«{c.label}»</b> — {formatTg(c.value)} ({Math.round(c.share * 100)}%, ұсынылған шек {Math.round(c.limit * 100)}%).
        </div>
      ))}

      <div style={{ fontSize: 12.5, fontWeight: 700, margin: "14px 0 6px" }}>Өткен аймен салыстырғанда:</div>
      {prev.totalIncome === 0 && prev.totalExpense === 0 ? (
        <div style={{ fontSize: 12, color: "#9C947F" }}>Өткен ай деректері жоқ, салыстыру жасалмады.</div>
      ) : increased.length === 0 ? (
        <div style={{ fontSize: 12.3, color: "#3B6E71" }}>Ешбір санатта шығын өткен айға қарағанда көбеймеген.</div>
      ) : increased.map((c) => (
        <div key={c.id} style={{ fontSize: 12.3, marginBottom: 4 }}>
          Сіз бұл ай <b>«{c.label}»</b> санатына өткен айға қарағанда <b>{formatTg(c.diff)}</b> көп жұмсадыңыз ({formatTg(c.prevValue)} → {formatTg(c.value)}).
        </div>
      ))}
      <div style={{ fontSize: 11.5, color: "#9C947F", marginTop: 10 }}>
        Жалпы шығыс: {formatTg(prev.totalExpense)} → {formatTg(totalExpense)} ({totalExpense - prev.totalExpense >= 0 ? "+" : ""}{formatTg(totalExpense - prev.totalExpense)})
      </div>

      <button onClick={onClose} style={{ ...s.primaryBtn, background: "#2B2620", marginTop: 16 }}>Жабу</button>
    </Overlay>
  );
}

/* ================= SETTINGS ================= */
function SettingsScreen({ goalName, setGoalName, goalTarget, setGoalTarget, goalSaved, setGoalSaved }) {
  return (
    <div style={s.card}>
      <div style={s.cardTitle}>Жинақ мақсаты</div>
      <FieldLabel>Мақсат атауы</FieldLabel>
      <input style={s.input} value={goalName} onChange={(e) => setGoalName(e.target.value)} />
      <FieldLabel>Мақсатты сома, ₸</FieldLabel>
      <input style={s.input} type="number" value={goalTarget} onChange={(e) => setGoalTarget(Number(e.target.value))} />
      <FieldLabel>Қазір жиналды, ₸</FieldLabel>
      <input style={s.input} type="number" value={goalSaved} onChange={(e) => setGoalSaved(Number(e.target.value))} />
      <div style={{ fontSize: 11.5, color: "#9C947F", marginTop: 14, lineHeight: 1.5 }}>
        Деректер осы құрылғыда (браузерде) автоматты сақталады. Апта/ай аяқталған сайын талдау автоматты есептеліп, Талдау бөлімінде сақталып тұрады.
      </div>
    </div>
  );
}

/* ================= small components ================= */
function TabBtn({ active, onClick, icon, label, accent }) {
  return (
    <button onClick={onClick} style={{ ...s.tabBtn, color: active ? "#C46B3E" : "#9C947F" }}>
      <div style={accent ? s.tabAccentDot : {}}>{icon}</div>
      <span style={{ fontSize: 10, marginTop: 2, fontWeight: active ? 700 : 500 }}>{label}</span>
    </button>
  );
}
function StatCard({ icon, label, value, bg, wide }) {
  return (
    <div style={{ background: bg, borderRadius: 14, padding: "12px 14px", gridColumn: wide ? "1 / -1" : "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#5c5648", marginBottom: 4 }}>{icon}{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
function Panel({ title, children }) { return <div style={s.card}><div style={s.cardTitle}>{title}</div>{children}</div>; }
function FieldLabel({ children }) { return <div style={{ fontSize: 11, color: "#9C947F", margin: "10px 0 4px" }}>{children}</div>; }
function MiniStat({ label, value, color }) {
  return <div><div style={{ fontSize: 10.5, color: "#9C947F" }}>{label}</div><div style={{ fontSize: 14, fontWeight: 800, color }}>{value}</div></div>;
}
function Overlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={s.sheetOverlay2}>
      <div onClick={(e) => e.stopPropagation()} style={s.modalBox}>
        <X size={18} color="#B0A896" style={{ position: "absolute", top: 16, right: 16, cursor: "pointer" }} onClick={onClose} />
        {children}
      </div>
    </div>
  );
}
function DateSheet({ year, month, day, dim, setYear, setMonth, setDay, onClose }) {
  return (
    <div style={s.sheetOverlay} onClick={onClose}>
      <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={s.sheetHandle} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Күнді таңдау</div>
          <X size={18} color="#9C947F" onClick={onClose} />
        </div>
        <FieldLabel>Жыл</FieldLabel>
        <div style={s.scrollRow}>{YEARS.map((y) => <Pill key={y} active={y === year} onClick={() => setYear(y)}>{y}</Pill>)}</div>
        <FieldLabel>Ай</FieldLabel>
        <div style={s.scrollRow}>{MONTHS.map((m, i) => <Pill key={m} active={i + 1 === month} onClick={() => setMonth(i + 1)}>{m}</Pill>)}</div>
        <FieldLabel>Күн</FieldLabel>
        <div style={s.scrollRow}>{Array.from({ length: dim }, (_, i) => i + 1).map((d) => <Pill key={d} active={d === day} onClick={() => setDay(d)}>{d}</Pill>)}</div>
        <button onClick={onClose} style={{ ...s.primaryBtn, background: "#2B2620", marginTop: 16 }}>Дайын</button>
      </div>
    </div>
  );
}
function Pill({ active, onClick, children }) { return <button onClick={onClick} style={{ ...s.pill, ...(active ? s.pillActive : {}) }}>{children}</button>; }

/* ================= styles ================= */
const s = {
  appShell: { minHeight: "100vh", background: "#EDE7DA", display: "flex", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif" },
  phone: { width: "100%", maxWidth: 430, minHeight: "100vh", background: "#F7F3EC", display: "flex", flexDirection: "column", position: "relative", boxShadow: "0 0 40px rgba(0,0,0,0.08)" },
  topBar: { padding: "18px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#F7F3EC", zIndex: 5, borderBottom: "1px solid #EDE6D8" },
  topBarTitleRow: { display: "flex", alignItems: "center", gap: 8 },
  logoDot: { width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,#C46B3E,#8A4A2E)", display: "flex", alignItems: "center", justifyContent: "center" },
  dateChip: { display: "flex", alignItems: "center", gap: 5, background: "white", border: "1px solid #E4DCCB", borderRadius: 999, padding: "6px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", color: "#2B2620" },
  content: { flex: 1, overflowY: "auto", padding: "14px 16px 90px" },
  bottomBar: { position: "sticky", bottom: 0, background: "white", borderTop: "1px solid #EDE6D8", display: "flex", justifyContent: "space-around", padding: "8px 4px calc(8px + env(safe-area-inset-bottom))", zIndex: 5 },
  tabBtn: { background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", padding: "4px 10px" },
  tabAccentDot: { background: "#C46B3E", color: "white", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", marginTop: -14, boxShadow: "0 4px 10px rgba(196,107,62,0.4)" },
  card: { background: "white", borderRadius: 16, padding: 14, border: "1px solid #EDE6D8" },
  cardTitle: { fontWeight: 700, fontSize: 13, marginBottom: 8 },
  tipBox: { background: "#FFF8EE", border: "1px solid #EBD9B8", borderRadius: 14, padding: "11px 13px", display: "flex", gap: 8, alignItems: "flex-start" },
  alertBox: { background: "#FBEDEC", border: "1px solid #E7C3C0", borderRadius: 12, padding: "8px 12px", display: "flex", gap: 8, alignItems: "center" },
  progressTrack: { background: "#F0EAD9", borderRadius: 999, height: 10, overflow: "hidden" },
  progressFill: { height: "100%", background: "linear-gradient(90deg,#C46B3E,#B8863B)" },
  entryRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderTop: "1px dashed #EEE6D6", gap: 8 },
  segmentWrap: { display: "flex", background: "#EFE8D8", borderRadius: 12, padding: 4 },
  segmentBtn: { flex: 1, border: "none", background: "none", padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, color: "#8A8378", cursor: "pointer" },
  segmentActiveExpense: { background: "white", color: "#9C4A44", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  segmentActiveIncome: { background: "white", color: "#3B6E71", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  input: { width: "100%", border: "1px solid #E4DCCB", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, boxSizing: "border-box", outline: "none" },
  catGrid: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 },
  catChip: { border: "1px solid #E4DCCB", borderRadius: 999, padding: "6px 11px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" },
  primaryBtn: { width: "100%", color: "white", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 13.5, fontWeight: 700, marginTop: 16, cursor: "pointer" },
  sheetOverlay: { position: "fixed", inset: 0, background: "rgba(43,38,32,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 },
  sheetOverlay2: { position: "fixed", inset: 0, background: "rgba(43,38,32,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 },
  modalBox: { background: "white", borderRadius: 18, padding: 22, maxWidth: 430, width: "100%", maxHeight: "82vh", overflowY: "auto", position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" },
  sheet: { background: "white", borderRadius: "20px 20px 0 0", padding: "10px 18px 24px", width: "100%", maxWidth: 430, maxHeight: "75vh", overflowY: "auto" },
  sheetHandle: { width: 36, height: 4, background: "#E4DCCB", borderRadius: 999, margin: "4px auto 12px" },
  scrollRow: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 },
  pill: { flexShrink: 0, border: "1px solid #E4DCCB", background: "white", borderRadius: 999, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "#2B2620" },
  pillActive: { background: "#2B2620", color: "white", borderColor: "#2B2620" },
  sectionTitle: { display: "flex", alignItems: "center", gap: 7, fontWeight: 800, fontSize: 14.5, marginBottom: 8 },
  pendingNote: { background: "#F0EAD9", borderRadius: 12, padding: "9px 12px", fontSize: 11.5, color: "#6B6350", marginBottom: 8, lineHeight: 1.45 },
  emptyNote: { fontSize: 12, color: "#9C947F", padding: "6px 2px" },
  periodRow: { width: "100%", background: "white", border: "1px solid #EDE6D8", borderRadius: 13, padding: "10px 13px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, cursor: "pointer" },
};
