require("dotenv").config();

const express = require("express");

const { Goal } = require("../models/model.js");
const { getCurrentUsage } = require("../utils/usageStats.js");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// GET /api/goals — includes currentUsage: usage recorded for that category,
// so the client can show progress toward the target without a separate
// round trip. If the goal has a 4-digit "Year" set (the optional
// description field on the form), usage is scoped to that calendar year;
// otherwise it's the all-time total for the category, matching how the
// Dashboard itself treats usage with no explicit date filter.
router.get("/", protect, async (req, res) => {
  try {
    const goals = await Goal.find();

    const enriched = await Promise.all(goals.map(async (g) => {
      const currentUsage = await getCurrentUsage(g.category, g.description);
      return { ...g.toObject(), currentUsage };
    }));

    res.json(enriched);
  } catch (error) {
    console.error("GET /goals error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", protect, authorize("admin", "staff"), async (req, res) => {
  const goal = await Goal.create(req.body);
  res.status(201).json(goal);
});

router.put("/:id", protect, authorize("admin"), async (req, res) => {
  const goal = await Goal.findById(req.params.id);
  if (goal) {
    Object.assign(goal, req.body);
    await goal.save();
    res.json(goal);
  } else {
    res.status(404);
    throw new Error("Goal not found");
  }
});

router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  await Goal.findByIdAndDelete(req.params.id);
  res.json({ message: "Goal deleted" });
});

module.exports = router;