// backend/models/Reminder.js
const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema(
  {
    scheduledFor: { type: Date, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Reminder", reminderSchema);
