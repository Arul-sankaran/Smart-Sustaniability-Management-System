import { useEffect, useState, useContext, useMemo } from "react";
import {
  Grid, Card, CardContent, Typography, Box,
  LinearProgress, Chip, MenuItem, Select, FormControl, InputLabel
} from "@mui/material";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, Filler
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { PieChart } from "@mui/x-charts/PieChart";
import { Button, CircularProgress as MuiSpinner } from "@mui/material";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { generateUsageReport } from "../utils/generateReport";
import { checkGoalUsageThresholds } from "../utils/sendNotificationEmail";
import "../index.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Filler);

/* ─── constants ─────────────────────────────────── */
const EF = { water: 0.0003, electricity: 0.000233, waste: 0.5 };
const toEmi = (w, e, ws) => +(w * EF.water + e * EF.electricity + ws * EF.waste).toFixed(4);

const C = {
  water:    "#2E7EB8", waterBg:  "#EBF4FB", waterLight: "#93C6E3",
  elec:     "#C9A84C", elecBg:   "#FDF6E3", elecLight:  "#E8D498",
  waste:    "#2A7A4B", wasteBg:  "#E8F5EE", wasteLight: "#7EC49A",
  emission: "#6E4E2B", emiBg:    "#F5EDE4", emiLight:   "#C8A07A",
  surface:  "#FFFFFF", border:   "#E0D9CE",
  text:     "#1C1A17", sub:      "#7A6F62",
  forest:   "#0D2818", gold:     "#C9A84C", goldLight:  "#FDF6E3",
};

const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt   = n => (n ?? 0).toLocaleString();
const fmtE  = n => (+(n ?? 0)).toFixed(3);
const pctOf = (v, g) => g > 0 ? Math.min((v / g) * 100, 130) : 0;
const PIE_FLOOR = 0.00001;

const PRESET_3  = "past3";
const PRESET_6  = "past6";
const PRESET_12 = "past12";

const cardSx = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: "14px",
  boxShadow: "0 4px 20px rgba(13,40,24,0.08), 0 1px 4px rgba(13,40,24,0.04)",
  transition: "transform .18s, box-shadow .18s",
  "&:hover": { transform: "translateY(-3px)", boxShadow: "0 10px 32px rgba(13,40,24,0.13)" },
};

