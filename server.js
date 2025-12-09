// backend/server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const cron = require("node-cron");
const nodemailer = require("nodemailer");

dotenv.config();

const authRoutes = require("./routes/authRoutes");
const entryRoutes = require("./routes/entryRoutes");
const reminderRoutes = require("./routes/reminderRoutes");

const Entry = require("./models/Entry");
const Reminder = require("./models/Reminder");

const app = express();

// ---------- CORS + JSON ----------
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

// ---------- ROUTES ----------
app.use("/api/auth", authRoutes);
app.use("/api/entries", entryRoutes);
app.use("/api/reminders", reminderRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

const PORT = process.env.PORT || 8000;

// ---------- EMAIL TRANSPORT ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// helper to send one email
async function sendReminderEmail(entry, reminder) {
  if (!entry.email) return;

const mailOptions = {
  from: process.env.FROM_EMAIL,             // now always "PNM Infotech <pnminfotech24@gmail.com>"
  to: entry.email,                          // customer email
  cc: "harshada@pnminfotech.com",           // send a copy here
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

// ---------- START SERVER + CRON ----------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });

    // CRON JOB: check reminders
    // Currently: every minute for testing. Later use "0 9 * * *" (daily 9AM)
    cron.schedule("*/1 * * * *", async () => {
      try {
        const now = new Date();
        const startOfDay = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const endOfDay = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1
        );

        // find reminders for TODAY that are not sent yet
        const dueReminders = await Reminder.find({
          sent: false,
          scheduledFor: { $gte: startOfDay, $lt: endOfDay },
        });

        if (!dueReminders.length) return;

        // find all PENDING entries with email
        const pendingEntries = await Entry.find({
          status: "Pending",
          email: { $ne: null, $ne: "" },
        });

        if (!pendingEntries.length) return;

        for (const reminder of dueReminders) {
          for (const entry of pendingEntries) {
            try {
              await sendReminderEmail(entry, reminder);
            } catch (err) {
              console.error(
                `Failed to send email to ${entry.email}:`,
                err.message
              );
            }
          }

          reminder.sent = true;
          await reminder.save();
        }
      } catch (err) {
        console.error("Error in reminder cron job:", err);
      }
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });
