import { useState, useEffect } from "react";
import {
  TextField, Grid, CircularProgress, Alert, Collapse, Box, MenuItem,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Paper, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Tooltip, InputAdornment
} from "@mui/material";
import { CheckCircleOutline, EditOutlined, DeleteOutline, Close, Search, FilterList, AddCircleOutline } from "@mui/icons-material";
import API from "../services/api";
import { checkGoalUsageThresholds } from "../utils/sendNotificationEmail";
import "../index.css";

const CATS = [
  { value: "electricity", label: "Electricity", icon: "⚡", unit: "kWh", color: "#C9A84C", bg: "#FDF6E3", border: "#E8D498" },
  { value: "water",       label: "Water",       icon: "💧", unit: "L",   color: "#2E7EB8", bg: "#EBF4FB", border: "#B3D4EE" },
  { value: "waste",       label: "Waste",       icon: "🗑", unit: "kg",  color: "#2A7A4B", bg: "#E8F5EE", border: "#9DD0B3" },
];
const catMap = Object.fromEntries(CATS.map(c => [c.value, c]));
const LOCATIONS = ["AS Block", "IB Block", "SF Block", "Mechanical Block", "Boys Hostel", "Girls Hostel"];
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtAmt  = (val, unit) => `${Number(val).toLocaleString()} ${unit}`;

