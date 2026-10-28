import { useEffect, useState } from "react";
import { TextField, Grid, MenuItem, Chip, CircularProgress, Alert, Collapse, LinearProgress, Button } from "@mui/material";
import { AddCircleOutline, DeleteOutline, AutoAwesome, TrendingUp, TrendingDown, TrendingFlat, WarningAmberOutlined, CheckCircleOutline } from "@mui/icons-material";
import API from "../services/api";
import "../index.css";

const CAT_RAW = {
  electricity: { color: "#C9A84C", bg: "#FDF6E3", border: "#E8D498", icon: "⚡", label: "Electricity"},
  water: { color: "#2E7EB8", bg: "#EBF4FB", border: "#B3D4EE", icon: "💧", label: "Water"},
  waste: { color: "#2A7A4B", bg: "#E8F5EE", border: "#9DD0B3", icon: "🗑", label: "Waste"},
};

function TrendIcon({ trend }) {
  if (trend === "increasing") return <TrendingUp sx={{ fontSize: 15, color: "#DC2626" }} />;
  if (trend === "decreasing") return <TrendingDown sx={{ fontSize: 15, color: "#1A7A4B" }} />;
  return <TrendingFlat sx={{ fontSize: 15, color: "#7A6F62" }} />;
}

export default function Goals() {
  const [goals,   setGoals]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ title: "", category: "", target: "", unit: "", description: "" });
  const [suggestedTarget, setSuggestedTarget] = useState(null);
  const [forecasts, setForecasts] = useState({});

  useEffect(() => { fetchGoals(); loadForecasts(); }, []);

  // Load a trend forecast for every category up front, so each goal card can
  // show "on track" / "projected to exceed" without a per-card round trip.
  const loadForecasts = async () => {
    const results = {};
    await Promise.all(["water", "electricity", "waste"].map(async (category) => {
      try {
        const { data } = await API.get(`/insights/forecast?category=${category}&periods=3`);
        results[category] = data;
      } catch {
        results[category] = null;
      }
    }));
    setForecasts(results);
  };

  const fetchGoals = async () => {
    try { const { data } = await API.get("/goals"); setGoals(data); }
    catch (e) { console.error(e); }
  };

  const handleChange = e => {
    const { name, value } = e.target;
    let unit = form.unit;
    if (name === "category") {
      if (value === "electricity") unit = "kWh";
      if (value === "water")       unit = "L";
      if (value === "waste")       unit = "kg";
      fetchSuggestedTarget(value);
    }
    setForm({ ...form, [name]: value, unit });
  };

  // AI-assisted goal setting: use the forecasted monthly trend, annualize it,
  // and suggest a 10% reduction as a realistic target.
  const fetchSuggestedTarget = async (category) => {
    setSuggestedTarget(null);
    if (!category) return;
    try {
      const { data } = await API.get(`/insights/forecast?category=${category}`);
      if (data?.forecastNextMonth) {
        setSuggestedTarget(Math.round(data.forecastNextMonth * 12 * 0.9));
      }
    } catch {
      // not enough data yet — silently skip the suggestion
    }
  };

  const applySuggestedTarget = () => {
    if (suggestedTarget !== null) setForm({ ...form, target: String(suggestedTarget) });
  };

  const handleSubmit = async e => {
    e.preventDefault(); setError(""); setSuccess(""); setLoading(true);
    try {
      await API.post("/goals", { ...form, target: Number(form.target) });
      setSuccess("Goal added successfully.");
      setForm({ title: "", category: "", target: "", unit: "", description: "" });
      setSuggestedTarget(null);
      fetchGoals();
      loadForecasts();
    } catch (err) { setError(err.response?.data?.message || "Only admins can set goals."); }
    finally { setLoading(false); }
  };

  const handleDelete = async id => {
    try { await API.delete(`/goals/${id}`); fetchGoals(); loadForecasts(); }
    catch { setError("Delete failed."); }
  };

  return (
    <div className="eco-page">
      <div className="eco-fade">
        <div className="eco-page-eyebrow">🎯 Goals</div>
        <h1 className="eco-page-title">Sustainability Goals</h1>
        <p className="eco-page-sub">Define and track resource reduction targets for your institution</p>
      </div>

      {/* Add goal form */}
      <div className="eco-card eco-fade" style={{ marginBottom: 28 }}>
        <div className="eco-card-title"><div className="eco-card-dot" />Add New Goal</div>
        <Collapse in={!!error}><Alert severity="error" sx={{ mb: 2 }}>{error}</Alert></Collapse>
        <Collapse in={!!success}><Alert severity="success" sx={{ mb: 2 }}>{success}</Alert></Collapse>
        <form onSubmit={handleSubmit} noValidate>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField fullWidth label="Goal Title" name="title" value={form.title} onChange={handleChange} required size="small" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField select fullWidth label="Category" name="category" value={form.category} onChange={handleChange} required size="small">
                <MenuItem value="electricity">⚡ Electricity</MenuItem>
                <MenuItem value="water">💧 Water</MenuItem>
                <MenuItem value="waste">🗑 Waste</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField fullWidth label="Target" name="target" type="number" value={form.target} onChange={handleChange} required size="small" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField fullWidth label="Unit (auto)" name="unit" value={form.unit} disabled size="small"
                sx={{ "& .MuiInputBase-input.Mui-disabled": { WebkitTextFillColor: "#A09080" } }} />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField fullWidth label="Year (optional)" name="description" value={form.description} onChange={handleChange} size="small" placeholder="e.g. 2026" />
            </Grid>
          </Grid>

          <Collapse in={suggestedTarget !== null}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 10,
                background: "#E8F5EE",
                border: "1px solid #9DD0B3",
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 18,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AutoAwesome sx={{ fontSize: 18, color: "#1A5230" }} />
                <span style={{ fontSize: "0.82rem", color: "#1A5230" }}>
                  <strong>AI suggestion:</strong> based on your recent trend, a realistic target is{" "}
                  <strong>{suggestedTarget?.toLocaleString()}{form.unit ? ` ${form.unit}` : ""}</strong>{" "}
                  (10% below projected annual usage).
                </span>
              </div>
              <Button
                size="small"
                variant="contained"
                onClick={applySuggestedTarget}
                sx={{ textTransform: "none", bgcolor: "#1A5230", "&:hover": { bgcolor: "#123B22" }, fontSize: "0.76rem", boxShadow: "none" }}
              >
                Use this target
              </Button>
            </div>
          </Collapse>

          <button type="submit" className="eco-btn-primary" disabled={loading}>
            {loading ? <CircularProgress size={16} sx={{ color: "#F5F0E8" }} /> : <><AddCircleOutline sx={{ fontSize: "1rem" }} /> Add Goal</>}
          </button>
        </form>
      </div>

      {/* Goals list */}
      <div className="eco-section-label eco-fade">
        Active Goals <span className="eco-section-count">{goals.length}</span>
      </div>

      {goals.length === 0 ? (
        <div className="eco-empty eco-fade">
          <div className="eco-empty-icon">🎯</div>
          <div className="eco-empty-text">No goals yet. Add your first sustainability target above.</div>
        </div>
      ) : (
        <Grid container spacing={2.5}>
          {goals.map(g => {
            const c = CAT_RAW[g.category] || { color: "#6E4E2B", bg: "#F5EDE4", border: "#C8A07A", icon: "📌", label: g.category };
            const f = forecasts[g.category];

            const currentUsage = g.currentUsage || 0;
            const percentUsed = g.target > 0 ? Math.min(100, (currentUsage / g.target) * 100) : 0;
            const progressColor = percentUsed >= 100 ? "#DC2626" : percentUsed >= 80 ? "#C9A84C" : c.color;

            const firstCrossing = f?.forecastSeries?.find(s => s.overThreshold);

            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={g._id}>
                <div className="goal-card eco-fade" style={{ "--c-color": c.color }}>
                  <div className="goal-card-foot" style={{ marginBottom: 10, marginTop: 0, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <Chip label={`${c.icon} ${c.label}`} size="small" sx={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: "0.72rem" }} />

                    {f && (
                      firstCrossing ? (
                        <Chip
                          icon={<WarningAmberOutlined sx={{ fontSize: "14px !important" }} />}
                          label={`Exceeds in ${firstCrossing.monthsAhead}mo`}
                          size="small"
                          sx={{ bgcolor: "#FDECEC", color: "#DC2626", border: "1px solid #F5B5B5", fontWeight: 700, fontSize: "0.66rem" }}
                        />
                      ) : (
                        <Chip
                          icon={<CheckCircleOutline sx={{ fontSize: "14px !important" }} />}
                          label="On track"
                          size="small"
                          sx={{ bgcolor: "#E8F5EE", color: "#1A7A4B", border: "1px solid #9DD0B3", fontWeight: 700, fontSize: "0.66rem" }}
                        />
                      )
                    )}
                  </div>

                  <div className="goal-card-title">{g.title}</div>
                  <div>
                    <span className="goal-card-value">{g.target?.toLocaleString()}</span>
                    <span className="goal-card-unit">{g.unit}</span>
                  </div>
                  <div className="goal-card-label">Annual target</div>

                  {/* Usage-to-date progress */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#7A6F62", marginBottom: 4 }}>
                      <span>{currentUsage.toLocaleString()} {g.unit} used</span>
                      <span style={{ fontWeight: 700, color: progressColor }}>{percentUsed.toFixed(0)}%</span>
                    </div>
                    <LinearProgress
                      variant="determinate"
                      value={percentUsed}
                      sx={{
                        height: 7,
                        borderRadius: 4,
                        bgcolor: "#F0EDE7",
                        "& .MuiLinearProgress-bar": { bgcolor: progressColor, borderRadius: 4 },
                      }}
                    />
                  </div>

                  {/* Forecast trend reference, pulled from the Insights forecast for this category */}
                  {f && (
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 5, fontSize: "0.72rem", color: "#7A6F62" }}>
                      <TrendIcon trend={f.trend} />
                      {firstCrossing
                        ? <span>At current trend, projected <strong style={{ color: "#DC2626" }}>{firstCrossing.predicted.toLocaleString()}</strong> {g.unit}/mo by month {firstCrossing.monthsAhead}</span>
                        : <span>At current trend, usage is expected to stay within this target</span>}
                    </div>
                  )}

                  <button className="eco-btn-danger" style={{ marginTop: 14 }} onClick={() => handleDelete(g._id)}>
                    <DeleteOutline sx={{ fontSize: "0.88rem" }} /> Delete
                  </button>
                </div>
              </Grid>
            );
          })}
        </Grid>
      )}
    </div>
  );
}