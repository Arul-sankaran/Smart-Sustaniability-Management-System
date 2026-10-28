const { Goal } = require("../models/model.js");
const { getMonthlyTotals, getCurrentUsage } = require("./usageStats.js");
const { forecastSeries } = require("./forecast.js");

const CATEGORIES = ["water", "electricity", "waste"];

/**
 * Checks a single category against its most recent goal and returns an
 * alert object if it's already over target or projected to cross within
 * the next 3 months — or null if everything looks fine / there's no goal
 * or data to check against yet.
 */
async function getCategoryAlert(category) {
  const goal = await Goal.findOne({ category }).sort({ createdAt: -1 });
  if (!goal) return null;

  const currentUsage = await getCurrentUsage(category, goal.description);

  if (currentUsage > goal.target) {
    return {
      category,
      status: "already_over",
      currentUsage,
      target: goal.target,
      unit: goal.unit,
      overBy: +(currentUsage - goal.target).toFixed(2),
    };
  }

  const monthly = await getMonthlyTotals(category, 6);
  const totals = monthly.map(m => m.total);
  if (totals.length < 2) return null; // not enough data to trust a trend

  const monthlyThreshold = +(goal.target / 12).toFixed(2);
  const { series, slope, confidence } = forecastSeries(totals, 3);
  const firstCrossing = series.find(s => s.predicted > monthlyThreshold);
  if (!firstCrossing) return null;

  return {
    category,
    status: "projected",
    unit: goal.unit,
    monthlyThreshold,
    crossesInMonths: firstCrossing.monthsAhead,
    forecastAtCrossing: firstCrossing.predicted,
    overBy: +(firstCrossing.predicted - monthlyThreshold).toFixed(2),
    trend: slope > 0 ? "increasing" : "decreasing",
    confidence,
  };
}

/** Checks all three categories and returns the ones with an active alert, urgent first. */
async function getAllAlerts() {
  const results = await Promise.all(CATEGORIES.map(getCategoryAlert));
  const alerts = results.filter(Boolean);
  alerts.sort((a, b) => (a.status === "already_over" ? -1 : 1) - (b.status === "already_over" ? -1 : 1));
  return alerts;
}

module.exports = { getCategoryAlert, getAllAlerts, CATEGORIES };
