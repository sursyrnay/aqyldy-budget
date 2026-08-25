import React, { useState, useMemo, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Wallet, TrendingUp, TrendingDown, Target, TriangleAlert as AlertTriangle, Plus, Trash2, Sparkles, CalendarDays, BarChart3, X, Home, PieChart as PieIcon, Settings, ChevronDown } from "lucide-react";

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
const YEARS = Array.from({ length: 2040 - 2024 + 1 }, (_, i) => 2024 + i);

function formatTg(n) { return Math.round(n || 0).toLocaleString("ru-RU") + " ₸"; }
function pad2(n) { return String(n).padStart(2, "0"); }
function monthKey(y, m) { return `${y}-${pad2(m)}`; }
function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
function todayParts() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() };
}
const now = todayParts();
const defaultYear = YEARS.includes(now.y) ? now.y : 2025;

/* ================================================================== */

export default function App() {
  const [tab, setTab] = useState("home"); // home | add | analysis | settings
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
  const [entryMode, setEntryMode] = useState("expense"); // expense | income

  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const dim = daysInMonth(year, month);
  const isLastDay = day >= dim;
  const isDecember = month === 12;

  /* ---- load month data ---- */
  useEffect(() => {
    setLoading(true);
    setLoaded(false);
    skipSave.current = true;
    const key = `entries:${monthKey(year, month)}`;
    try {
      const raw = localStorage.getItem(key);
      const val = raw ? JSON.parse(raw) : { incomes: [], expenses: [], goal: null };
      setIncomes(val.incomes || []);
      setExpenses(val.expenses || []);
      if (val.goal) {
        setGoalName(val.goal.name ?? "Ноутбукке жинақ");
        setGoalTarget(val.goal.target ?? 400000);
        setGoalSaved(val.goal.saved ?? 0);
      }
    } catch (e) {
      setIncomes([]); setExpenses([]);
    } finally {
      setLoading(false);
      setLoaded(true);
      setTimeout(() => { skipSave.current = false; }, 0);
    }
    setDay((d) => Math.min(d, daysInMonth(year, month)));
    // eslint-disable-next-line
  }, [year, month]);

  /* ---- autosave ---- */
  useEffect(() => {
    if (!loaded || skipSave.current) return;
    const key = `entries:${monthKey(year, month)}`;
    try {
      localStorage.setItem(key, JSON.stringify({
        incomes, expenses, goal: { name: goalName, target: goalTarget, saved: goalSaved },
      }));
    } catch (e) { /* storage full or unavailable */ }
    // eslint-disable-next-line
  }, [incomes, expenses, goalName, goalTarget, goalSaved, loaded]);

  const totalIncome = useMemo(() => incomes.reduce((s, i) => s + Number(i.amount || 0), 0), [incomes]);
  const totalExpense = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount || 0), 0), [expenses]);
  const balance = totalIncome - totalExpense;

  const byCategory = useMemo(() => CATEGORIES.map((c) => ({
    ...c, value: expenses.filter((e) => e.cat === c.id).reduce((s, e) => s + Number(e.amount || 0), 0),
  })).filter((c) => c.value > 0), [expenses]);

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
    setNewIncome({ label: "", amount: "" });
    setTab("home");
  }
  function addExpense() {
    if (!newExpense.label || !newExpense.amount) return;
    setExpenses((p) => [...p, { id: Date.now(), label: newExpense.label, amount: Number(newExpense.amount), cat: newExpense.cat, day }]);
    setNewExpense({ label: "", amount: "", cat: newExpense.cat });
    setTab("home");
  }
  function removeIncome(id) { setIncomes((p) => p.filter((i) => i.id !== id)); }
  function removeExpense(id) { setExpenses((p) => p.filter((e) => e.id !== id)); }

  const smartTip = useMemo(() => {
    if (totalIncome === 0 && totalExpense === 0) return "Кіріс пен шығысты толтырып, талдауды бастаңыз.";
    if (alertsList.length === 0 && balance > 0) return `Жақсы! Бюджетіңіз теңгерімде. «${goalName}» мақсатына жинауды жалғастырыңыз.`;
    if (alertsList.length > 0) {
      const worst = [...alertsList].sort((a, b) => b.share - a.share)[0];
      return `«${worst.label}» санатына табыстың ${Math.round(worst.share * 100)}%-ы жұмсалды (шек — ${Math.round(worst.limit * 100)}%). Шамамен ${formatTg(worst.spent - worst.limit * totalIncome)} үнемдеуге болады.`;
    }
    if (balance < 0) return `Назар аударыңыз: шығыс кірістен ${formatTg(-balance)} артық.`;
    return "Кіріс пен шығысты толтырыңыз.";
  }, [alertsList, balance, goalName, totalIncome, totalExpense]);

  /* ---- analysis ---- */
  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const catBreakdown = CATEGORIES.map((c) => {
        const spent = expenses.filter((e) => e.cat === c.id).reduce((s, e) => s + Number(e.amount || 0), 0);
        return { id: c.id, label: c.label, spent, share: totalIncome > 0 ? spent / totalIncome : 0, limit: c.limit };
      }).filter((c) => c.spent > 0);

      const monthSummary = {
        year, month, totalIncome, totalExpense, balance, catBreakdown,
        overLimit: catBreakdown.filter((c) => c.share > c.limit),
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(`analysis:${monthKey(year, month)}`, JSON.stringify(monthSummary));

      let yearCompare = null;
      if (isDecember) {
        yearCompare = {
          year, prevYear: year - 1,
          thisYearTotals: sumYear(year),
          prevYearTotals: sumYear(year - 1),
        };
      }
      setAnalysis({ type: yearCompare ? "year" : "month", monthSummary, yearCompare });
      setTab("analysis");
    } catch (e) {
      setAnalysis({ type: "error" });
    } finally {
      setAnalyzing(false);
    }
  }
  function sumYear(y) {
    let income = 0, expense = 0, monthsFound = 0;
    for (let m = 1; m <= 12; m++) {
      const raw = localStorage.getItem(`analysis:${monthKey(y, m)}`);
      if (raw) {
        try { const v = JSON.parse(raw); income += v.totalIncome || 0; expense += v.totalExpense || 0; monthsFound++; } catch (e) {}
      }
    }
    return { income, expense, balance: income - expense, monthsFound };
  }

  return (
    <div style={s.appShell}>
      <div style={s.phone}>

        {/* Top bar */}
        <div style={s.topBar}>
          <div style={s.topBarTitleRow}>
            <div style={s.logoDot}><Wallet size={17} color="white" /></div>
            <div style={{ fontWeight: 800, fontSize: 16.5 }}>Ақылды бюджет</div>
          </div>
          <button style={s.dateChip} onClick={() => setDatePickerOpen(true)}>
            <CalendarDays size={13} />
            {day}-{MONTHS[month - 1].slice(0, 3)}-{year}
            <ChevronDown size={13} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={s.content}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#9C947F", fontSize: 13 }}>Жүктелуде…</div>
          ) : tab === "home" ? (
            <HomeScreen
              month={month} totalIncome={totalIncome} totalExpense={totalExpense} balance={balance}
              byCategory={byCategory} alertsList={alertsList} smartTip={smartTip}
              goalName={goalName} goalTarget={goalTarget} goalSaved={goalSaved} goalPct={goalPct}
              isLastDay={isLastDay} isDecember={isDecember} onAnalyze={runAnalysis} analyzing={analyzing}
              incomes={incomes} expenses={expenses} removeIncome={removeIncome} removeExpense={removeExpense}
            />
          ) : tab === "add" ? (
            <AddScreen
              entryMode={entryMode} setEntryMode={setEntryMode}
              newIncome={newIncome} setNewIncome={setNewIncome} addIncome={addIncome}
              newExpense={newExpense} setNewExpense={setNewExpense} addExpense={addExpense}
              day={day} monthLabel={MONTHS[month - 1]}
            />
          ) : tab === "analysis" ? (
            <AnalysisScreen analysis={analysis} onRun={runAnalysis} analyzing={analyzing} isLastDay={isLastDay} isDecember={isDecember} monthLabel={MONTHS[month - 1]} year={year} />
          ) : (
            <SettingsScreen goalName={goalName} setGoalName={setGoalName} goalTarget={goalTarget} setGoalTarget={setGoalTarget} goalSaved={goalSaved} setGoalSaved={setGoalSaved} />
          )}
        </div>

        {/* Bottom tab bar */}
        <div style={s.bottomBar}>
          <TabBtn active={tab === "home"} onClick={() => setTab("home")} icon={<Home size={20} />} label="Басты" />
          <TabBtn active={tab === "add"} onClick={() => setTab("add")} icon={<Plus size={22} />} label="Жазба" accent />
          <TabBtn active={tab === "analysis"} onClick={() => setTab("analysis")} icon={<PieIcon size={20} />} label="Талдау" />
          <TabBtn active={tab === "settings"} onClick={() => setTab("settings")} icon={<Settings size={20} />} label="Баптар" />
        </div>

        {datePickerOpen && (
          <DateSheet year={year} month={month} day={day} dim={dim}
            setYear={setYear} setMonth={setMonth} setDay={setDay}
            onClose={() => setDatePickerOpen(false)} />
        )}
      </div>
    </div>
  );
}

