// backend/models/Entry.js
const mongoose = require("mongoose");

const entrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // customer name
    email: { type: String, trim: true }, // customer email (optional but recommended)
    charges: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Paid", "Pending"],
      default: "Pending",
    },
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Name typed on login screen: "Collected By"
    collectedByName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Entry", entrySchema);
