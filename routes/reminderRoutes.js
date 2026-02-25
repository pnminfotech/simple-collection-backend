// // backend/routes/reminderRoutes.js
// const express = require("express");
// const authMiddleware = require("../middleware/authMiddleware");
// const Reminder = require("../models/Reminder");

// const router = express.Router();

// /**
//  * POST /api/reminders/schedule
//  * Body: { date: "YYYY-MM-DD" }
//  */
// router.post("/schedule", authMiddleware, async (req, res) => {
//   try {
//     const { date } = req.body; // e.g. "2025-12-15"
//     if (!date) {
//       return res.status(400).json({ message: "Date is required" });
//     }

//     const scheduledFor = new Date(date);
//     if (isNaN(scheduledFor.getTime())) {
//       return res.status(400).json({ message: "Invalid date format" });
//     }

//     const reminder = await Reminder.create({
//       scheduledFor,
//       createdBy: req.user.userId,
//     });

//     res.status(201).json({
//       message: "Reminder scheduled successfully",
//       reminderId: reminder._id,
//       scheduledFor: reminder.scheduledFor,
//     });
//   } catch (err) {
//     console.error("Schedule reminder error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// module.exports = router;





const express = require("express");
const Reminder = require("../models/Reminder");
const Entry = require("../models/Entry");
const nodemailer = require("nodemailer");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// ---------- EMAIL TRANSPORT ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// helper to send one email
async function sendReminderEmail(entry) {
  if (!entry.email) return;

  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to: entry.email,
    cc: "harshada@pnminfotech.com",
    subject: "Reminder: Pending Venue Charges for BNI Alpha",
    text: `Dear sir,

This is a gentle reminder that the venue charges for BNI Alpha are still pending.
Kindly arrange the payment at your earliest convenience to avoid any delay in processing.

If you have already made the payment, please ignore this message or share the confirmation.

Thank you for your prompt attention.

Warm regards,
BNI Alpha`,
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 Reminder email sent to ${entry.email}`);
}

/**
 * POST /api/reminders/schedule
 * Body: { date: "YYYY-MM-DD" }
 */
router.post("/schedule", authMiddleware, async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ message: "Date is required" });

    const scheduledFor = new Date(date);
    if (isNaN(scheduledFor.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    const reminder = await Reminder.create({
      scheduledFor,
      createdBy: req.user.userId,
      sent: false,
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

/**
 * GET /api/reminders/run?key=YOUR_SECRET
 * Called by UptimeRobot every 5 mins.
 * This sends all reminders that are due and not sent yet.
 */
router.get("/run", async (req, res) => {
  try {
    const key = req.query.key;
    if (!key || key !== process.env.RUN_KEY) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const now = new Date();

    // ✅ all reminders due by now (prevents timezone “today” issues)
    const dueReminders = await Reminder.find({
      sent: false,
      scheduledFor: { $lte: now },
    });

    if (!dueReminders.length) {
      return res.json({ ok: true, message: "No due reminders", sent: 0 });
    }

    // ✅ FIX email query
    const pendingEntries = await Entry.find({
      status: "Pending",
      email: { $nin: [null, ""] },
    });

    if (!pendingEntries.length) {
      // mark reminders sent anyway? usually NO — keep false so it can retry later
      return res.json({
        ok: true,
        message: "No pending entries with email",
        dueReminders: dueReminders.length,
        sent: 0,
      });
    }

    let sentCount = 0;

    for (const reminder of dueReminders) {
      for (const entry of pendingEntries) {
        try {
          await sendReminderEmail(entry);
          sentCount++;
        } catch (e) {
          console.error("Failed email:", entry.email, e.message);
        }
      }

      reminder.sent = true; // ✅ prevent duplicate
      await reminder.save();
    }

    return res.json({
      ok: true,
      message: "Processed due reminders",
      dueReminders: dueReminders.length,
      sent: sentCount,
    });
  } catch (err) {
    console.error("Run reminders error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
