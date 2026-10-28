/**
 * Lightweight, dependency-free forecasting utilities.
 * Uses simple linear regression over monthly totals — good enough for
 * institutional utility data (water/electricity/waste) without needing
 * Python/Prophet or any paid service.
 */

/**
 * Ordinary least-squares linear regression.
 * @param {number[]} x - independent variable (e.g. month index 0,1,2...)
 * @param {number[]} y - dependent variable (e.g. usage total)
 * @returns {{slope: number, intercept: number}}
 */
function linearRegression(x, y) {
  const n = x.length;
  if (n === 0) return { slope: 0, intercept: 0 };

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, xi, i) => a + xi * y[i], 0);
  const sumXX = x.reduce((a, xi) => a + xi * xi, 0);

  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Forecast the next period(s) from a series of monthly totals.
 * @param {number[]} monthlyTotals - chronologically ordered totals, oldest first
 * @param {number} periodsAhead - how many months ahead to predict (default 1)
 * @returns {{predicted: number, slope: number, confidence: "low"|"medium"|"high"}}
 */
function forecastNext(monthlyTotals, periodsAhead = 1) {
  // Not enough history for a real trend — fall back to the last known value
  if (monthlyTotals.length < 2) {
    const last = monthlyTotals[monthlyTotals.length - 1] ?? 0;
    return { predicted: +last.toFixed(2), slope: 0, confidence: "low" };
  }

  const x = monthlyTotals.map((_, i) => i);
  const y = monthlyTotals;
  const { slope, intercept } = linearRegression(x, y);

  const nextX = monthlyTotals.length - 1 + periodsAhead;
  const rawPredicted = slope * nextX + intercept;
  const predicted = Math.max(0, +rawPredicted.toFixed(2)); // usage can't be negative

  let confidence = "low";
  if (monthlyTotals.length >= 6) confidence = "high";
  else if (monthlyTotals.length >= 3) confidence = "medium";

  return { predicted, slope: +slope.toFixed(4), confidence };
}

/**
 * Forecast a whole series of upcoming periods at once (e.g. the next 3 months),
 * reusing a single regression fit rather than recomputing it per period.
 * @param {number[]} monthlyTotals - chronologically ordered totals, oldest first
 * @param {number} periodsAhead - how many future months to project (default 3)
 * @returns {{ series: {monthsAhead:number, predicted:number}[], slope: number, confidence: "low"|"medium"|"high" }}
 */
function forecastSeries(monthlyTotals, periodsAhead = 3) {
  if (monthlyTotals.length < 2) {
    const last = monthlyTotals[monthlyTotals.length - 1] ?? 0;
    const series = Array.from({ length: periodsAhead }, (_, i) => ({
      monthsAhead: i + 1,
      predicted: +last.toFixed(2),
    }));
    return { series, slope: 0, confidence: "low" };
  }

  const x = monthlyTotals.map((_, i) => i);
  const y = monthlyTotals;
  const { slope, intercept } = linearRegression(x, y);

  const series = Array.from({ length: periodsAhead }, (_, i) => {
    const monthsAhead = i + 1;
    const nextX = monthlyTotals.length - 1 + monthsAhead;
    const rawPredicted = slope * nextX + intercept;
    return { monthsAhead, predicted: Math.max(0, +rawPredicted.toFixed(2)) };
  });

  let confidence = "low";
  if (monthlyTotals.length >= 6) confidence = "high";
  else if (monthlyTotals.length >= 3) confidence = "medium";

  return { series, slope: +slope.toFixed(4), confidence };
}

module.exports = { linearRegression, forecastNext, forecastSeries };