/* ================= SCREENS ================= */

function HomeScreen({ month, totalIncome, totalExpense, balance, byCategory, alertsList, smartTip,
  goalName, goalTarget, goalSaved, goalPct, isLastDay, isDecember, onAnalyze, analyzing,
  incomes, expenses, removeIncome, removeExpense }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {isLastDay && (
        <div style={s.banner}>
          <BarChart3 size={16} color="#3B6E71" />
          <div style={{ flex: 1, fontSize: 12.3 }}>{MONTHS[month - 1]} айының соңғы күні — {isDecember ? "жылдық қорытынды жасауға болады." : "айлық талдау жасауға болады."}</div>
          <button onClick={onAnalyze} disabled={analyzing} style={s.smallBtn}>{analyzing ? "…" : "Талдау"}</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatCard icon={<TrendingUp size={16} color="#3B6E71" />} label="Кіріс" value={formatTg(totalIncome)} bg="#EAF1EE" />
        <StatCard icon={<TrendingDown size={16} color="#9C4A44" />} label="Шығыс" value={formatTg(totalExpense)} bg="#F5E9E6" />
      </div>
      <StatCard icon={<Wallet size={16} color={balance >= 0 ? "#3B6E71" : "#9C4A44"} />} label="Қалдық" value={formatTg(balance)} bg={balance >= 0 ? "#EAF1EE" : "#F5E9E6"} wide />

      <div style={s.tipBox}>
        <Sparkles size={16} color="#B8863B" style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 12.6, lineHeight: 1.45 }}>{smartTip}</div>
      </div>

      {alertsList.slice(0, 2).map((a) => (
        <div key={a.id} style={s.alertBox}>
          <AlertTriangle size={15} color="#9C4A44" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12 }}><b>{a.label}</b>: {Math.round(a.share * 100)}% (шек {Math.round(a.limit * 100)}%)</span>
        </div>
      ))}

      <div style={s.card}>
        <div style={s.cardTitle}>Шығын құрылымы</div>
        {byCategory.length === 0 ? (
          <div style={{ color: "#9C947F", fontSize: 12.5, padding: "24px 0", textAlign: "center" }}>Шығын енгізіңіз</div>
        ) : (
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
                {byCategory.map((c, i) => <Cell key={i} fill={c.color} />)}
              </Pie>
              <Tooltip formatter={(v) => formatTg(v)} />
            </PieChart>
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
                <span style={{ fontWeight: 700, fontSize: 12.5, color: it.type === "expense" ? "#9C4A44" : "#3B6E71" }}>
                  {it.type === "expense" ? "-" : "+"}{formatTg(it.amount)}
                </span>
                <Trash2 size={13} color="#C9C2B0" onClick={() => it.type === "expense" ? removeExpense(it.id) : removeIncome(it.id)} />
              </div>
            </div>
          ))}
        {incomes.length === 0 && expenses.length === 0 && <div style={{ color: "#9C947F", fontSize: 12.5, textAlign: "center", padding: "12px 0" }}>Жазба жоқ</div>}
      </div>
    </div>
  );
}

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

