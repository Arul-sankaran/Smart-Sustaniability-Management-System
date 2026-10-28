import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const CAT_META = {
  water:       { label: "Water",       unit: "L" },
  electricity: { label: "Electricity", unit: "kWh" },
  waste:       { label: "Waste",       unit: "kg" },
};

const BLOCKS = ["AS Block", "IB Block", "SF Block", "Mechanical Block", "Boys Hostel", "Girls Hostel"];
const UNASSIGNED = "Unassigned";

const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const COLORS = {
  forest: [13, 40, 24],
  gold:   [201, 168, 76],
  text:   [28, 26, 23],
  sub:    [122, 111, 98],
  danger: [220, 38, 38],
  ok:     [26, 122, 75],
};

/**
 * Builds and downloads a PDF sustainability usage report.
 *
 * @param {Object} params
 * @param {{_id:string, total:number}[]} params.summary - category totals from /usage/dashboard
 * @param {{_id:{year:number,month:number,category:string}, total:number}[]} params.monthly - monthly breakdown from /usage/dashboard
 * @param {Array} params.goals - goals array (with currentUsage) from /goals
 * @param {Object} params.forecasts - { water: forecastResponse|null, electricity: ..., waste: ... } from /insights/forecast
 * @param {Array} params.usageRecords - raw usage records from /usage/all (used for the block-wise section; pass [] if unavailable)
 * @param {Array} params.alerts - alerts array from /insights/alerts (admin only; pass [] if unavailable)
 * @param {string} params.generatedBy - name of the user generating the report
 */
