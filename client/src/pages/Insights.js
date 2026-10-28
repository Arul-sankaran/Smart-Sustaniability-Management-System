import { useEffect, useState, useContext } from "react";
import { Grid, Chip, CircularProgress, Alert, Collapse, Button } from "@mui/material";
import AutoAwesomeIcon    from "@mui/icons-material/AutoAwesome";
import ExpandMoreIcon     from "@mui/icons-material/ExpandMore";
import ExpandLessIcon     from "@mui/icons-material/ExpandLess";
import TrendingUpIcon     from "@mui/icons-material/TrendingUp";
import TrendingDownIcon   from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon   from "@mui/icons-material/TrendingFlat";
import WarningAmberIcon   from "@mui/icons-material/WarningAmber";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";
import "../index.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const CAT = {
  water:       { label: "Water",       icon: "💧", color: "#2E7EB8", bg: "#EBF4FB", border: "#B3D4EE" },
  electricity: { label: "Electricity", icon: "⚡", color: "#C9A84C", bg: "#FDF6E3", border: "#E8D498" },
  waste:       { label: "Waste",       icon: "🗑", color: "#2A7A4B", bg: "#E8F5EE", border: "#9DD0B3" },
};

function TrendIcon({ trend }) {
  if (trend === "increasing") return <TrendingUpIcon sx={{ fontSize: 16, color: "#DC2626" }} />;
  if (trend === "decreasing") return <TrendingDownIcon sx={{ fontSize: 16, color: "#1A7A4B" }} />;
  return <TrendingFlatIcon sx={{ fontSize: 16, color: "#7A6F62" }} />;
}

// Builds a chart.js dataset showing actual history as a solid line and the
// projected months as a dashed continuation of the same line.
function buildTrendChartData(f, color) {
  const history = f.history || [];
  const series = f.forecastSeries || [];

  const labels = [
    ...history.map(h => MONTH_NAMES[h.month - 1]),
    ...series.map(s => MONTH_NAMES[s.month - 1]),
  ];

  const actualData = [...history.map(h => h.total), ...series.map(() => null)];

  // Connect the forecast line to the last actual point so it reads as one continuous trend
  const forecastData = [
    ...history.slice(0, -1).map(() => null),
    ...(history.length ? [history[history.length - 1].total] : []),
    ...series.map(s => s.predicted),
  ];

  return {
    labels,
    datasets: [
      {
        label: "Actual",
        data: actualData,
        borderColor: color,
        backgroundColor: `${color}22`,
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      },
      {
        label: "Forecast",
        data: forecastData,
        borderColor: color,
        borderDash: [5, 4],
        backgroundColor: "transparent",
        tension: 0.3,
        pointRadius: 2,
      },
    ],
  };
}

const trendChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { mode: "index", intersect: false },
  },
  scales: {
    x: { ticks: { font: { size: 9 } }, grid: { display: false } },
    y: { ticks: { font: { size: 9 } }, grid: { color: "#F0EDE7" } },
  },
};

export default function Insights() {
  const { user } = useContext(AuthContext);
  const [forecasts, setForecasts]         = useState({});
  const [alerts, setAlerts]               = useState([]);
  const [suggestions, setSuggestions]     = useState({});
  const [suggestLoading, setSuggestLoading] = useState(null);
  const [cardErrors, setCardErrors]       = useState({});
  const [expanded, setExpanded]           = useState({});

  useEffect(() => {
    loadForecasts();
    if (user?.role === "admin") loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadForecasts = async () => {
    const results = {};
    await Promise.all(Object.keys(CAT).map(async (category) => {
      try {
        const { data } = await API.get(`/insights/forecast?category=${category}&periods=3`);
        results[category] = data;
      } catch {
        results[category] = null;
      }
    }));
    setForecasts(results);
  };

  const loadAlerts = async () => {
    try {
      const { data } = await API.get("/insights/alerts");
      setAlerts(data.alerts || []);
    } catch {
      // silent — admin-only widget, non-critical
    }
  };

  const getSuggestions = async (category) => {
    setSuggestLoading(category);
    setCardErrors(prev => ({ ...prev, [category]: null }));
    try {
      const { data } = await API.post("/insights/suggestions", { category });
      setSuggestions(prev => ({ ...prev, [category]: data.suggestions }));
      setExpanded(prev => ({ ...prev, [category]: false })); // always start collapsed on fresh content
    } catch (e) {
      setCardErrors(prev => ({ ...prev, [category]: e.response?.data?.message || "Could not fetch suggestions right now." }));
    } finally {
      setSuggestLoading(null);
    }
  };

  const toggleExpand = (category) => {
    setExpanded(prev => ({ ...prev, [category]: !prev[category] }));
  };

  return (
    <div className="eco-page">
      {/* Scoped keyframes for the staggered suggestion reveal */}
      <style>{`
        @keyframes eco-suggestion-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="eco-fade">
        <div className="eco-page-eyebrow">🤖 AI Insights</div>
        <h1 className="eco-page-title">Predictive Insights &amp; Suggestions</h1>
        <p className="eco-page-sub">Forecasted trends and AI-generated recommendations based on your usage history</p>
      </div>

      {user?.role === "admin" && alerts.length > 0 && (
        <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 3 }}>
          <strong>
            {alerts.length} categor{alerts.length > 1 ? "ies need" : "y needs"} attention:
          </strong>{" "}
          {alerts.map(a =>
            a.status === "already_over"
              ? `${CAT[a.category].label} is already over target (+${a.overBy})`
              : `${CAT[a.category].label} projected to cross in ${a.crossesInMonths} month${a.crossesInMonths > 1 ? "s" : ""} (+${a.overBy})`
          ).join(", ")}
        </Alert>
      )}

      <Grid container spacing={2.5}>
        {Object.entries(CAT).map(([category, c]) => {
          const f = forecasts[category];
          const catSuggestions = suggestions[category];
          const catError = cardErrors[category];
          const isExpanded = !!expanded[category];

          return (
            <Grid size={{ xs: 12, md: 4 }} key={category}>
              <div className="eco-card eco-fade">
                <div className="eco-card-title">
                  <div className="eco-card-dot" style={{ background: c.color }} />
                  {c.icon} {c.label}
                </div>

                {!f ? (
                  <CircularProgress size={20} sx={{ mt: 2 }} />
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px 0" }}>
                      <span style={{ fontSize: "1.5rem", fontWeight: 800 }}>{f.forecastNextMonth}</span>
                      <span style={{ fontSize: "0.78rem", color: "#7A6F62" }}>projected next month</span>
                      <TrendIcon trend={f.trend} />
                    </div>

                    {f.forecastSeries?.length > 0 && (
                      <>
                        <div style={{ height: 90, margin: "8px 0" }}>
                          <Line data={buildTrendChartData(f, c.color)} options={trendChartOptions} />
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#7A6F62", marginBottom: 10 }}>
                          Next {f.forecastSeries.length} months:{" "}
                          {f.forecastSeries.map((s, i) => (
                            <span key={i}>
                              <span style={{ fontWeight: 700, color: s.overThreshold ? "#DC2626" : "#3A342C" }}>
                                {s.predicted}
                              </span>
                              {i < f.forecastSeries.length - 1 ? " → " : ""}
                            </span>
                          ))}
                        </div>
                      </>
                    )}

                    {f.goal ? (
                      <Chip
                        label={f.willCrossThreshold
                          ? `⚠️ Above monthly target (${f.goal.monthlyThreshold})`
                          : `On track — target ${f.goal.monthlyThreshold}/mo`}
                        size="small"
                        sx={{
                          bgcolor: f.willCrossThreshold ? "#FDECEC" : c.bg,
                          color:   f.willCrossThreshold ? "#DC2626" : c.color,
                          border: `1px solid ${f.willCrossThreshold ? "#F5B5B5" : c.border}`,
                          fontWeight: 700, fontSize: "0.7rem", mb: 1.5,
                        }}
                      />
                    ) : (
                      <Chip label="No goal set for this category yet" size="small" sx={{ mb: 1.5, fontSize: "0.7rem" }} />
                    )}

                    <div style={{ marginTop: 8 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={suggestLoading === category ? <CircularProgress size={14} /> : <AutoAwesomeIcon sx={{ fontSize: 16 }} />}
                        onClick={() => getSuggestions(category)}
                        disabled={suggestLoading === category}
                        sx={{ textTransform: "none", borderColor: c.border, color: c.color }}
                      >
                        {catSuggestions ? "Regenerate suggestions" : "Get AI suggestions"}
                      </Button>
                    </div>

                    <Collapse in={!!catError} sx={{ mt: 1 }}>
                      <Alert severity="error" sx={{ fontSize: "0.75rem", py: 0.25 }}>{catError}</Alert>
                    </Collapse>

                    {catSuggestions && (
                      <div style={{ marginTop: 14 }}>
                        {/* Collapsed = short preview clamp. Expanded = full list, capped with its own
                            scrollbar only if content is unusually long — this card's height never
                            affects the other two, since the grid row is no longer stretched. */}
                        <div
                          style={{
                            position: "relative",
                            maxHeight: isExpanded ? 420 : 92,
                            overflowY: isExpanded ? "auto" : "hidden",
                            transition: "max-height 0.3s ease",
                          }}
                        >
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.82rem", color: "#3A342C" }}>
                            {catSuggestions.map((s, i) => (
                              <li
                                key={i}
                                style={{
                                  marginBottom: 8,
                                  lineHeight: 1.4,
                                  animation: "eco-suggestion-in 0.35s ease both",
                                  animationDelay: `${i * 90}ms`,
                                }}
                              >
                                {s}
                              </li>
                            ))}
                          </ul>

                          {!isExpanded && (
                            <div
                              style={{
                                position: "absolute",
                                bottom: 0, left: 0, right: 0,
                                height: 32,
                                background: "linear-gradient(to bottom, rgba(255,255,255,0), #FFFFFF)",
                                pointerEvents: "none",
                              }}
                            />
                          )}
                        </div>

                        <Button
                          size="small"
                          onClick={() => toggleExpand(category)}
                          endIcon={isExpanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                          sx={{ textTransform: "none", fontSize: "0.72rem", color: c.color, mt: 0.5, px: 0, minWidth: 0 }}
                        >
                          {isExpanded ? "Show less" : "View more"}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Grid>
          );
        })}
      </Grid>
    </div>
  );
}
