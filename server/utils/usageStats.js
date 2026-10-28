const { Usage } = require("../models/model.js");

/**
 * Monthly totals for a category, chronological order.
 * Pulls from ALL usage records (no calendar cutoff) and returns the most
 * recent `monthsBack` months that actually have data — this matches how
 * the Dashboard treats usage data, and avoids silently returning nothing
 * when records are older than a fixed lookback window.
 */
async function getMonthlyTotals(category, monthsBack = 6) {
  const rows = await Usage.aggregate([
    { $match: { category } },
    {
      $group: {
        _id: { year: { $year: "$usageDate" }, month: { $month: "$usageDate" } },
        total: { $sum: "$amount" },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  const mapped = rows.map(r => ({ year: r._id.year, month: r._id.month, total: r.total }));
  return mapped.slice(-monthsBack);
}

/** Given a base year/month, add N months (1 = the month after base, etc.) */
function addMonths(baseYear, baseMonth, n) {
  const d = new Date(baseYear, baseMonth - 1 + n, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * Usage recorded for a category, optionally scoped to a 4-digit year
 * (the goal's optional "Year" field). No year filter = all-time total,
 * matching the Dashboard's default (no date filter) behavior.
 */
async function getCurrentUsage(category, yearStr) {
  const match = { category };
  if (yearStr && /^\d{4}$/.test(yearStr)) {
    match.usageDate = {
      $gte: new Date(`${yearStr}-01-01`),
      $lte: new Date(`${yearStr}-12-31T23:59:59`),
    };
  }
  const usageAgg = await Usage.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return usageAgg[0]?.total || 0;
}

module.exports = { getMonthlyTotals, addMonths, getCurrentUsage };
