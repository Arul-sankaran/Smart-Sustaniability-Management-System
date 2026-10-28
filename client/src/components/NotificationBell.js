import { useEffect, useState, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { IconButton, Badge, Menu, MenuItem, Typography, Box, Divider, Switch, CircularProgress } from "@mui/material";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { AuthContext } from "../context/AuthContext";
import API from "../services/api";
import { enablePushNotifications, disablePushNotifications, isPushEnabled, isPushSupported } from "../utils/pushNotifications";

const CAT_LABEL = { water: "💧 Water", electricity: "⚡ Electricity", waste: "🗑 Waste" };
const POLL_MS = 3 * 60 * 1000; // re-check every 3 minutes

export default function NotificationBell() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");

  const isAdmin = user?.role === "admin";
  const isStaff = user?.role === "staff";
  const canReceiveAlerts = isAdmin || isStaff; // matches notify.js's recipient list

  const loadAlerts = useCallback(async () => {
    if (!isAdmin) return; // /insights/alerts is admin-only
    try {
      const { data } = await API.get("/insights/alerts");
      setAlerts(data.alerts || []);
    } catch {
      // silent — passive background check
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!canReceiveAlerts) return;
    loadAlerts();
    const interval = setInterval(loadAlerts, POLL_MS);
    return () => clearInterval(interval);
  }, [canReceiveAlerts, loadAlerts]);

  useEffect(() => {
    if (!canReceiveAlerts) return;
    isPushEnabled().then(setPushEnabled).catch(() => {});
  }, [canReceiveAlerts]);

  if (!canReceiveAlerts) return null;

  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const goToInsights = () => { handleClose(); navigate("/insights"); };

  const togglePush = async () => {
    setPushBusy(true);
    setPushError("");
    try {
      if (pushEnabled) {
        await disablePushNotifications();
        setPushEnabled(false);
      } else {
        await enablePushNotifications();
        setPushEnabled(true);
      }
    } catch (e) {
      setPushError(e.message || "Something went wrong.");
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <>
      <IconButton onClick={handleOpen} size="small" sx={{ color: "#7A6F62" }}>
        <Badge badgeContent={isAdmin ? alerts.length : 0} color="error" max={9}>
          <NotificationsOutlinedIcon sx={{ fontSize: 21 }} />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { width: 330, maxHeight: 460, mt: 1 } }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: "0.86rem", color: "#1C1A17" }}>
            Notifications
          </Typography>
        </Box>
        <Divider />

        {/* Alert list — admin only, since /insights/alerts is restricted to admins */}
        {isAdmin && (
          alerts.length === 0 ? (
            <Box sx={{ px: 2, py: 2.5, textAlign: "center" }}>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.78rem", color: "#A09080" }}>
                No threshold alerts right now.
              </Typography>
            </Box>
          ) : (
            alerts.map((a, i) => (
              <MenuItem key={i} onClick={goToInsights} sx={{ whiteSpace: "normal", alignItems: "flex-start", py: 1.1, borderBottom: "1px solid #F0EDE7" }}>
                <WarningAmberIcon sx={{ fontSize: 17, color: a.status === "already_over" ? "#DC2626" : "#C9A84C", mr: 1, mt: "2px" }} />
                <Box>
                  <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: "0.78rem", color: "#1C1A17" }}>
                    {CAT_LABEL[a.category] || a.category}
                  </Typography>
                  <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.72rem", color: "#7A6F62", lineHeight: 1.35 }}>
                    {a.status === "already_over"
                      ? `Already over annual target (+${a.overBy?.toLocaleString?.() ?? a.overBy})`
                      : `Trend projects crossing target in ${a.crossesInMonths} month${a.crossesInMonths > 1 ? "s" : ""} (+${a.overBy})`}
                  </Typography>
                </Box>
              </MenuItem>
            ))
          )
        )}

        {isAdmin && alerts.length > 0 && (
          <Box sx={{ px: 2, py: 1, textAlign: "center" }}>
            <Typography
              onClick={goToInsights}
              sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.74rem", fontWeight: 700, color: "#1A5230", cursor: "pointer" }}
            >
              View full Insights →
            </Typography>
          </Box>
        )}

        {!isAdmin && (
          <Box sx={{ px: 2, py: 2, textAlign: "center" }}>
            <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.76rem", color: "#7A6F62" }}>
              You'll get an email and a push notification here if any resource goes over its target.
            </Typography>
          </Box>
        )}

        <Divider />

        {/* Push toggle — available to admin and staff alike */}
        <Box sx={{ px: 2, py: 1.4 }}>
          {!isPushSupported() ? (
            <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.72rem", color: "#A09080" }}>
              Push notifications aren't supported in this browser.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.78rem", fontWeight: 600, color: "#1C1A17" }}>
                Push alerts on this device
              </Typography>
              {pushBusy ? (
                <CircularProgress size={18} />
              ) : (
                <Switch checked={pushEnabled} onChange={togglePush} size="small" />
              )}
            </Box>
          )}
          {pushError && (
            <Typography sx={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "0.7rem", color: "#DC2626", mt: 0.5 }}>
              {pushError}
            </Typography>
          )}
        </Box>
      </Menu>
    </>
  );
}
