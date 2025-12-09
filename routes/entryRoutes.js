// backend/routes/entryRoutes.js
const express = require("express");
const Entry = require("../models/Entry");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Get all entries
router.get("/", authMiddleware, async (req, res) => {
  try {
    const entries = await Entry.find()
      .populate("collectedBy", "name email")
      .sort({ createdAt: -1 });

    res.json(entries);
  } catch (err) {
    console.error("Get entries error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Create new entry
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, charges, status, email } = req.body;

    if (!name || charges == null) {
      return res
        .status(400)
        .json({ message: "Name and charges are required" });
    }

    const collectorName =
      req.user.collectorName || req.user.name || req.user.email || "Unknown";

    const entry = await Entry.create({
      name,
      email,
      charges,
      status: status || "Pending",
      collectedBy: req.user.userId,
      collectedByName: collectorName,
    });

    const populated = await Entry.findById(entry._id).populate(
      "collectedBy",
      "name email"
    );

    res.status(201).json(populated);
  } catch (err) {
    console.error("Create entry error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update entry
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, charges, status } = req.body;

    const entry = await Entry.findById(id);
    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    if (name !== undefined) entry.name = name;
    if (charges !== undefined) entry.charges = charges;
    if (status !== undefined) entry.status = status;

    await entry.save();

    const populated = await Entry.findById(entry._id).populate(
      "collectedBy",
      "name email"
    );

    res.json(populated);
  } catch (err) {
    console.error("Update entry error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete entry
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await Entry.findById(id);
    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    await entry.deleteOne();
    res.json({ message: "Entry deleted" });
  } catch (err) {
    console.error("Delete entry error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