function AnalysisScreen({ analysis, onRun, analyzing, isLastDay, isDecember, monthLabel, year }) {
  if (!analysis) {
    return (
      <div style={{ textAlign: "center", padding: "50px 18px" }}>
        <BarChart3 size={34} color="#C9C2B0" />
        <div style={{ fontSize: 13, color: "#9C947F", marginTop: 12, lineHeight: 1.5 }}>
          {isLastDay
            ? `${monthLabel} айының соңы келді — талдау жасауға дайын.`
            : `Талдау тек айдың соңғы күнінде (немесе желтоқсанның 31-інде жылдық талдау) қолжетімді болады.`}
        </div>
        {isLastDay && <button onClick={onRun} disabled={analyzing} style={{ ...s.primaryBtn, marginTop: 16, background: "#3B6E71" }}>{analyzing ? "Есептелуде…" : (isDecember ? "Жылдық талдау жасау" : "Айлық талдау жасау")}</button>}
      </div>
    );
  }
  if (analysis.type === "error") return <div style={{ padding: 20, fontSize: 13 }}>Қате шықты, қайта көріңіз.</div>;

  const { monthSummary, yearCompare, type } = analysis;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={s.card}>
        <div style={s.cardTitle}>{MONTHS[monthSummary.month - 1]} {monthSummary.year} — қорытынды</div>
        <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
          <MiniStat label="Кіріс" value={formatTg(monthSummary.totalIncome)} color="#3B6E71" />
          <MiniStat label="Шығыс" value={formatTg(monthSummary.totalExpense)} color="#9C4A44" />
          <MiniStat label="Қалдық" value={formatTg(monthSummary.balance)} color={monthSummary.balance >= 0 ? "#3B6E71" : "#9C4A44"} />
        </div>
        {monthSummary.overLimit.length > 0 ? (
          <div style={{ fontSize: 12, marginTop: 12 }}>
            <b>Лимиттен асқан санаттар:</b>
            <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
              {monthSummary.overLimit.map((c) => <li key={c.id} style={{ marginBottom: 3 }}>{c.label}: {formatTg(c.spent)} ({Math.round(c.share * 100)}%)</li>)}
            </ul>
          </div>
        ) : <div style={{ fontSize: 12, color: "#3B6E71", marginTop: 10 }}>Барлық санаттар лимит шегінде.</div>}
      </div>

      {type === "year" && yearCompare && (
        <div style={s.card}>
          <div style={s.cardTitle}>{yearCompare.year} vs {yearCompare.prevYear}</div>
          {yearCompare.prevYearTotals.monthsFound === 0 ? (
            <div style={{ fontSize: 12, color: "#9C947F" }}>{yearCompare.prevYear} жылы деректер табылмады.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              <CompareRow label="Кіріс" a={yearCompare.prevYearTotals.income} b={yearCompare.thisYearTotals.income} />
              <CompareRow label="Шығыс" a={yearCompare.prevYearTotals.expense} b={yearCompare.thisYearTotals.expense} />
              <CompareRow label="Қалдық" a={yearCompare.prevYearTotals.balance} b={yearCompare.thisYearTotals.balance} />
            </div>
          )}
        </div>
      )}

      {isLastDay && <button onClick={onRun} disabled={analyzing} style={{ ...s.primaryBtn, background: "#3B6E71" }}>{analyzing ? "Есептелуде…" : "Қайта талдау"}</button>}
    </div>
  );
}

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
        Деректер осы құрылғыда (браузерде) автоматты сақталады. Әр ай бөлек жазылады, сондықтан өткен айларға қайта оралып, оларды қарауға болады.
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
function FieldLabel({ children }) { return <div style={{ fontSize: 11, color: "#9C947F", margin: "10px 0 4px" }}>{children}</div>; }
function MiniStat({ label, value, color }) {
  return <div><div style={{ fontSize: 10.5, color: "#9C947F" }}>{label}</div><div style={{ fontSize: 14, fontWeight: 800, color }}>{value}</div></div>;
}
function CompareRow({ label, a, b }) {
  const diff = b - a;
  const pct = a !== 0 ? Math.round((diff / Math.abs(a)) * 100) : null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderTop: "1px solid #F0EAD9", paddingTop: 7 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span>{formatTg(a)} → {formatTg(b)}</span>
      <span style={{ color: diff >= 0 ? "#3B6E71" : "#9C4A44", fontWeight: 700 }}>{diff >= 0 ? "+" : ""}{pct !== null ? `${pct}%` : ""}</span>
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
        <div style={s.scrollRow}>
          {YEARS.map((y) => <Pill key={y} active={y === year} onClick={() => setYear(y)}>{y}</Pill>)}
        </div>
        <FieldLabel>Ай</FieldLabel>
        <div style={s.scrollRow}>
          {MONTHS.map((m, i) => <Pill key={m} active={i + 1 === month} onClick={() => setMonth(i + 1)}>{m}</Pill>)}
        </div>
        <FieldLabel>Күн</FieldLabel>
        <div style={s.scrollRow}>
          {Array.from({ length: dim }, (_, i) => i + 1).map((d) => <Pill key={d} active={d === day} onClick={() => setDay(d)}>{d}</Pill>)}
        </div>
        <button onClick={onClose} style={{ ...s.primaryBtn, background: "#2B2620", marginTop: 16 }}>Дайын</button>
      </div>
    </div>
  );
}
function Pill({ active, onClick, children }) {
  return <button onClick={onClick} style={{ ...s.pill, ...(active ? s.pillActive : {}) }}>{children}</button>;
}

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
  banner: { background: "#EAF1EE", border: "1px solid #C9DED6", borderRadius: 13, padding: "9px 12px", display: "flex", alignItems: "center", gap: 8 },
  smallBtn: { background: "#3B6E71", color: "white", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700 },
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
  sheet: { background: "white", borderRadius: "20px 20px 0 0", padding: "10px 18px 24px", width: "100%", maxWidth: 430, maxHeight: "75vh", overflowY: "auto" },
  sheetHandle: { width: 36, height: 4, background: "#E4DCCB", borderRadius: 999, margin: "4px auto 12px" },
  scrollRow: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 },
  pill: { flexShrink: 0, border: "1px solid #E4DCCB", background: "white", borderRadius: 999, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "#2B2620" },
  pillActive: { background: "#2B2620", color: "white", borderColor: "#2B2620" },
};
