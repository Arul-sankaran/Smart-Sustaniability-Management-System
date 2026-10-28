import { useState, useContext } from "react";
import { CircularProgress, Alert, Collapse } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import API from "../services/api";
import "../index.css";

export default function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const { setUser } = useContext(AuthContext);
  const navigate    = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await API.post("/auth/login", { email, password });
      localStorage.setItem("user", JSON.stringify(res.data));
      setUser(res.data);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials. Please Enter Valid Email or Password.");
    } finally { setLoading(false); }
  };

  return (
    <div className="lg-root">
      <div className="lg-ring lg-ring-1" />
      <div className="lg-ring lg-ring-2" />
      <div className="lg-ring lg-ring-3" />

      <div className="lg-layout">
        {/* LEFT PANEL */}
        <div className="lg-left">
          <div className="lg-badge"><div className="lg-badge-dot" />Campus Platform</div>
          <h1 className="lg-headline">Track.<br/>Measure.<br/><span>Sustain.</span></h1>
          <p className="lg-desc">
            A unified sustainability intelligence platform for monitoring campus resource usage,
            environmental goals and waste reduction — in real time.
          </p>
        </div>

        {/* FLOATING CARD */}
        <div className="lg-card">
          <div className="lg-logo">
            <div className="lg-logo-mark">🌿</div>
            <div>
              <div className="lg-logo-name">EcoMetric</div>
              <div className="lg-logo-sub">Sustainability OS</div>
            </div>
          </div>
          <h2 className="lg-card-title">Welcome back</h2>
          <p className="lg-card-sub">Sign in to your sustainability dashboard</p>

          <Collapse in={!!error}>
            <Alert severity="error" sx={{mb:2.5}}>{error}</Alert>
          </Collapse>

          <form onSubmit={handleLogin} noValidate>
            <div className="fld-wrap">
              <label className="fld-lbl">Email address</label>
              <input className="fld-input" type="email" placeholder="you@campus.edu"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="fld-wrap">
              <label className="fld-lbl">Password</label>
              <div className="fld-pw">
                <input className="fld-input"
                  type={showPw ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" className="fld-eye"
                  onClick={() => setShowPw(p => !p)} tabIndex={-1}>
                  {showPw ? <VisibilityOff sx={{fontSize:18}}/> : <Visibility sx={{fontSize:18}}/>}
                </button>
              </div>
            </div>
            <button type="submit" className="eco-btn-primary full" style={{marginTop:18}} disabled={loading}>
              {loading ? <CircularProgress size={20} sx={{color:"#F5F0E8"}}/> : "Sign in →"}
            </button>
          </form>

          <div className="lg-divider">
            <div className="lg-div-line"/>
            <span className="lg-div-txt">New to EcoMetric?</span>
            <div className="lg-div-line"/>
          </div>
          <p className="lg-register">
            <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}