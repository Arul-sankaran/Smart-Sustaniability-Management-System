// Load environment variables
require("dotenv").config();

// Core packages
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// DB connection
const connectDB = require("./config/db");

// Error middleware
const { errorHandler } = require("./middleware/errorMiddleware.js");

// Connect to database
connectDB();

// Create express app
const app = express();

// Middlewares
app.use(express.json());
app.use(cors());
app.use(helmet());

// Rate limiting (Security)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use(limiter);

// Routes
app.use("/api/auth", require("./routes/auth.js"));
app.use("/api/users", require("./routes/user.js"));
app.use("/api/usage", require("./routes/resource.js"));
app.use("/api/goals", require("./routes/goal.js"));
app.use("/api/ideas", require("./routes/idea.js"));
app.use("/api/insights", require("./routes/insights.js"));
app.use("/api/notifications", require("./routes/notifications.js"));

// Error Handler (Always last middleware)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  require("./utils/scheduler.js").startDailyDigestJob();
});