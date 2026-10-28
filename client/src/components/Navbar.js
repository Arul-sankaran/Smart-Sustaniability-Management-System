import { useContext, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { Box, Typography, Avatar, Drawer, List, Divider, IconButton } from "@mui/material";
import MenuIcon   from "@mui/icons-material/Menu";
import CloseIcon  from "@mui/icons-material/Close";
import LogoutIcon from "@mui/icons-material/Logout";
import DashboardOutlinedIcon    from "@mui/icons-material/DashboardOutlined";
import EditNoteIcon             from "@mui/icons-material/EditNote";
import TrackChangesIcon         from "@mui/icons-material/TrackChanges";
import EmojiObjectsOutlinedIcon from "@mui/icons-material/EmojiObjectsOutlined";
import PeopleAltOutlinedIcon    from "@mui/icons-material/PeopleAltOutlined";
import AutoAwesomeOutlinedIcon  from "@mui/icons-material/AutoAwesomeOutlined";
import NotificationBell from "./NotificationBell";
import "../index.css";

const ROLE_STYLE = {
  admin:   { color:"#0D2818", bg:"#E4F0E9", border:"#9DD0B3", label:"Admin"   },
  staff:   { color:"#2E7EB8", bg:"#EBF4FB", border:"#B3D4EE", label:"Staff"   },
  student: { color:"#2A7A4B", bg:"#E8F5EE", border:"#9DD0B3", label:"Student" },
};

const ALL_LINKS = [
  { label:"Dashboard", path:"/dashboard", icon:<DashboardOutlinedIcon    sx={{fontSize:17}}/>, roles:["admin","staff","student"] },
  { label:"Data Entry", path:"/dataentry", icon:<EditNoteIcon             sx={{fontSize:17}}/>, roles:["admin","staff"] },
  { label:"Goals",      path:"/goals",     icon:<TrackChangesIcon         sx={{fontSize:17}}/>, roles:["admin","staff"] },
  { label:"Ideas",      path:"/ideas",     icon:<EmojiObjectsOutlinedIcon sx={{fontSize:17}}/>, roles:["admin","staff","student"] },
  { label:"Insights",   path:"/insights",  icon:<AutoAwesomeOutlinedIcon  sx={{fontSize:17}}/>, roles:["admin","staff","student"] },
  { label:"Users",      path:"/users",     icon:<PeopleAltOutlinedIcon    sx={{fontSize:17}}/>, roles:["admin"] },
];

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);

  if (!user) return null;

  const links = ALL_LINKS.filter(l => l.roles.includes(user.role));
  const rs = ROLE_STYLE[user.role] || ROLE_STYLE.student;
  const isActive = path => location.pathname === path;
  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <>
      <nav className="eco-nav">
        {/* Logo */}
        <Link to="/dashboard" className="eco-nav-logo">
          <div className="eco-nav-logo-mark">🌿</div>
          <div>
            <div className="eco-nav-logo-name">EcoMetric</div>
            <div className="eco-nav-logo-sub">Sustainability OS</div>
          </div>
        </Link>

        {/* Desktop links */}
        <div className="eco-nav-links">
          {links.map(l => (
            <Link key={l.path} to={l.path}
              className={`eco-nav-link${isActive(l.path) ? " active" : ""}`}>
              {l.icon}{l.label}
            </Link>
          ))}
        </div>

        {/* Right */}
        <div className="eco-nav-right">
          <NotificationBell />
          <div className="eco-user-block">
            <Avatar sx={{
              width:30, height:30, fontSize:"0.75rem", fontWeight:800,
              background:rs.bg, color:rs.color, border:`1.5px solid ${rs.border}`,
            }}>
              {user.name?.charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <div className="eco-user-name">{user.name}</div>
              <div className="eco-user-role" style={{color:rs.color}}>{rs.label}</div>
            </div>
          </div>
          <button className="eco-logout-btn" onClick={handleLogout}>
            <LogoutIcon sx={{fontSize:14}}/> Logout
          </button>
          <IconButton className="eco-hamburger-btn" onClick={() => setDrawer(true)}
            sx={{color:"#7A6F62"}} size="small">
            <MenuIcon/>
          </IconButton>
        </div>
      </nav>

      {/* Mobile drawer */}
      <Drawer anchor="right" open={drawer} onClose={() => setDrawer(false)}
        PaperProps={{sx:{width:270, background:"#fff", p:2}}}>
        <Box sx={{display:"flex", justifyContent:"space-between", alignItems:"center", mb:1.5}}>
          <Typography sx={{fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:"0.96rem", color:"#1C1A17"}}>
            Menu
          </Typography>
          <IconButton onClick={() => setDrawer(false)} size="small" sx={{color:"#7A6F62"}}>
            <CloseIcon fontSize="small"/>
          </IconButton>
        </Box>
        <Divider sx={{mb:1.5, borderColor:"#E2D9CC"}}/>
        <List disablePadding>
          {links.map(l => (
            <Link key={l.path} to={l.path} onClick={() => setDrawer(false)}
              className={`eco-drawer-link${isActive(l.path) ? " active" : ""}`}>
              <Box sx={{color: isActive(l.path) ? "#1A5230" : "#7A6F62", display:"flex"}}>
                {l.icon}
              </Box>
              {l.label}
            </Link>
          ))}
        </List>
        <Box sx={{mt:"auto", pt:2}}>
          <Divider sx={{mb:1.5, borderColor:"#E2D9CC"}}/>
          <Box sx={{display:"flex", alignItems:"center", gap:1.5, mb:2}}>
            <Avatar sx={{width:32, height:32, background:rs.bg, color:rs.color, fontSize:"0.77rem", fontWeight:800, border:`1.5px solid ${rs.border}`}}>
              {user.name?.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography sx={{fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:"0.83rem", color:"#1C1A17"}}>
                {user.name}
              </Typography>
              <Typography sx={{fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:"0.68rem", color:rs.color, fontWeight:700}}>
                {rs.label}
              </Typography>
            </Box>
          </Box>
          <button className="eco-logout-btn" onClick={handleLogout}
            style={{width:"100%", justifyContent:"center"}}>
            <LogoutIcon sx={{fontSize:14}}/> Sign Out
          </button>
        </Box>
      </Drawer>
    </>
  );
}