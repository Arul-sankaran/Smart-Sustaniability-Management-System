const { User, AlertNotification } = require("../models/model.js");
const { sendAlertEmail } = require("./emailer.js");
const { sendPushToUsers } = require("./webPush.js");

const CAT_META = {
  water:       { label: "Water",       emoji: "💧" },
  electricity: { label: "Electricity", emoji: "⚡" },
  waste:       { label: "Waste",       emoji: "🗑" },
};

// Don't re-send an instant notification for the same category+status
// combination more often than this, so a burst of usage entries doesn't
// trigger a burst of emails/pushes for what is still the same alert.
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Admins and staff with an approved account — the people who can act on an alert. */
async function getRecipients() {
  return User.find({ role: { $in: ["admin", "staff"] }, status: "approved" });
}

function formatAlertMessage(alert) {
  const meta = CAT_META[alert.category] || { label: alert.category, emoji: "⚠️" };

  if (alert.status === "already_over") {
    return {
      subject: `⚠️ ${meta.label} usage is over the annual target`,
      title: `${meta.emoji} ${meta.label} over target`,
      body: `Currently ${alert.currentUsage.toLocaleString()} ${alert.unit || ""}, which is ${alert.overBy.toLocaleString()} over the ${alert.target.toLocaleString()} ${alert.unit || ""} target.`,
      html: `
        <h2>${meta.emoji} ${meta.label} usage has exceeded its annual target</h2>
        <p><strong>Current usage:</strong> ${alert.currentUsage.toLocaleString()} ${alert.unit || ""}</p>
        <p><strong>Target:</strong> ${alert.target.toLocaleString()} ${alert.unit || ""}</p>
        <p><strong>Over by:</strong> ${alert.overBy.toLocaleString()} ${alert.unit || ""}</p>
        <p>Log in to Ecometric's Insights page for AI-generated suggestions to bring this back on track.</p>
      `,
    };
  }

  return {
    subject: `⚠️ ${meta.label} usage projected to exceed target soon`,
    title: `${meta.emoji} ${meta.label} trending over target`,
    body: `At the current trend, usage is projected to exceed the monthly target in ${alert.crossesInMonths} month(s).`,
    html: `
      <h2>${meta.emoji} ${meta.label} usage is trending toward its target</h2>
      <p><strong>Trend:</strong> ${alert.trend}</p>
      <p><strong>Monthly target:</strong> ${alert.monthlyThreshold.toLocaleString()} ${alert.unit || ""}</p>
      <p><strong>Projected to cross it in:</strong> ${alert.crossesInMonths} month(s), reaching ${alert.forecastAtCrossing.toLocaleString()} ${alert.unit || ""}</p>
      <p>Log in to Ecometric's Insights page for AI-generated suggestions to help stay under target.</p>
    `,
  };
}

/**
 * Sends an instant notification for a single category alert, respecting a
 * cooldown so the same active alert doesn't re-notify repeatedly. Called
 * right after a usage entry is created for that category.
 */
async function notifyInstantAlert(alert) {
  const existing = await AlertNotification.findOne({ category: alert.category });

  const severityUpgraded = existing && existing.status !== alert.status && alert.status === "already_over";
  const cooldownElapsed = existing && (Date.now() - existing.lastNotifiedAt.getTime()) > COOLDOWN_MS;
  const shouldNotify = !existing || severityUpgraded || cooldownElapsed;

  if (!shouldNotify) return;

  await sendAlertForCategory(alert);

  await AlertNotification.findOneAndUpdate(
    { category: alert.category },
    { status: alert.status, lastNotifiedAt: new Date() },
    { upsert: true }
  );
}

/** Clears the notification record for a category once it's back under target, so the next crossing notifies fresh. */
async function clearAlertRecord(category) {
  await AlertNotification.deleteOne({ category }).catch(() => {});
}

async function sendAlertForCategory(alert) {
  const recipients = await getRecipients();
  if (!recipients.length) return;

  const { subject, title, body, html } = formatAlertMessage(alert);
  const emails = recipients.map(u => u.email).filter(Boolean);
  const userIds = recipients.map(u => u._id);

  await Promise.all([
    sendAlertEmail(emails, subject, html),
    sendPushToUsers(userIds, { title, body, url: "/insights" }),
  ]);
}

/** Sends one consolidated digest email + push covering every active alert. Used by the daily scheduled check. */
async function sendDailyDigest(alerts) {
  if (!alerts.length) return;

  const recipients = await getRecipients();
  if (!recipients.length) return;

  const emails = recipients.map(u => u.email).filter(Boolean);
  const userIds = recipients.map(u => u._id);

  const rows = alerts.map(a => {
    const meta = CAT_META[a.category] || { label: a.category, emoji: "⚠️" };
    const line = a.status === "already_over"
      ? `over target by ${a.overBy.toLocaleString()} ${a.unit || ""}`
      : `projected to cross target in ${a.crossesInMonths} month(s)`;
    return `<li><strong>${meta.emoji} ${meta.label}:</strong> ${line}</li>`;
  }).join("");

  const html = `
    <h2>🌿 Ecometric — Daily Sustainability Alert Summary</h2>
    <p>${alerts.length} categor${alerts.length > 1 ? "ies need" : "y needs"} attention:</p>
    <ul>${rows}</ul>
    <p>Log in to Ecometric's Insights page for AI-generated suggestions.</p>
  `;

  await Promise.all([
    sendAlertEmail(emails, `🌿 Ecometric — ${alerts.length} sustainability alert${alerts.length > 1 ? "s" : ""} today`, html),
    sendPushToUsers(userIds, {
      title: "🌿 Daily Sustainability Summary",
      body: `${alerts.length} categor${alerts.length > 1 ? "ies" : "y"} need attention today.`,
      url: "/insights",
    }),
  ]);
}

module.exports = { notifyInstantAlert, clearAlertRecord, sendDailyDigest, getRecipients };
