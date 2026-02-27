const express = require("express");
const Entry = require("../models/Entry");
const nodemailer = require("nodemailer");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const SMTP_CONNECT_TIMEOUT_MS = 10000;
const SMTP_SOCKET_TIMEOUT_MS = 15000;
const PER_EMAIL_TIMEOUT_MS = 20000;

function hasSmtpConfig() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  connectionTimeout: SMTP_CONNECT_TIMEOUT_MS,
  greetingTimeout: SMTP_CONNECT_TIMEOUT_MS,
  socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
  auth: {
    user: process.env.SMTP_USER,
    pass: (process.env.SMTP_PASS || "").replace(/\s+/g, ""),
  },
});

async function sendReminderEmail(entry) {
  if (!entry.email) return null;

  const mailOptions = {
    from: process.env.FROM_EMAIL || process.env.SMTP_USER,
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

function withTimeout(promise, ms, label) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() =>
    clearTimeout(timer)
  );
}

/**
 * POST /api/reminders/send-now
 * Send reminder email immediately to all pending customers.
 */
router.post("/send-now", authMiddleware, async (req, res) => {
  try {
    if (!hasSmtpConfig()) {
      console.error(
        "[Reminder][Manual] Missing SMTP config. Check SMTP_HOST/PORT/USER/PASS."
      );
      return res.status(500).json({
        message: "Email service is not configured on server.",
      });
    }

    console.log(
      `[Reminder][Manual] Triggered by userId=${req.user.userId}, collectorName=${req.user.collectorName || req.user.name || ""}`
    );

    await transporter.verify();

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
    const failedDetails = [];

    for (const entry of pendingEntries) {
      try {
        await withTimeout(
          sendReminderEmail(entry),
          PER_EMAIL_TIMEOUT_MS,
          `Email send to ${entry.email}`
        );
        sent++;
      } catch (error) {
        failed++;
        failedDetails.push({
          email: entry.email,
          error: error.message,
        });
        console.error(
          `[Reminder][Manual] Failed -> to=${entry.email}, error=${error.message}`
        );
      }
    }

    const message =
      sent === 0 && failed > 0
        ? `Reminder send failed for all pending client(s). Failed: ${failed}.`
        : `Reminder sent to ${sent} pending client(s). Failed: ${failed}.`;

    return res.json({
      ok: true,
      message,
      sent,
      failed,
      failedDetails,
    });
  } catch (error) {
    console.error("[Reminder][Manual] Send now error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