/* ─── ChartFilter ─────────────────────────────── */
function ChartFilter({ value, onChange, allMonthOptions }) {
  return (
    <FormControl size="small" className="month-sel" sx={{ minWidth: 160 }}>
      <InputLabel sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.8rem" }}>Period</InputLabel>
      <Select value={value} onChange={e => onChange(e.target.value)} label="Period">
        <MenuItem value={PRESET_12} sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.84rem", fontWeight: 700, color: "#1A5230" }}>
          📅 Past 12 months
        </MenuItem>
        <MenuItem value={PRESET_6}  sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.84rem" }}>📅 Past 6 months</MenuItem>
        <MenuItem value={PRESET_3}  sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.84rem" }}>📅 Past 3 months</MenuItem>
        <MenuItem disabled sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.68rem", color: "#A09080", textTransform: "uppercase", letterSpacing: ".08em", borderTop: "1px solid #E2D9CC", mt: 0.5, pt: 1 }}>
          — Specific Month —
        </MenuItem>
        {allMonthOptions.map(o => (
          <MenuItem key={o.value} value={o.value} sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.84rem" }}>
            {o.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

/* ─── KPI Card ────────────────────────────────── */
function KpiCard({ label, value, unit, goal, goalLabel, color, colorBg, icon, isGoal }) {
  const progress = pctOf(value, goal);
  const over = progress > 100;
  return (
    <Card sx={{ ...cardSx, borderTop: `3px solid ${color}`, height: "100%" }}>
      <CardContent sx={{ p: "18px 20px 14px" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 600, fontSize: "0.81rem", color: C.sub }}>
            {label}
          </Typography>
          <Box sx={{ width: 32, height: 32, borderRadius: "8px", background: colorBg, border: `1px solid ${color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95rem" }}>
            {icon}
          </Box>
        </Box>
        <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: "1.75rem", color: C.text, lineHeight: 1.05 }}>
          {typeof value === "number" && !Number.isInteger(value) ? fmtE(value) : fmt(value)}
        </Typography>
        <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.73rem", color: C.sub, mb: 1.5 }}>
          {unit}
        </Typography>
        {isGoal ? (
          <Chip label="Annual Target" size="small" sx={{ bgcolor: colorBg, color, fontWeight: 700, fontSize: "0.68rem", fontFamily: "'Plus Jakarta Sans',sans-serif", border: `1px solid ${color}30` }} />
        ) : (
          <>
            <LinearProgress variant="determinate" value={Math.min(progress, 100)} sx={{ height: 5, borderRadius: 3, bgcolor: `${color}18`, "& .MuiLinearProgress-bar": { bgcolor: over ? "#DC2626" : color, borderRadius: 3 } }} />
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: "5px" }}>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.7rem", color: C.sub }}>Goal: {goalLabel}</Typography>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.7rem", fontWeight: 700, color: over ? "#DC2626" : color }}>{progress.toFixed(0)}%</Typography>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Bar options ─────────────────────────────── */
const barOpts = (yLabel) => ({
  maintainAspectRatio: false,
  plugins: {
    legend: { position: "top", labels: { font: { family: "'Plus Jakarta Sans',sans-serif", size: 12 }, usePointStyle: true, pointStyleWidth: 10, padding: 14, color: C.sub } },
    tooltip: { backgroundColor: C.forest, titleFont: { family: "'Plus Jakarta Sans',sans-serif", size: 12 }, bodyFont: { family: "'Plus Jakarta Sans',sans-serif", size: 11 }, padding: 10, cornerRadius: 8 },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: "'Plus Jakarta Sans',sans-serif", size: 11 }, color: C.sub }, border: { color: C.border } },
    y: { grid: { color: "#E8E2D8", borderDash: [4, 4] }, ticks: { font: { family: "'Plus Jakarta Sans',sans-serif", size: 11 }, color: C.sub }, border: { dash: [4, 4], color: "transparent" }, title: { display: !!yLabel, text: yLabel, font: { family: "'Plus Jakarta Sans',sans-serif", size: 11 }, color: C.sub } },
  },
});

/* ═══════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════ */
export default function Dashboard() {
  const { user }  = useContext(AuthContext);
  const [summary, setSummary] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [goals,   setGoals]   = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  const [emBarFilter,    setEmBarFilter]    = useState(PRESET_6);
  const [elecBarFilter,  setElecBarFilter]  = useState(PRESET_6);
  const [waterBarFilter, setWaterBarFilter] = useState(PRESET_6);
  const [wasteBarFilter, setWasteBarFilter] = useState(PRESET_6);
  const [emPieFilter,    setEmPieFilter]    = useState(PRESET_12);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    checkGoalUsageThresholds(goals);
  }, [goals]);

  const fetchData = async () => {
    try {
      const [uRes, gRes] = await Promise.all([API.get("/usage/dashboard"), API.get("/goals")]);
      setSummary(uRes.data.summary || []);
      setMonthly(uRes.data.monthly || []);
      setGoals(gRes.data           || []);
    } catch (e) { console.error(e); }
  };

  const handleDownloadReport = async () => {
    setReportLoading(true);
    try {
      // Forecasts are available to every role; alerts are admin-only, so we
      // fetch that one separately and just leave it out of the report if it 403s.
      const forecastEntries = await Promise.all(
        ["water", "electricity", "waste"].map(async (category) => {
          try {
            const { data } = await API.get(`/insights/forecast?category=${category}`);
            return [category, data];
          } catch {
            return [category, null];
          }
        })
      );
      const forecasts = Object.fromEntries(forecastEntries);

      let alerts = [];
      if (user?.role === "admin") {
        try {
          const { data } = await API.get("/insights/alerts");
          alerts = data.alerts || [];
        } catch {
          // not fatal — report just won't include the alerts section
        }
      }

      // Block-wise section needs the raw records (admin/staff only) — skipped if unavailable
      let usageRecords = [];
      try {
        const { data } = await API.get("/usage/all");
        usageRecords = Array.isArray(data) ? data : [];
      } catch {
        // not fatal — report just won't include the block-wise section
      }

      generateUsageReport({ summary, monthly, goals, forecasts, alerts, usageRecords, generatedBy: user?.name || "" });
    } catch (e) {
      console.error("Report generation failed:", e);
    } finally {
      setReportLoading(false);
    }
  };

  const waterGoal = goals.find(g => g.category === "water")?.target       || 0;
  const elecGoal  = goals.find(g => g.category === "electricity")?.target || 0;
  const wasteGoal = goals.find(g => g.category === "waste")?.target       || 0;
  const emiGoal   = toEmi(waterGoal, elecGoal, wasteGoal);

  const waterTotal = summary.find(s => s._id === "water")?.total       || 0;
  const elecTotal  = summary.find(s => s._id === "electricity")?.total || 0;
  const wasteTotal = summary.find(s => s._id === "waste")?.total       || 0;
  const emiTotal   = toEmi(waterTotal, elecTotal, wasteTotal);

  const monthlyMap = useMemo(() => {
    const map = {};
    monthly.forEach(m => { const k = `${m._id.year}-${m._id.month}-${m._id.category}`; map[k] = (map[k] || 0) + m.total; });
    return map;
  }, [monthly]);

  const getVal = (year, month, cat) => monthlyMap[`${year}-${month}-${cat}`] || 0;

  const lastSlot = useMemo(() => {
    let maxYear = 0, maxMonth = 0;
    monthly.forEach(m => { if (m._id.year > maxYear || (m._id.year === maxYear && m._id.month > maxMonth)) { maxYear = m._id.year; maxMonth = m._id.month; } });
    if (!maxYear) { const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() + 1 }; }
    return { year: maxYear, month: maxMonth };
  }, [monthly]);

  const allMonthOptions = useMemo(() => {
    const seen = new Set();
    monthly.forEach(m => seen.add(`${m._id.year}-${m._id.month}`));
    return [...seen].map(k => { const [y, mo] = k.split("-").map(Number); return { value: `${y}-${mo}`, label: `${MN[mo-1]} ${y}`, year: y, month: mo }; })
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  }, [monthly]);

  const resolveSlots = (filterVal) => {
    if ([PRESET_3, PRESET_6, PRESET_12].includes(filterVal)) {
      const count = filterVal === PRESET_3 ? 3 : filterVal === PRESET_6 ? 6 : 12;
      return Array.from({ length: count }, (_, i) => {
        const d = new Date(lastSlot.year, lastSlot.month - 1 - (count - 1 - i), 1);
        return { year: d.getFullYear(), month: d.getMonth() + 1, label: `${MN[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` };
      });
    }
    const [y, mo] = filterVal.split("-").map(Number);
    return [{ year: y, month: mo, label: `${MN[mo-1]} ${y}` }];
  };

  const buildBar = (filterVal, cat, actualColor, goalColor, actualLabel, goalLabel, annualGoal) => {
    const slots = resolveSlots(filterVal);
    const monthGoal = +(annualGoal / 12).toFixed(2);
    return { labels: slots.map(s => s.label), datasets: [
      { label: actualLabel, data: slots.map(s => getVal(s.year, s.month, cat)), backgroundColor: actualColor, borderRadius: 5 },
      { label: goalLabel,   data: slots.map(() => monthGoal), backgroundColor: goalColor, borderRadius: 5 },
    ]};
  };

  const buildEmiBar = (filterVal) => {
    const slots = resolveSlots(filterVal);
    const monthGoal = +(emiGoal / 12).toFixed(4);
    return { labels: slots.map(s => s.label), datasets: [
      { label: "Actual (tCO2e)", data: slots.map(s => toEmi(getVal(s.year, s.month, "water"), getVal(s.year, s.month, "electricity"), getVal(s.year, s.month, "waste"))), backgroundColor: C.emission, borderRadius: 5 },
      { label: "Monthly Goal",   data: slots.map(() => monthGoal), backgroundColor: C.emiLight, borderRadius: 5 },
    ]};
  };

  const buildPieAgg = (filterVal) => {
    const slots = resolveSlots(filterVal);
    let totW = 0, totE = 0, totWs = 0;
    slots.forEach(s => { totW += getVal(s.year, s.month, "water"); totE += getVal(s.year, s.month, "electricity"); totWs += getVal(s.year, s.month, "waste"); });
    return { totW, totE, totWs };
  };

  const filterLabel = (filterVal) => {
    if (filterVal === PRESET_3)  return "Past 3 months";
    if (filterVal === PRESET_6)  return "Past 6 months";
    if (filterVal === PRESET_12) return "Past 12 months";
    const [y, mo] = filterVal.split("-").map(Number);
    return `${MN[mo-1]} ${y}`;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const emiBar   = useMemo(() => buildEmiBar(emBarFilter),   [emBarFilter,   monthlyMap, emiGoal,   lastSlot]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const elecBar  = useMemo(() => buildBar(elecBarFilter,  "electricity", C.elec,     C.elecLight,  "Actual (kWh)", "Monthly Goal", elecGoal),  [elecBarFilter,  monthlyMap, elecGoal,  lastSlot]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const waterBar = useMemo(() => buildBar(waterBarFilter, "water",       C.water,    C.waterLight, "Actual (L)",   "Monthly Goal", waterGoal), [waterBarFilter, monthlyMap, waterGoal, lastSlot]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const wasteBar = useMemo(() => buildBar(wasteBarFilter, "waste",       C.waste,    C.wasteLight, "Actual (kg)",  "Monthly Goal", wasteGoal), [wasteBarFilter, monthlyMap, wasteGoal, lastSlot]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { totW: emW_agg, totE: emE_agg, totWs: emWs_agg } = useMemo(() => buildPieAgg(emPieFilter), [emPieFilter, monthlyMap, lastSlot]);

  const emW_pie  = +(emW_agg  * EF.water).toFixed(4);
  const emE_pie  = +(emE_agg  * EF.electricity).toFixed(4);
  const emWs_pie = +(emWs_agg * EF.waste).toFixed(4);
  const emSum    = emW_pie + emE_pie + emWs_pie;
  const pctPie   = v => emSum > 0 ? (v / emSum * 100).toFixed(1) : "0.0";

  const emiPieSeries = [{ innerRadius: 55, outerRadius: 110, paddingAngle: 3, cornerRadius: 6, highlightScope: { fade: "global", highlight: "item" },
    data: [
      { id: 0, value: emW_pie  > 0 ? emW_pie  : PIE_FLOOR, label: `Water (${pctPie(emW_pie)}%)`,       color: C.water  },
      { id: 1, value: emE_pie  > 0 ? emE_pie  : PIE_FLOOR, label: `Electricity (${pctPie(emE_pie)}%)`, color: C.elec   },
      { id: 2, value: emWs_pie > 0 ? emWs_pie : PIE_FLOOR, label: `Waste (${pctPie(emWs_pie)}%)`,      color: C.waste  },
    ],
  }];

  const recycledPct = 45;
  const wastePieSeries = [{ innerRadius: 55, outerRadius: 110, paddingAngle: 3, cornerRadius: 6, highlightScope: { fade: "global", highlight: "item" },
    data: [
      { id: 0, value: recycledPct,       label: `Recycled (${recycledPct}%)`,     color: C.waste   },
      { id: 1, value: 100-recycledPct,   label: `Landfill (${100-recycledPct}%)`, color: "#C8BFB4" },
    ],
  }];

  const emPieSubtitle = emPieFilter.includes("-")
    ? filterLabel(emPieFilter)
    : `${filterLabel(emPieFilter)} ending ${MN[lastSlot.month-1]} ${lastSlot.year}`;

  const barSubtitle = (filter) =>
    `${filterLabel(filter)}${filter.startsWith("past") ? ` ending ${MN[lastSlot.month-1]} ${lastSlot.year}` : ""}`;

  return (
    <div className="dash">

      {/* HEADER */}
      <Box className="row" sx={{ mb: 3.5, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <div className="dash-live-badge">
            <div className="dash-live-dot" />
            Live Dashboard
          </div>
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: { xs: "1.7rem", md: "2.1rem" }, color: C.text, lineHeight: 1.1, mb: "5px" }}>
            Sustainability Dashboard
          </Typography>
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.88rem", color: C.sub }}>
            Welcome back, <strong style={{ color: C.text }}>{user?.name || "User"}</strong> — track campus resource consumption and environmental targets.
          </Typography>
        </Box>

        <Button
          variant="contained"
          onClick={handleDownloadReport}
          disabled={reportLoading}
          startIcon={reportLoading ? <MuiSpinner size={16} sx={{ color: "#fff" }} /> : <PictureAsPdfOutlinedIcon sx={{ fontSize: 18 }} />}
          sx={{
            textTransform: "none", bgcolor: C.forest, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700,
            fontSize: "0.82rem", boxShadow: "none", px: 2.2, py: 1,
            "&:hover": { bgcolor: "#0A2015", boxShadow: "none" },
          }}
        >
          {reportLoading ? "Generating..." : "Download PDF Report"}
        </Button>
      </Box>

      {/* ROW 1 — GOALS */}
      <Typography className="sec-label row "><strong>Sustainability Goals</strong></Typography>
      <Grid container spacing={2.5} className="row" sx={{ mb: 3.5 }}>
        {[
          { label: "Total Emission Goal",  value: emiGoal,   unit: "tCO2e — annual target", color: C.emission, colorBg: C.emiBg,   icon: "🌍" },
          { label: "Water Usage Goal",     value: waterGoal, unit: "Litres — annual target", color: C.water,    colorBg: C.waterBg, icon: "💧" },
          { label: "Electricity Goal",     value: elecGoal,  unit: "kWh — annual target",    color: C.elec,     colorBg: C.elecBg,  icon: "⚡" },
          { label: "Waste Reduction Goal", value: wasteGoal, unit: "kg — annual target",     color: C.waste,    colorBg: C.wasteBg, icon: "🗑" },
        ].map(k => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={k.label}><KpiCard {...k} isGoal /></Grid>
        ))}
      </Grid>

      {/* ROW 2 — ACTUAL USAGE */}
      <Typography className="sec-label row"><b>Actual Usage</b></Typography>
      <Grid container spacing={2.5} className="row" sx={{ mb: 3.5 }}>
        {[
          { label: "Total Emission",    value: emiTotal,   unit: "tCO2e this period", goal: emiGoal,   goalLabel: `${fmtE(emiGoal)} tCO2e`, color: C.emission, colorBg: C.emiBg,   icon: "🌍" },
          { label: "Water Usage",       value: waterTotal, unit: "Litres this period", goal: waterGoal, goalLabel: `${fmt(waterGoal)} L`,     color: C.water,    colorBg: C.waterBg, icon: "💧" },
          { label: "Electricity Usage", value: elecTotal,  unit: "kWh this period",    goal: elecGoal,  goalLabel: `${fmt(elecGoal)} kWh`,    color: C.elec,     colorBg: C.elecBg,  icon: "⚡" },
          { label: "Waste Generated",   value: wasteTotal, unit: "kg this period",     goal: wasteGoal, goalLabel: `${fmt(wasteGoal)} kg`,    color: C.waste,    colorBg: C.wasteBg, icon: "🗑" },
        ].map(k => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={k.label}><KpiCard {...k} isGoal={false} /></Grid>
        ))}
      </Grid>

      {/* ROW 3 — Emission | Electricity */}
      <Grid container spacing={3} className="row" sx={{ mb: 3 }}>
        {[
          { title: "Total Emission — Goal vs Actual",  unit: "tCO2e", data: emiBar,  filter: emBarFilter,   setFilter: setEmBarFilter   },
          { title: "Electricity — Goal vs Actual",     unit: "kWh",   data: elecBar, filter: elecBarFilter, setFilter: setElecBarFilter  },
        ].map(ch => (
          <Grid size={{ xs: 12, md: 6 }} key={ch.title}>
            <Card sx={cardSx}>
              <CardContent sx={{ p: "22px 22px 14px" }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 2 }}>
                  <Box>
                    <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: "0.94rem", color: C.text }}>{ch.title}</Typography>
                    <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.78rem", color: C.sub }}>{barSubtitle(ch.filter)}</Typography>
                  </Box>
                  <ChartFilter value={ch.filter} onChange={ch.setFilter} allMonthOptions={allMonthOptions} />
                </Box>
                <div style={{ height: 270 }}><Bar data={ch.data} options={barOpts(ch.unit)} /></div>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ROW 4 — Water | Waste */}
      <Grid container spacing={3} className="row" sx={{ mb: 3 }}>
        {[
          { title: "Water Usage — Goal vs Actual",     unit: "Litres", data: waterBar, filter: waterBarFilter, setFilter: setWaterBarFilter },
          { title: "Waste Generated — Goal vs Actual", unit: "kg",     data: wasteBar, filter: wasteBarFilter, setFilter: setWasteBarFilter },
        ].map(ch => (
          <Grid size={{ xs: 12, md: 6 }} key={ch.title}>
            <Card sx={cardSx}>
              <CardContent sx={{ p: "22px 22px 14px" }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 2 }}>
                  <Box>
                    <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: "0.94rem", color: C.text }}>{ch.title}</Typography>
                    <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.78rem", color: C.sub }}>{barSubtitle(ch.filter)}</Typography>
                  </Box>
                  <ChartFilter value={ch.filter} onChange={ch.setFilter} allMonthOptions={allMonthOptions} />
                </Box>
                <div style={{ height: 270 }}><Bar data={ch.data} options={barOpts(ch.unit)} /></div>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ROW 5 — Pie charts */}
      <Grid container spacing={3} className="row" alignItems="stretch">

        {/* Emission distribution */}
        <Grid size={{ xs: 12, md: 6 }} sx={{ display: "flex" }}>
          <Card sx={{ ...cardSx, width: "100%" }}>
            <CardContent sx={{ p: "22px 22px 20px" }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 1 }}>
                <Box>
                  <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: "0.94rem", color: C.text }}>Emission Distribution</Typography>
                  <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.78rem", color: C.sub }}>{emPieSubtitle}</Typography>
                </Box>
                <ChartFilter value={emPieFilter} onChange={setEmPieFilter} allMonthOptions={allMonthOptions} />
              </Box>

              <Chip label={`${filterLabel(emPieFilter)}: ${fmtE(emSum)} tCO2e total`} size="small" sx={{ mb: 1.5, bgcolor: C.emiBg, color: C.emission, fontWeight: 700, fontSize: "0.72rem", fontFamily: "'Plus Jakarta Sans',sans-serif", border: `1px solid ${C.emission}30` }} />

              <div className="pie-chips">
                {[
                  { label: `💧 Water: ${fmtE(emW_pie)} tCO2e`,  color: C.water, bg: C.waterBg },
                  { label: `⚡ Elec: ${fmtE(emE_pie)} tCO2e`,   color: C.elec,  bg: C.elecBg  },
                  { label: `🗑 Waste: ${fmtE(emWs_pie)} tCO2e`, color: C.waste, bg: C.wasteBg },
                ].map(c => (
                  <Chip key={c.label} label={c.label} size="small" sx={{ bgcolor: c.bg, color: c.color, border: `1px solid ${c.color}30`, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: "0.69rem" }} />
                ))}
              </div>

              <PieChart series={emiPieSeries} height={260} margin={{ top: 0, bottom: 0, left: 0, right: 0 }} slotProps={{ legend: { hidden: true } }}
                tooltip={{
                  trigger: "item",
                  itemContent: (params) => {
                    const d = params?.series?.data?.[params?.itemIndex];
                    if (!d) return null;
                    const usageVals = [emW_agg, emE_agg, emWs_agg];
                    const emiVals   = [emW_pie, emE_pie, emWs_pie];
                    const units     = ["L", "kWh", "kg"];
                    const formulas  = ["× 0.0003", "× 0.000233", "× 0.5"];
                    const names     = ["Water", "Electricity", "Waste"];
                    return (
                      <div className="pie-tooltip">
                        <div className="pie-tooltip-title">{names[d.id]} {formulas[d.id]}</div>
                        {[
                          { lbl: "Emission:", val: `${fmtE(emiVals[d.id])} tCO2e`, col: [C.water, C.elec, C.waste][d.id] },
                          { lbl: "Usage:",    val: `${fmt(Math.round(usageVals[d.id]))} ${units[d.id]}` },
                          { lbl: "Share:",    val: `${pctPie(emiVals[d.id])}%` },
                        ].map(row => (
                          <div key={row.lbl} className="pie-tooltip-row">
                            <span className="pie-tooltip-lbl">{row.lbl}</span>
                            <span style={{ fontWeight: 700, color: row.col || "#F5F0E8" }}>{row.val}</span>
                          </div>
                        ))}
                      </div>
                    );
                  },
                }}>
                <text x="50%" y="43%" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 800, fill: C.emission }}>{fmtE(emSum)}</text>
                <text x="50%" y="51%" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fill: C.sub }}>tCO2e</text>
              </PieChart>

              <div className="pie-legend">
                {[
                  { label: `Water — ${pctPie(emW_pie)}%`,       color: C.water },
                  { label: `Electricity — ${pctPie(emE_pie)}%`, color: C.elec  },
                  { label: `Waste — ${pctPie(emWs_pie)}%`,      color: C.waste },
                ].map(l => (
                  <div key={l.label} className="pie-legend-item">
                    <div className="pie-legend-dot" style={{ background: l.color }} />
                    <span className="pie-legend-label">{l.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* Waste recycling */}
        <Grid size={{ xs: 12, md: 6 }} sx={{ display: "flex" }}>
          <Card sx={{ ...cardSx, width: "100%" }}>
            <CardContent sx={{ p: "22px 22px 20px", display: "flex", flexDirection: "column", height: "100%" }}>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: "0.94rem", color: C.text }}>Waste Recycling Rate</Typography>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.78rem", color: C.sub, mb: 2 }}>Recycled vs landfill / other breakdown</Typography>
              <Box sx={{ display: "flex", gap: 1.5, mb: 1, flexWrap: "wrap" }}>
                <Chip label={`♻️  Recycled: ${recycledPct}%`} size="small" sx={{ bgcolor: C.wasteBg, color: C.waste, fontWeight: 700, fontSize: "0.72rem", fontFamily: "'Plus Jakarta Sans',sans-serif", border: `1px solid ${C.waste}30` }} />
                <Chip label={`🗑  Landfill / Other: ${100-recycledPct}%`} size="small" sx={{ bgcolor: "#F0ECE6", color: C.sub, fontWeight: 600, fontSize: "0.72rem", fontFamily: "'Plus Jakarta Sans',sans-serif" }} />
              </Box>
              <PieChart series={wastePieSeries} height={260} margin={{ top: 0, bottom: 0, left: 0, right: 0 }} slotProps={{ legend: { hidden: true } }}>
                <text x="50%" y="43%" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 20, fontWeight: 800, fill: C.waste }}>{recycledPct}%</text>
                <text x="50%" y="51%" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fill: C.sub }}>recycled</text>
              </PieChart>
              <Box sx={{ flex: 1 }} />
              <div className="pie-legend">
                {[
                  { label: `Recycled (${recycledPct}%)`,           color: C.waste    },
                  { label: `Landfill / Other (${100-recycledPct}%)`, color: "#C8BFB4" },
                ].map(l => (
                  <div key={l.label} className="pie-legend-item">
                    <div className="pie-legend-dot" style={{ background: l.color, border: "1px solid #E0D9CE" }} />
                    <span className="pie-legend-label">{l.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </Grid>

      </Grid>
    </div>
  );
}