/* MUI table tokens */
const TH = { fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: ".07em", color: "#4A5040", background: "#F5F1EB", borderBottom: "1px solid #E2D9CC", py: 1.5, px: 2 };
const TD = { fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.85rem", color: "#1C1A17", borderBottom: "1px solid #F0ECE6", py: 1.3, px: 2 };
const PAPER_SX = { border: "1px solid #E2D9CC", borderRadius: "14px", overflow: "hidden", mb: 4, boxShadow: "0 4px 18px rgba(13,40,24,0.07)" };
const PAGINATION_SX = { borderTop: "1px solid #E2D9CC", background: "#FDFCFA", "& .MuiTablePagination-toolbar,& .MuiTablePagination-selectLabel,& .MuiTablePagination-displayedRows,& .MuiSelect-select": { fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.82rem", color: "#7A6F62" } };

const CatChip = ({ value }) => {
  const c = catMap[value];
  if (!c) return <span style={{ color: "#A09080", fontSize: "0.82rem" }}>—</span>;
  return <Chip label={`${c.icon} ${c.label}`} size="small" sx={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: "0.69rem" }} />;
};

export default function Dataentry() {
  const [form,        setForm]        = useState({ category: "", location: "", amount: "", unit: "", usageDate: "" });
  const [loading,     setLoading]     = useState(false);
  const [formError,   setFormError]   = useState("");
  const [success,     setSuccess]     = useState(false);
  const [records,     setRecords]     = useState([]);
  const [fetching,    setFetching]    = useState(false);
  const [page,        setPage]        = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterCat,   setFilterCat]   = useState("");
  const [filterQ,     setFilterQ]     = useState("");
  const [editOpen,    setEditOpen]    = useState(false);
  const [editRec,     setEditRec]     = useState(null);
  const [editForm,    setEditForm]    = useState({ category: "", location: "", amount: "", unit: "", usageDate: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError,   setEditError]   = useState("");
  const [delOpen,     setDelOpen]     = useState(false);
  const [delRec,      setDelRec]      = useState(null);
  const [delLoading,  setDelLoading]  = useState(false);

  useEffect(() => { fetchRecords(); }, []);

  const fetchRecords = async () => {
    setFetching(true);
    try { const { data } = await API.get("/usage/all"); setRecords(Array.isArray(data) ? data : []); }
    catch (e) { console.error(e); setRecords([]); }
    finally { setFetching(false); }
  };

  const refreshThresholdEmails = () => {
    API.get("/goals")
      .then(({ data }) => checkGoalUsageThresholds(data))
      .catch(error => console.error("Unable to check usage goal thresholds:", error));
  };

  const handleChange = e => {
    const { name, value } = e.target;
    const unit = name === "category" ? catMap[value]?.unit || "" : form.unit;
    setForm(f => ({ ...f, [name]: value, unit }));
    setSuccess(false);
  };

  const handleSubmit = async e => {
    e.preventDefault(); setFormError(""); setLoading(true);
    try {
      await API.post("/usage", { ...form, amount: Number(form.amount) });
      refreshThresholdEmails();
      setSuccess(true);
      setForm({ category: "", location: "", amount: "", unit: "", usageDate: "" });
      fetchRecords();
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) { setFormError(err.response?.data?.message || "Error adding usage."); }
    finally { setLoading(false); }
  };

  const openEdit = rec => {
    setEditRec(rec);
    setEditForm({ category: rec.category, location: rec.location || "", amount: rec.amount, unit: rec.unit || catMap[rec.category]?.unit || "", usageDate: rec.usageDate ? rec.usageDate.slice(0, 10) : "" });
    setEditError(""); setEditOpen(true);
  };
  const handleEditChange = e => {
    const { name, value } = e.target;
    const unit = name === "category" ? catMap[value]?.unit || "" : editForm.unit;
    setEditForm(f => ({ ...f, [name]: value, unit }));
  };
  const handleEditSave = async () => {
    setEditError(""); setEditLoading(true);
    try { await API.put(`/usage/${editRec._id}`, { ...editForm, amount: Number(editForm.amount) }); setEditOpen(false); fetchRecords(); refreshThresholdEmails(); }
    catch (err) { setEditError(err.response?.data?.message || "Update failed."); }
    finally { setEditLoading(false); }
  };

  const openDelete = rec => { setDelRec(rec); setDelOpen(true); };
  const handleDelete = async () => {
    setDelLoading(true);
    try { await API.delete(`/usage/${delRec._id}`); setDelOpen(false); fetchRecords(); }
    catch {} finally { setDelLoading(false); }
  };

  const filtered = records.filter(r => {
    const matchCat = !filterCat || r.category === filterCat;
    const q = filterQ.toLowerCase();
    const matchQ = !q || r.category?.includes(q) || r.location?.toLowerCase().includes(q) || String(r.amount).includes(q) || r.submittedBy?.toLowerCase().includes(q) || fmtDate(r.usageDate).toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const hasFilter = !!filterCat || !!filterQ;
  const selCat    = catMap[form.category];
  const canSubmit = !!form.category && !!form.location;

  return (
    <div className="eco-page">
      <div className="eco-fade">
        <div className="eco-page-eyebrow">📊 Data Entry</div>
        <h1 className="eco-page-title">Resource Usage</h1>
        <p className="eco-page-sub">Record and manage water, electricity and waste data</p>
      </div>

      {/* ── Submission form ── */}
      <div className="eco-submit-card eco-fade">
        <div className="eco-submit-header">
          <AddCircleOutline sx={{ fontSize: "0.9rem", color: "#1A5230" }} />
          <span className="eco-submit-label">Add Resource Usage</span>
          <div className="eco-submit-stats">
            {CATS.map(c => {
              const total = records.filter(r => r.category === c.value).reduce((s, r) => s + Number(r.amount), 0);
              return (
                <div key={c.value}>
                  <div className="de-stat-val" style={{ color: c.color }}>{total.toLocaleString()}</div>
                  <div className="de-stat-lbl">{c.icon} {c.unit}</div>
                </div>
              );
            })}
          </div>
        </div>

        <Collapse in={!!formError}>
          <Alert severity="error" sx={{ mb: 2, borderRadius: "9px" }}>{formError}</Alert>
        </Collapse>

        <form onSubmit={handleSubmit} noValidate>
          <Grid container spacing={1.5} alignItems="flex-start">
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField select fullWidth label="Category" name="category" value={form.category} onChange={handleChange} required size="small">
                {CATS.map(c => <MenuItem key={c.value} value={c.value} sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.84rem" }}>{c.icon} {c.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField select fullWidth label="Location" name="location" value={form.location} onChange={handleChange} required size="small">
                {LOCATIONS.map(l => <MenuItem key={l} value={l} sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.84rem" }}>{l}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField fullWidth label="Amount" name="amount" type="number" value={form.amount} onChange={handleChange} required size="small" placeholder="Enter quantity"
                InputProps={{ endAdornment: form.unit ? <Box component="span" sx={{ fontSize: "0.8rem", color: "#A09080", pr: 0.5, whiteSpace: "nowrap" }}>{form.unit}</Box> : null }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField fullWidth label="Unit (auto)" name="unit" value={form.unit} disabled size="small"
                sx={{ "& .MuiInputBase-input.Mui-disabled": { WebkitTextFillColor: "#A09080" } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField fullWidth type="date" name="usageDate" label="Usage Date" value={form.usageDate} onChange={handleChange} required size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <button type="submit" disabled={loading || !canSubmit} className="eco-form-submit-btn"
                style={{ background: !canSubmit ? "#E2D9CC" : undefined, color: !canSubmit ? "#A09080" : undefined, boxShadow: !canSubmit ? "none" : undefined, cursor: !canSubmit ? "not-allowed" : "pointer" }}>
                {loading ? <CircularProgress size={15} sx={{ color: "#F5F0E8" }} /> : <><CheckCircleOutline sx={{ fontSize: "0.9rem" }} /> Submit Entry</>}
              </button>
            </Grid>
          </Grid>
        </form>

        {form.category && form.amount && form.usageDate && (
          <div className="eco-preview-strip">
            {[
              { lbl: "Category", val: `${selCat?.icon} ${selCat?.label}`, color: selCat?.color },
              { lbl: "Location", val: form.location || "—" },
              { lbl: "Amount",   val: `${form.amount} ${form.unit}` },
              { lbl: "Date",     val: form.usageDate },
            ].map(item => (
              <div key={item.lbl}>
                <div className="eco-preview-lbl">{item.lbl}</div>
                <div className="eco-preview-val" style={{ color: item.color || undefined }}>{item.val}</div>
              </div>
            ))}
          </div>
        )}

        {success && (
          <div className="eco-success-strip">
            <CheckCircleOutline sx={{ fontSize: "1rem" }} /> Usage data recorded successfully! 🌿
          </div>
        )}
      </div>

      {/* ── Filter bar ── */}
      <div className="eco-filter-card eco-fade">
        <div className="eco-filter-header">
          <FilterList sx={{ fontSize: "0.9rem", color: "#1A5230" }} />
          <span className="eco-filter-title">Filter &amp; Search</span>
          <span className="eco-filter-badge">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <Grid container spacing={1.5} alignItems="center">
          <Grid size={{ xs: 12, md: 5 }}>
            <TextField fullWidth placeholder="Search by category, location, amount, submitted by…" value={filterQ}
              onChange={e => { setFilterQ(e.target.value); setPage(0); }} size="small"
              InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: "0.9rem", color: "#A09080" }} /></InputAdornment> }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField select fullWidth label="Category" value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(0); }} size="small">
              <MenuItem value="" sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.84rem" }}>All Categories</MenuItem>
              {CATS.map(c => <MenuItem key={c.value} value={c.value} sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.84rem" }}>{c.icon} {c.label}</MenuItem>)}
            </TextField>
          </Grid>
          {hasFilter && (
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <button className="uc-clear-btn" onClick={() => { setFilterQ(""); setFilterCat(""); setPage(0); }}>✕ Clear filters</button>
            </Grid>
          )}
        </Grid>
      </div>

      {/* ── Table ── */}
      <div className="eco-section-label eco-fade" style={{ marginBottom: 12 }}>
        Usage Records <span className="eco-section-count">{filtered.length}</span>
      </div>

      <Paper sx={PAPER_SX} className="eco-fade">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {["#", "Category", "Location", "Value", "Usage Date", "Submitted By", "Actions"].map(h => (
                  <TableCell key={h} sx={TH}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {fetching ? (
                <TableRow><TableCell colSpan={7} sx={{ textAlign: "center", py: 5 }}><CircularProgress size={24} sx={{ color: "#1A5230" }} /></TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={7} sx={{ ...TD, textAlign: "center", py: 5, color: "#A09080" }}>{hasFilter ? "No records match your filters." : "No usage records yet. Add one above!"}</TableCell></TableRow>
              ) : paginated.map((rec, idx) => (
                <TableRow key={rec._id} sx={{ background: idx % 2 === 0 ? "#FAFAF8" : "#fff", "&:hover": { background: "#F0ECE6" }, transition: "background .12s" }}>
                  <TableCell sx={{ ...TD, color: "#A09080", fontSize: "0.78rem", width: 48 }}>{page * rowsPerPage + idx + 1}</TableCell>
                  <TableCell sx={TD}><CatChip value={rec.category} /></TableCell>
                  <TableCell sx={TD}>{rec.location || <span style={{ color: "#A09080" }}>—</span>}</TableCell>
                  <TableCell sx={{ ...TD, fontWeight: 700 }}>
                    <span className="de-amount">{Number(rec.amount).toLocaleString()}</span>
                    <span className="de-unit-label"> {rec.unit || catMap[rec.category]?.unit}</span>
                  </TableCell>
                  <TableCell sx={TD}>{fmtDate(rec.usageDate)}</TableCell>
                  <TableCell sx={TD}>
                    <div className="de-submitter-cell">
                      <div className="de-avatar">{rec.submittedBy?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?"}</div>
                      <span className="de-submitter-name">{rec.submittedBy || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell sx={TD}>
                    <Tooltip title="Edit">
                      <IconButton size="small" className="de-edit-btn" onClick={() => openEdit(rec)}><EditOutlined sx={{ fontSize: "0.9rem" }} /></IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" className="de-del-btn" onClick={() => openDelete(rec)}><DeleteOutline sx={{ fontSize: "0.9rem" }} /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={filtered.length} page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0); }}
          rowsPerPageOptions={[5, 10, 25, 50]} sx={PAGINATION_SX} />
      </Paper>

      {/* ── Edit dialog ── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "16px", p: 0.5 } }}>
        <DialogTitle sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: "1rem", color: "#1C1A17", pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Edit Usage Record
          <IconButton size="small" onClick={() => setEditOpen(false)} sx={{ color: "#7A6F62" }}><Close sx={{ fontSize: "1rem" }} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <Collapse in={!!editError}><Alert severity="error" sx={{ mb: 2, borderRadius: "9px" }}>{editError}</Alert></Collapse>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select fullWidth label="Category" name="category" value={editForm.category} onChange={handleEditChange} size="small">
                {CATS.map(c => <MenuItem key={c.value} value={c.value} sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.84rem" }}>{c.icon} {c.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select fullWidth label="Location" name="location" value={editForm.location} onChange={handleEditChange} required size="small">
                {LOCATIONS.map(l => <MenuItem key={l} value={l} sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.84rem" }}>{l}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Amount" name="amount" type="number" value={editForm.amount} onChange={handleEditChange} size="small"
                InputProps={{ endAdornment: editForm.unit ? <Box component="span" sx={{ fontSize: "0.8rem", color: "#A09080", pr: 0.5 }}>{editForm.unit}</Box> : null }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Unit" name="unit" value={editForm.unit} disabled size="small" sx={{ "& .MuiInputBase-input.Mui-disabled": { WebkitTextFillColor: "#A09080" } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth type="date" name="usageDate" label="Usage Date" value={editForm.usageDate} onChange={handleEditChange} size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <button onClick={() => setEditOpen(false)} className="de-dialog-cancel">Cancel</button>
          <button onClick={handleEditSave} disabled={editLoading} className="de-dialog-save">
            {editLoading ? <CircularProgress size={14} sx={{ color: "#F5F0E8" }} /> : "Save Changes"}
          </button>
        </DialogActions>
      </Dialog>

      {/* ── Delete dialog ── */}
      <Dialog open={delOpen} onClose={() => setDelOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "16px", p: 0.5 } }}>
        <DialogTitle sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: "1rem", color: "#1C1A17", pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Delete Record
          <IconButton size="small" onClick={() => setDelOpen(false)} sx={{ color: "#7A6F62" }}><Close sx={{ fontSize: "1rem" }} /></IconButton>
        </DialogTitle>
        <DialogContent>
          <div className="de-delete-box">
            Are you sure you want to delete this{" "}
            <strong style={{ color: "#1C1A17" }}>
              {delRec ? `${catMap[delRec.category]?.icon || ""} ${catMap[delRec.category]?.label || delRec.category}` : ""}{" "}
              record ({delRec ? fmtAmt(delRec.amount, delRec.unit || catMap[delRec.category]?.unit || "") : ""})
            </strong>
            ? This action cannot be undone.
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <button onClick={() => setDelOpen(false)} className="de-dialog-cancel">Cancel</button>
          <button onClick={handleDelete} disabled={delLoading} className="de-dialog-delete">
            {delLoading ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Delete"}
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
