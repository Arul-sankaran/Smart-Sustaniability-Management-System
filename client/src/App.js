import { useContext } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthContext } from "./context/AuthContext";
import Login           from "./pages/Login";
import Register        from "./pages/Register";
import Dashboard       from "./pages/Dashboard";
import Dataentry       from "./pages/Dataentry";
import Goals           from "./pages/Goals";
import Ideas           from "./pages/Ideas";
import Insights        from "./pages/Insights";
import User            from "./pages/User";
import Navbar          from "./components/Navbar";
import ProtectedRoutes from "./components/ProtectedRoutes";

/* Redirect already-logged-in users away from /login and /register */
function PublicRoute({ children }) {
  const { user } = useContext(AuthContext);
  return user ? <Navigate to="/dashboard" replace /> : children;
}

function App() {
  return (
    <Router>
      <div style={{ background:"#F8F9FC", minHeight:"100vh" }}>
        <Navbar />
        <Routes>
          {/* Public routes — redirect to dashboard if already logged in */}
          <Route path="/" element={
            <PublicRoute><Login /></PublicRoute>
          }/>
          <Route path="/login" element={
            <PublicRoute><Login /></PublicRoute>
          }/>
          <Route path="/register" element={
            <PublicRoute><Register /></PublicRoute>
          }/>

          {/* Protected routes */}
          <Route path="/dashboard" element={
            <ProtectedRoutes roles={["admin","staff","student"]}><Dashboard /></ProtectedRoutes>
          }/>
          <Route path="/dataentry" element={
            <ProtectedRoutes roles={["admin","staff"]}><Dataentry /></ProtectedRoutes>
          }/>
          <Route path="/goals" element={
            <ProtectedRoutes roles={["admin","staff"]}><Goals /></ProtectedRoutes>
          }/>
          <Route path="/ideas" element={
            <ProtectedRoutes roles={["admin","staff","student"]}><Ideas /></ProtectedRoutes>
          }/>
          <Route path="/insights" element={
            <ProtectedRoutes roles={["admin","staff","student"]}><Insights /></ProtectedRoutes>
          }/>
          <Route path="/users" element={
            <ProtectedRoutes roles={["admin"]}><User /></ProtectedRoutes>
          }/>

          {/* Fallback — any unknown path goes to dashboard (or login if not authed) */}
          <Route path="*" element={<Navigate to="/dashboard" replace />}/>
        </Routes>
      </div>
    </Router>
  );
}

export default App;