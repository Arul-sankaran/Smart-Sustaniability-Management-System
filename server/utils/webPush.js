/**
 * Sends browser push notifications (shows up as a real phone notification
 * on Android Chrome, and on iOS Safari if the site is installed as a PWA).
 * Requires VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT in .env.
 * Generate a keypair once with: node -e "console.log(require('web-push').generateVAPIDKeys())"
 */
require("dotenv").config();
const webpush = require("web-push");
const { PushSubscription } = require("../models/model.js");

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;

  webpush.setVapidDetails(
    VAPID_SUBJECT || "mailto:admin@example.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  configured = true;
  return true;
}

/**
 * Sends a push notification to every subscription belonging to the given
 * user IDs. Automatically removes subscriptions that are no longer valid
 * (expired or the user revoked permission — these come back as 404/410).
 * @param {string[]} userIds
 * @param {{title: string, body: string, url?: string}} payload
 */
async function sendPushToUsers(userIds, payload) {
  if (!ensureConfigured() || !userIds.length) return;

  const subs = await PushSubscription.find({ user: { $in: userIds } });
  const message = JSON.stringify(payload);

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
        message
      );
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        // Subscription is dead (expired / permission revoked) — clean it up
        await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
      } else {
        console.error("Push send failed:", error.message);
      }
    }
  }));
}

module.exports = { sendPushToUsers };
