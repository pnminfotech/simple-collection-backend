// backend/routes/reminderRoutes.js
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const Reminder = require("../models/Reminder");

const router = express.Router();

/**
 * POST /api/reminders/schedule
 * Body: { date: "YYYY-MM-DD" }
 */
router.post("/schedule", authMiddleware, async (req, res) => {
  try {
    const { date } = req.body; // e.g. "2025-12-15"
    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    const scheduledFor = new Date(date);
    if (isNaN(scheduledFor.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    const reminder = await Reminder.create({
      scheduledFor,
      createdBy: req.user.userId,
    });

    res.status(201).json({
      message: "Reminder scheduled successfully",
      reminderId: reminder._id,
      scheduledFor: reminder.scheduledFor,
    });
  } catch (err) {
    console.error("Schedule reminder error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