export function generateUsageReport({ summary = [], monthly = [], goals = [], forecasts = {}, alerts = [], usageRecords = [], generatedBy = "" }) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;

  // ── Header ──────────────────────────────────────────
  doc.setFillColor(...COLORS.forest);
  doc.rect(0, 0, pageWidth, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("EcoMetric — Sustainability Usage Report", marginX, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const now = new Date();
  doc.text(`Generated ${now.toLocaleDateString()} ${now.toLocaleTimeString()}${generatedBy ? `  •  by ${generatedBy}` : ""}`, marginX, 22);

  let y = 34;
  doc.setTextColor(...COLORS.text);

  // ── Usage Summary ───────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Usage Summary", marginX, y);
  y += 4;

  const summaryRows = ["water", "electricity", "waste"].map(cat => {
    const meta = CAT_META[cat];
    const total = summary.find(s => s._id === cat)?.total || 0;
    const goal = goals.find(g => g.category === cat);
    const pct = goal?.target ? Math.min(999, (total / goal.target) * 100).toFixed(1) : "—";
    return [meta.label, `${total.toLocaleString()} ${meta.unit}`, goal ? `${goal.target.toLocaleString()} ${meta.unit}` : "No goal set", `${pct}%`];
  });

  autoTable(doc, {
    startY: y,
    head: [["Category", "Total Usage", "Annual Target", "% of Target"]],
    body: summaryRows,
    theme: "striped",
    headStyles: { fillColor: COLORS.forest, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: marginX, right: marginX },
  });
  y = doc.lastAutoTable.finalY + 12;

  // ── Monthly Breakdown ───────────────────────────────
  const monthMap = {};
  monthly.forEach(m => {
    const key = `${m._id.year}-${m._id.month}`;
    if (!monthMap[key]) monthMap[key] = { year: m._id.year, month: m._id.month, water: 0, electricity: 0, waste: 0 };
    monthMap[key][m._id.category] = (monthMap[key][m._id.category] || 0) + m.total;
  });
  const monthRows = Object.values(monthMap)
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    .map(r => [`${MN[r.month - 1]} ${r.year}`, r.water.toLocaleString(), r.electricity.toLocaleString(), r.waste.toLocaleString()]);

  if (monthRows.length) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Monthly Breakdown", marginX, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Month", "Water (L)", "Electricity (kWh)", "Waste (kg)"]],
      body: monthRows,
      theme: "striped",
      headStyles: { fillColor: COLORS.forest, fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      margin: { left: marginX, right: marginX },
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  // ── Block-wise Usage & Goal ─────────────────────────
  if (usageRecords.length) {
    const blockTotals = {};
    [...BLOCKS, UNASSIGNED].forEach(b => { blockTotals[b] = { water: 0, electricity: 0, waste: 0 }; });
    usageRecords.forEach(r => {
      const b = BLOCKS.includes(r.location) ? r.location : UNASSIGNED;
      if (blockTotals[b][r.category] !== undefined) blockTotals[b][r.category] += Number(r.amount) || 0;
    });

    const goalOf = cat => goals.find(g => g.category === cat)?.target || 0;
    const cell = (cat, v) => {
      const goal = goalOf(cat);
      return [`${v.toLocaleString()}`, goal ? `${((v / goal) * 100).toFixed(1)}%` : "—"];
    };

    const blockRows = Object.entries(blockTotals)
      .filter(([name, t]) => name !== UNASSIGNED || t.water + t.electricity + t.waste > 0)
      .map(([name, t]) => [name, ...cell("water", t.water), ...cell("electricity", t.electricity), ...cell("waste", t.waste)]);

    const grand = { water: 0, electricity: 0, waste: 0 };
    Object.values(blockTotals).forEach(t => { Object.keys(grand).forEach(c => { grand[c] += t[c]; }); });
    blockRows.push(["Campus total", ...cell("water", grand.water), ...cell("electricity", grand.electricity), ...cell("waste", grand.waste)]);

    if (y > 200) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Block-wise Usage & Goal", marginX, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.sub);
    const goalLine = ["water", "electricity", "waste"]
      .map(c => `${CAT_META[c].label}: ${goalOf(c) ? `${goalOf(c).toLocaleString()} ${CAT_META[c].unit}` : "no goal"}`)
      .join("   |   ");
    doc.text(`Campus annual targets — ${goalLine}`, marginX, y);
    y += 2;
    doc.setTextColor(...COLORS.text);

    const lastRow = blockRows.length - 1;
    autoTable(doc, {
      startY: y + 2,
      head: [
        [{ content: "Block", rowSpan: 2 }, { content: `Water (${CAT_META.water.unit})`, colSpan: 2, styles: { halign: "center" } }, { content: `Electricity (${CAT_META.electricity.unit})`, colSpan: 2, styles: { halign: "center" } }, { content: `Waste (${CAT_META.waste.unit})`, colSpan: 2, styles: { halign: "center" } }],
        ["Usage", "% of Goal", "Usage", "% of Goal", "Usage", "% of Goal"],
      ],
      body: blockRows,
      theme: "striped",
      headStyles: { fillColor: COLORS.forest, fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
      margin: { left: marginX, right: marginX },
      didParseCell: (data) => {
        if (data.section === "body" && data.row.index === lastRow) data.cell.styles.fontStyle = "bold";
      },
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  // ── Goals & Progress ────────────────────────────────
  if (goals.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Goals & Progress", marginX, y);
    y += 4;

    const goalRows = goals.map(g => {
      const meta = CAT_META[g.category] || { unit: g.unit || "" };
      const current = g.currentUsage || 0;
      const pct = g.target > 0 ? Math.min(999, (current / g.target) * 100) : 0;
      const status = pct >= 100 ? "Over target" : pct >= 80 ? "Near target" : "On track";
      return [g.title, meta.label || g.category, `${g.target?.toLocaleString()} ${meta.unit}`, `${current.toLocaleString()} ${meta.unit}`, `${pct.toFixed(0)}%`, status];
    });

    autoTable(doc, {
      startY: y,
      head: [["Goal", "Category", "Target", "Used So Far", "%", "Status"]],
      body: goalRows,
      theme: "striped",
      headStyles: { fillColor: COLORS.forest, fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      margin: { left: marginX, right: marginX },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 5) {
          const val = data.cell.raw;
          if (val === "Over target") data.cell.styles.textColor = COLORS.danger;
          else if (val === "On track") data.cell.styles.textColor = COLORS.ok;
        }
      },
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  // ── AI Forecast Summary ─────────────────────────────
  const forecastRows = ["water", "electricity", "waste"]
    .map(cat => {
      const f = forecasts[cat];
      if (!f) return null;
      const meta = CAT_META[cat];
      return [meta.label, f.trend, `${f.forecastNextMonth?.toLocaleString()} ${meta.unit}`, f.willCrossThreshold ? "Yes" : "No"];
    })
    .filter(Boolean);

  if (forecastRows.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("AI Forecast Summary", marginX, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Category", "Trend", "Next Month Projection", "Projected to Exceed Target?"]],
      body: forecastRows,
      theme: "striped",
      headStyles: { fillColor: COLORS.forest, fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      margin: { left: marginX, right: marginX },
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  // ── Active Alerts ────────────────────────────────────
  if (alerts.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.danger);
    doc.text("Active Alerts", marginX, y);
    doc.setTextColor(...COLORS.text);
    y += 4;

    const alertRows = alerts.map(a => {
      const meta = CAT_META[a.category] || { label: a.category };
      return a.status === "already_over"
        ? [meta.label, "Already over target", `+${a.overBy?.toLocaleString?.() ?? a.overBy}`]
        : [meta.label, `Projected to cross in ${a.crossesInMonths} month(s)`, `+${a.overBy}`];
    });

    autoTable(doc, {
      startY: y,
      head: [["Category", "Issue", "Amount Over"]],
      body: alertRows,
      theme: "striped",
      headStyles: { fillColor: COLORS.danger, fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      margin: { left: marginX, right: marginX },
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  // ── Footer: page numbers ─────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.sub);
    doc.text(`EcoMetric Sustainability OS  •  Page ${i} of ${pageCount}`, marginX, doc.internal.pageSize.getHeight() - 8);
  }

  const filename = `EcoMetric-Report-${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
