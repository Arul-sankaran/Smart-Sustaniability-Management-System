require("dotenv").config();

const express = require("express");
const { PushSubscription } = require("../models/model.js");
const { protect, authorize } = require("../middleware/authMiddleware");
const { getAllAlerts } = require("../utils/alertCheck.js");
const { sendDailyDigest } = require("../utils/notify.js");

const router = express.Router();

// GET /api/notifications/vapid-public-key
// The client needs this to subscribe to push notifications. Public by
// design — a VAPID public key is not a secret (it's sent to the push
// service on every subscription, same idea as a public crypto key).
router.get("/vapid-public-key", protect, (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ message: "Push notifications are not configured on this server yet." });
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/notifications/subscribe   { subscription }
// Saves (or updates) this browser/device's push subscription for the logged-in user.
router.post("/subscribe", protect, authorize("admin", "staff"), async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ message: "Invalid push subscription payload" });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        user: req.user.id,
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ message: "Subscribed to push notifications" });
  } catch (error) {
    console.error("Push subscribe error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/notifications/unsubscribe   { endpoint }
router.post("/unsubscribe", protect, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ message: "endpoint is required" });

    await PushSubscription.deleteOne({ endpoint, user: req.user.id });
    res.json({ message: "Unsubscribed" });
  } catch (error) {
    console.error("Push unsubscribe error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/notifications/test-digest
// Admin-only: manually fire today's digest on demand, to verify email +
// push are wired up correctly without waiting for the scheduled run.
router.post("/test-digest", protect, authorize("admin"), async (req, res) => {
  try {
    const alerts = await getAllAlerts();
    await sendDailyDigest(alerts);
    res.json({ message: `Digest sent for ${alerts.length} alert(s).`, alerts });
  } catch (error) {
    console.error("Test digest error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
