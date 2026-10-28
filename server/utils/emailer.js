/**
 * Sends threshold-alert emails via Gmail SMTP (free).
 * Requires EMAIL_USER and EMAIL_PASS in .env — EMAIL_PASS must be a
 * Gmail "App Password" (not your normal password), generated at
 * https://myaccount.google.com/apppasswords (requires 2-Step Verification
 * to be enabled on the Google account first).
 */

const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null; // not configured — callers should skip sending
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
}

/**
 * @param {string[]} toEmails - recipient email addresses
 * @param {string} subject
 * @param {string} html
 */
async function sendAlertEmail(toEmails, subject, html) {
  const t = getTransporter();
  if (!t || !toEmails.length) return;

  try {
    await t.sendMail({
      from: `"Ecometric Alerts" <${process.env.EMAIL_USER}>`,
      to: toEmails.join(","),
      subject,
      html,
    });
  } catch (error) {
    console.error("Email send failed:", error.message);
  }
}

module.exports = { sendAlertEmail };
