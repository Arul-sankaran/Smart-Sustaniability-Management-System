require("dotenv").config();

const express = require("express");
const { Usage, LOCATIONS } = require("../models/model.js");
const { protect, authorize } = require("../middleware/authMiddleware");
const { getCategoryAlert } = require("../utils/alertCheck.js");
const { notifyInstantAlert, clearAlertRecord } = require("../utils/notify.js");

const router = express.Router();

// ─────────────────────────────────────────────
// POST /api/usage — Add new usage record
// Access: admin, staff
// ─────────────────────────────────────────────
router.post("/", protect, authorize("admin", "staff"), async (req, res) => {
  try {
    const { category, location, amount, unit, usageDate, submittedBy } = req.body;

    if (!category || amount === undefined || !unit || !usageDate) {
      return res.status(400).json({ message: "All fields required" });
    }

    if (!location || !LOCATIONS.includes(location)) {
      return res.status(400).json({ message: `Location is required. Choose one of: ${LOCATIONS.join(", ")}` });
    }

    const usage = await Usage.create({
      category,
      location,
      amount,
      unit,
      // ── FIX 1: always store usageDate as a proper Date object ──
      usageDate: new Date(usageDate),
      // ── FIX 2: allow Postman/seed submittedBy, fallback to logged-in user ──
      submittedBy: submittedBy || req.user.name,
    });

    res.status(201).json(usage);

    // Fire-and-forget: check if this entry pushed the category over/near its
    // threshold and notify admins+staff if so. Runs after the response is
    // already sent so it never slows down the person entering data.
    checkAndNotify(category);
  } catch (error) {
    console.error("POST /usage error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// Checks a category's current alert status and notifies (or clears a
// stale notification record) accordingly. Never throws — a notification
// failure should never be visible to the person who just logged usage.
async function checkAndNotify(category) {
  try {
    const alert = await getCategoryAlert(category);
    if (alert) {
      await notifyInstantAlert(alert);
    } else {
      await clearAlertRecord(category);
    }
  } catch (error) {
    console.error("checkAndNotify error:", error.message);
  }
}

// ─────────────────────────────────────────────
// GET /api/usage/all — Get all usage records for table
// Access: admin, staff
// ─────────────────────────────────────────────
router.get("/all", protect, authorize("admin", "staff"), async (req, res) => {
  try {
    const records = await Usage.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// GET /api/usage/dashboard — Dashboard summary & monthly breakdown
// Access: all authenticated users
// ─────────────────────────────────────────────
router.get("/dashboard", protect, async (req, res) => {
  try {
    const { category, year, month } = req.query;

    let match = {};

    // Category filter
    if (category) {
      match.category = category;
    }

    // Date filter using usageDate
    if (year || month) {
      match.usageDate = {};

      if (year && !month) {
        match.usageDate.$gte = new Date(`${year}-01-01`);
        match.usageDate.$lte = new Date(`${year}-12-31T23:59:59`);
      }

      if (year && month) {
        const startDate = new Date(year, month - 1, 1);
        const endDate   = new Date(year, month, 0, 23, 59, 59);
        match.usageDate.$gte = startDate;
        match.usageDate.$lte = endDate;
      }
    }

    // ── SUMMARY ──
    const summary = await Usage.aggregate([
      { $match: match },
      {
        $group: {
          _id:   "$category",
          total: { $sum: "$amount" },
        },
      },
    ]);

    // ── MONTHLY ──
    const monthly = await Usage.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year:     { $year:  "$usageDate" },
            month:    { $month: "$usageDate" },
            category: "$category",
          },
          total: { $sum: "$amount" },
        },
      },
      {
        $sort: {
          "_id.year":  1,
          "_id.month": 1,
        },
      },
    ]);

    res.json({ summary, monthly });
  } catch (error) {
    console.error("Dashboard Error:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
});


// PUT /api/usage/:id — Edit a usage record
// Access: admin, staff
router.put("/:id", protect, authorize("admin", "staff"), async (req, res) => {
  try {
    const { category, location, amount, unit, usageDate } = req.body;

    if (!category || amount === undefined || !unit || !usageDate) {
      return res.status(400).json({ message: "All fields required" });
    }

    if (!location || !LOCATIONS.includes(location)) {
      return res.status(400).json({ message: `Location is required. Choose one of: ${LOCATIONS.join(", ")}` });
    }

    const updated = await Usage.findByIdAndUpdate(
      req.params.id,
      {
        category,
        location,
        amount,
        unit,
        // ── FIX 1: ensure Date object on edit too ──
        usageDate: new Date(usageDate),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Record not found" });
    }

    res.json(updated);
    checkAndNotify(category);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/usage/:id — Delete a usage record
// Access: admin, staff
router.delete("/:id", protect, authorize("admin", "staff"), async (req, res) => {
  try {
    const deleted = await Usage.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Record not found" });
    }

    res.json({ message: "Record deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
