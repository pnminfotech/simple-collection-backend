const express = require("express");
const Entry = require("../models/Entry");
const nodemailer = require("nodemailer");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: (process.env.SMTP_PASS || "").replace(/\s+/g, ""),
  },
});

async function sendReminderEmail(entry) {
  if (!entry.email) return null;

  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to: entry.email,
    cc: "pnminfotech2024@gmail.com",
    subject: "Reminder: Pending Venue Charges for BNI Alpha",
    text: `Dear sir,

This is a gentle reminder that the venue charges for BNI Alpha are still pending.
Kindly arrange the payment at your earliest convenience to avoid any delay in processing.

If you have already made the payment, please ignore this message or share the confirmation.

Thank you for your prompt attention.

Warm regards,
BNI Alpha`,
  };

  console.log(`[Reminder][Manual] Sending email -> to=${entry.email}`);
  const info = await transporter.sendMail(mailOptions);
  console.log(
    `[Reminder][Manual] Email sent -> to=${entry.email}, messageId=${info.messageId}`
  );
  return info;
}

/**
 * POST /api/reminders/send-now
 * Send reminder email immediately to all pending customers.
 */
router.post("/send-now", authMiddleware, async (req, res) => {
  try {
    console.log(
      `[Reminder][Manual] Triggered by userId=${req.user.userId}, collectorName=${req.user.collectorName || req.user.name || ""}`
    );

    const pendingEntries = await Entry.find({
      status: "Pending",
      email: { $nin: [null, ""] },
    });

    console.log(
      `[Reminder][Manual] Pending entries with email: ${pendingEntries.length}`
    );

    if (!pendingEntries.length) {
      return res.json({
        ok: true,
        message: "No pending entries with email.",
        sent: 0,
      });
    }

    let sent = 0;
    let failed = 0;

    for (const entry of pendingEntries) {
      try {
        await sendReminderEmail(entry);
        sent++;
      } catch (error) {
        failed++;
        console.error(
          `[Reminder][Manual] Failed -> to=${entry.email}, error=${error.message}`
        );
      }
    }

    return res.json({
      ok: true,
      message: `Reminder sent to ${sent} pending client(s).`,
      sent,
      failed,
    });
  } catch (error) {
    console.error("[Reminder][Manual] Send now error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
