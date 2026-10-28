const mongoose = require("mongoose");

// Campus blocks where resource usage can be recorded
const LOCATIONS = ["AS Block", "IB Block", "SF Block", "Mechanical Block", "Boys Hostel", "Girls Hostel"];

//  USER SCHEMA
const userSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true},
    password: { type: String, required: true},
    role: { type: String, enum: ["admin", "staff", "student"], default: "student"},
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" }
  },
  { timestamps: true }
);

//  IDEA SCHEMA
const ideaSchema = mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    submittedBy: { type: String },
    category: { type: String, enum: ["idea", "feedback"], default: "idea" },
  },
  { timestamps: true }
);

//  GOAL SCHEMA
const goalSchema = mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, enum: ["water", "electricity", "waste"], required: true},
    target: { type: Number, required: true },
    current: { type: Number, default: 0 },
    unit: { type: String, required: true},
    duration: { type: String},
    description: { type: String}
  },
  { timestamps: true }
);


// USAGE SCHEMA
// NOTE: `location` is deliberately not `required` at the schema level —
// usage records created before this field existed have no location, and
// we don't want them to fail validation. The routes in resource.js require
// a valid location for every NEW or EDITED entry instead.
const usageSchema = mongoose.Schema(
  {
    category: {type: String, enum: ["water", "electricity", "waste"], required: true },
    location: { type: String, enum: LOCATIONS },
    amount: { type: Number, required: true},
    unit: { type: String, required: true},
    usageDate: { type: Date, required: true},
    submittedBy: { type: String}
  },
  { timestamps: true }
);

// PUSH SUBSCRIPTION SCHEMA — one per browser/device a user enabled notifications on
const pushSubscriptionSchema = mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true }
);

// ALERT NOTIFICATION SCHEMA — tracks the last time we notified about a
// category's threshold status, so instant checks don't spam on every
// single usage entry while the same alert is still active.
const alertNotificationSchema = mongoose.Schema(
  {
    category: { type: String, enum: ["water", "electricity", "waste"], required: true, unique: true },
    status: { type: String, enum: ["already_over", "projected"], required: true },
    lastNotifiedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

const Usage = mongoose.model("Usage", usageSchema);
const Goal = mongoose.model("Goal", goalSchema);
const Idea = mongoose.model("Ideas", ideaSchema);
const User = mongoose.model("User", userSchema);
const PushSubscription = mongoose.model("PushSubscription", pushSubscriptionSchema);
const AlertNotification = mongoose.model("AlertNotification", alertNotificationSchema);


module.exports = { Idea, Usage, Goal, User, PushSubscription, AlertNotification, LOCATIONS }
