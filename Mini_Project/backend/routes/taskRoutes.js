const express = require("express");
const mongoose = require("mongoose");
const Task = require("../models/Task");
const protect = require("../middleware/auth");

const router = express.Router();

router.use(protect);

// GET /api/tasks – only the logged-in user's tasks are returned.
router.get("/", async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json({ tasks });
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch tasks." });
  }
});

// POST /api/tasks – create a task for the logged-in user.
router.post("/", async (req, res) => {
  try {
    const { title, description, priority, dueDate } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ message: "Task title is required." });
    }

    const task = await Task.create({
      user: req.userId,
      title: title.trim(),
      description: description || "",
      priority: priority || "medium",
      category: req.body.category || "personal",
      dueDate: dueDate || null
    });

    res.status(201).json({ message: "Task created successfully.", task });
  } catch (error) {
    res.status(400).json({ message: error.message || "Unable to create task." });
  }
});

// PUT /api/tasks/:id – update only a task owned by the logged-in user.
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid task ID." });
    }

    const allowedFields = ["title", "description", "priority", "category", "dueDate", "completed"];
    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (typeof updates.title === "string") {
      updates.title = updates.title.trim();
      if (!updates.title) {
        return res.status(400).json({ message: "Task title cannot be empty." });
      }
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    res.json({ message: "Task updated successfully.", task });
  } catch (error) {
    res.status(400).json({ message: error.message || "Unable to update task." });
  }
});

// DELETE /api/tasks/:id – delete only a task owned by the logged-in user.
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid task ID." });
    }

    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      user: req.userId
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    res.json({ message: "Task deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Unable to delete task." });
  }
});

module.exports = router;
