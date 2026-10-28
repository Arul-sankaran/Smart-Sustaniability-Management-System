import emailjs from "@emailjs/browser";

const EMAIL_CONFIG = {
  SERVICE_ID: "service_ti9ahp7",
  TEMPLATE_ID: "template_vsie4uw",
  PUBLIC_KEY: "lxbDotlv6uRbZlrrY",
};
const emailInFlight = new Set();

export const sendNotificationEmail = async ({
  category,
  currentUsage,
  target,
  unit,
  percentage,
}) => {
  const resourceName = category.charAt(0).toUpperCase() + category.slice(1);
  const templateParams = {
    user_name: "Arul Sankaran",
    to_name: "Arul Sankaran",
    to_email: "arulsankaran.ag23@bitsathy.ac.in",
    from_name: "Outcome Measurement System",
    reply_to: "sasikunar85@gmail.com",
    subject: `${resourceName} usage has exceeded 90% of its goal`,
    message: `${resourceName} usage is at ${percentage.toFixed(1)}% of its goal. Actual usage: ${currentUsage.toLocaleString()} ${unit}. Goal: ${target.toLocaleString()} ${unit}.`,
  };

  try {
    const response = await emailjs.send(
      EMAIL_CONFIG.SERVICE_ID,
      EMAIL_CONFIG.TEMPLATE_ID,
      templateParams,
      EMAIL_CONFIG.PUBLIC_KEY
    );
    console.log("Threshold email sent successfully:", response.status);
    return { success: true };
  } catch (error) {
    console.error("Threshold email sending failed:", error);
    return { success: false, error };
  }
};

export const checkGoalUsageThresholds = goals => {
  if (!Array.isArray(goals)) return;

  goals.forEach(async goal => {
    const currentUsage = Number(goal.currentUsage) || 0;
    const target = Number(goal.target) || 0;
    if (!goal.category || target <= 0 || currentUsage <= target * 0.9) return;

    const sendKey = `usage-threshold-email:${goal._id || goal.category}:${target}`;
    if (emailInFlight.has(sendKey)) return;

    emailInFlight.add(sendKey);
    try {
      await sendNotificationEmail({
        category: goal.category,
        currentUsage,
        target,
        unit: goal.unit || "units",
        percentage: (currentUsage / target) * 100,
      });
    } finally {
      emailInFlight.delete(sendKey);
    }
  });
};