/**
 * Runs once a day and sends a consolidated email + push digest covering
 * every category that currently has an active alert. Started once from
 * server/index.js on boot.
 */

const cron = require("node-cron");
const { getAllAlerts } = require("./alertCheck.js");
const { sendDailyDigest } = require("./notify.js");

// Default: 8:00 AM server time, every day. Override with DIGEST_CRON in
// .env if you want a different time (standard cron syntax).
const SCHEDULE = process.env.DIGEST_CRON || "0 8 * * *";

function startDailyDigestJob() {
  if (!cron.validate(SCHEDULE)) {
    console.error(`Invalid DIGEST_CRON schedule "${SCHEDULE}" — daily digest job not started.`);
    return;
  }

  cron.schedule(SCHEDULE, async () => {
    try {
      const alerts = await getAllAlerts();
      if (alerts.length) {
        await sendDailyDigest(alerts);
        console.log(`Daily digest sent for ${alerts.length} alert(s).`);
      }
    } catch (error) {
      console.error("Daily digest job failed:", error.message);
    }
  });

  console.log(`Daily sustainability digest scheduled: "${SCHEDULE}"`);
}

module.exports = { startDailyDigestJob };
