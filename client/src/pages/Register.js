import { useState } from "react";
import { CircularProgress, Alert, Collapse } from "@mui/material";
import { Visibility, VisibilityOff, CheckCircle } from "@mui/icons-material";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import "../index.css";

export default function Register() {
  const [form,    setForm]    = useState({ name:"", email:"", password:"", confirm:"" });
  const [showPw,  setShowPw]  = useState(false);
  const [showCf,  setShowCf]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const set = f => e => setForm({ ...form, [f]: e.target.value });

  const strength = (() => {
    const p = form.password;
    if (!p) return 0;
    if (p.length < 6) return 1;
    if (p.length < 8) return 2;
    if (/[A-Z]/.test(p) && /[0-9]/.test(p)) return 4;
    return 3;
  })();
  const sColors = ["","#DC2626","#D97706","#2563EB","#1A5230"];
  const sLabels = ["","Too short","Weak","Good","Strong"];

  const handleSubmit = async e => {
    e.preventDefault(); setError("");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    if (form.password.length < 6)       return setError("Password must be at least 6 characters.");
    setLoading(true);
    try {
      await API.post("/auth/register", {
        name:form.name, email:form.email, password:form.password,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed.");
    } finally { setLoading(false); }
  };

  return (
    <div className="rg-root">
      {/* LEFT SIDE PANEL */}
      <div className="rg-side">
        <div className="rg-side-inner">
          <div className="rg-side-logo">
            <div className="rg-side-mark">🌿</div>
            <div>
              <div className="rg-side-name">EcoMetric</div>
              <div className="rg-side-sub">Sustainability OS</div>
            </div>
          </div>
          <h2 className="rg-side-heading">
            Join the<br/><span>Green Campus</span><br/>Initiative
          </h2>
          <p className="rg-side-desc">
            Create your account and start contributing to a more sustainable campus environment.
          </p>
          <div className="rg-steps">
            {[
              { n:"1", title:"Create your account", body:"Fill in your details on the right" },
              { n:"2", title:"Await admin approval", body:"Your account will be reviewed shortly" },
              { n:"3", title:"Access the dashboard", body:"Track metrics and submit ideas" },
            ].map(s => (
              <div key={s.n} className="rg-step">
                <div className="rg-step-num">{s.n}</div>
                <div className="rg-step-text"><strong>{s.title}</strong>{s.body}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rg-side-bottom">
          <div className="rg-side-note">
            <span className="rg-side-note-icon">🔒</span>
            Your data is secure and only accessible to approved campus members.
          </div>
        </div>
      </div>

      {/* RIGHT FORM AREA */}
      <div className="rg-right">
        <div className="rg-card">
          {success ? (
            <div className="success-wrap">
              <div className="success-ring">
                <CheckCircle sx={{color:"#C9A84C", fontSize:32}}/>
              </div>
              <h2 className="success-title">Account Created!</h2>
              <p className="success-desc">
                Your account is <strong>pending admin approval</strong>. You'll be able to sign in once it has been reviewed.
              </p>
              <button className="back-btn" onClick={() => navigate("/login")}>
                ← Back to Sign In
              </button>
            </div>
          ) : (
            <>
              <h2 className="rg-card-title">Create account</h2>
              <p className="rg-card-sub">Join the EcoMetric sustainability platform</p>

              <Collapse in={!!error}>
                <Alert severity="error" sx={{mb:2}}>{error}</Alert>
              </Collapse>

              <form onSubmit={handleSubmit} noValidate>
                <div className="fld-wrap">
                  <label className="fld-lbl">Full Name</label>
                  <input className="fld-input" type="text" placeholder="Your full name"
                    value={form.name} onChange={set("name")} required />
                </div>
                <div className="fld-wrap">
                  <label className="fld-lbl">Email Address</label>
                  <input className="fld-input" type="email" placeholder="you@campus.edu"
                    value={form.email} onChange={set("email")} required />
                </div>
                <div className="fld-wrap">
                  <label className="fld-lbl">Password</label>
                  <div className="fld-pw">
                    <input className="fld-input" type={showPw?"text":"password"}
                      placeholder="Min. 6 characters"
                      value={form.password} onChange={set("password")} required />
                    <button type="button" className="fld-eye"
                      onClick={() => setShowPw(p=>!p)} tabIndex={-1}>
                      {showPw ? <VisibilityOff sx={{fontSize:17}}/> : <Visibility sx={{fontSize:17}}/>}
                    </button>
                  </div>
                  {form.password && (
                    <>
                      <div className="pw-bars">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="pw-bar"
                            style={{background: i<=strength ? sColors[strength] : "#EAE3D8"}}/>
                        ))}
                      </div>
                      <div className="pw-label" style={{color:sColors[strength]}}>{sLabels[strength]}</div>
                    </>
                  )}
                </div>
                <div className="fld-wrap">
                  <label className="fld-lbl">Confirm Password</label>
                  <div className="fld-pw">
                    <input className="fld-input" type={showCf?"text":"password"}
                      placeholder="Re-enter password"
                      value={form.confirm} onChange={set("confirm")} required />
                    <button type="button" className="fld-eye"
                      onClick={() => setShowCf(p=>!p)} tabIndex={-1}>
                      {showCf ? <VisibilityOff sx={{fontSize:17}}/> : <Visibility sx={{fontSize:17}}/>}
                    </button>
                  </div>
                </div>
                <div className="eco-notice">
                  <span className="eco-notice-icon">ℹ</span>
                  <span className="eco-notice-text">
                    After registering, your account will be <strong>pending for admin approval</strong> before you can sign in.
                  </span>
                </div>
                <button type="submit" className="eco-btn-primary full" disabled={loading}>
                  {loading ? <CircularProgress size={20} sx={{color:"#F5F0E8"}}/> : "Create Account →"}
                </button>
              </form>
              <p className="rg-footer">Already have an account? <Link to="/login">Sign in</Link></p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}