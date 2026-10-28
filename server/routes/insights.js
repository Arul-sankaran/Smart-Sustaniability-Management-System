require("dotenv").config();

const express = require("express");
const { Goal } = require("../models/model.js");
const { protect, authorize } = require("../middleware/authMiddleware");
const { forecastNext, forecastSeries } = require("../utils/forecast");
const { getAISuggestions } = require("../utils/aiSuggestions");
const { getMonthlyTotals, addMonths } = require("../utils/usageStats");
const { getAllAlerts } = require("../utils/alertCheck");

const router = express.Router();

const CATEGORIES = ["water", "electricity", "waste"];

// ─────────────────────────────────────────────
// GET /api/insights/forecast?category=water&months=6
// Access: all authenticated users
// ─────────────────────────────────────────────
router.get("/forecast", protect, async (req, res) => {
  try {
    const { category, months, periods } = req.query;

    if (!category || !CATEGORIES.includes(category)) {
      return res.status(400).json({ message: "Valid category is required (water, electricity, waste)" });
    }

    const periodsAhead = Math.min(Math.max(Number(periods) || 3, 1), 6); // clamp 1–6 months

    const monthly = await getMonthlyTotals(category, Number(months) || 6);
    const totals = monthly.map(m => m.total);

    const { predicted, slope, confidence } = forecastNext(totals, 1);
    const { series } = forecastSeries(totals, periodsAhead);

    // NOTE: goals are stored as an annual target, so we assume an even
    // monthly spread (target / 12) as the comparison threshold.
    const goal = await Goal.findOne({ category }).sort({ createdAt: -1 });
    const monthlyThreshold = goal ? +(goal.target / 12).toFixed(2) : null;
    const willCrossThreshold = monthlyThreshold !== null && predicted > monthlyThreshold;

    // Label projected months relative to the last month we actually have data
    // for — falls back to today's calendar month only if there's no history at all.
    let baseYear, baseMonth;
    if (monthly.length) {
      baseYear = monthly[monthly.length - 1].year;
      baseMonth = monthly[monthly.length - 1].month;
    } else {
      const now = new Date();
      baseYear = now.getFullYear();
      baseMonth = now.getMonth() + 1;
    }

    const forecastSeriesLabeled = series.map(s => ({
      ...s,
      ...addMonths(baseYear, baseMonth, s.monthsAhead),
      overThreshold: monthlyThreshold !== null && s.predicted > monthlyThreshold,
    }));

    res.json({
      category,
      history: monthly,
      forecastNextMonth: predicted,
      forecastSeries: forecastSeriesLabeled,
      trend: slope > 0 ? "increasing" : slope < 0 ? "decreasing" : "stable",
      trendMagnitude: Math.abs(slope),
      confidence,
      goal: goal ? { target: goal.target, unit: goal.unit, monthlyThreshold } : null,
      willCrossThreshold,
    });
  } catch (error) {
    console.error("Forecast error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// GET /api/insights/alerts
// Access: admin only — categories that have already exceeded their goal,
// or are projected to cross it within the next 3 months.
// ─────────────────────────────────────────────
router.get("/alerts", protect, authorize("admin"), async (req, res) => {
  try {
    const alerts = await getAllAlerts();
    res.json({ alerts, count: alerts.length });
  } catch (error) {
    console.error("Alerts error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// POST /api/insights/suggestions   { category }
// Access: all authenticated users
// ─────────────────────────────────────────────
router.post("/suggestions", protect, async (req, res) => {
  try {
    const { category } = req.body;

    if (!category || !CATEGORIES.includes(category)) {
      return res.status(400).json({ message: "Valid category is required (water, electricity, waste)" });
    }

    const monthly = await getMonthlyTotals(category, 6);
    const totals = monthly.map(m => m.total);
    const { predicted, slope } = forecastNext(totals, 1);
    const goal = await Goal.findOne({ category }).sort({ createdAt: -1 });

    const suggestions = await getAISuggestions({
      category,
      monthlyHistory: monthly,
      forecastNextMonth: predicted,
      trend: slope > 0 ? "increasing" : slope < 0 ? "decreasing" : "stable",
      goal: goal ? { target: goal.target, unit: goal.unit } : null,
    });

    res.json({ category, suggestions });
  } catch (error) {
    console.error("Suggestions error:", error.message);
    res.status(500).json({ message: "Failed to generate suggestions" });
  }
});

module.exports = router;
