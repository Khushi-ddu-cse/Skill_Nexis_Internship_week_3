
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Load environment variables
dotenv.config();

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// 1. MIDDLEWARE CONFIGURATION
// ==========================================

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);

app.use(express.json());

// ==========================================
// 2. DATABASE SCHEMAS AND MODELS
// ==========================================

// User Schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
  },
  { timestamps: true }
);

// Task Schema
const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
      default: "pending",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    dueDate: {
      type: Date,
      default: null,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Create Models
const User = mongoose.model("User", userSchema);
const Task = mongoose.model("Task", taskSchema);

// ==========================================
// 3. HELPER FUNCTIONS
// ==========================================

// Return public user information
const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

// Generate JWT token
const tokenFor = (id) =>
  jwt.sign(
    { id },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    }
  );

// ==========================================
// 4. AUTHENTICATION MIDDLEWARE
// ==========================================

// Protect routes using JWT authentication
async function protect(req, res, next) {
  try {
    const [scheme, token] = (
      req.headers.authorization || ""
    ).split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        message: "Bearer token required.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({
        message: "User not found.",
      });
    }

    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token. Please log in again.",
    });
  }
}

// Allow only admin users
const adminOnly = (req, res, next) => {
  if (req.user.role === "admin") {
    return next();
  }

  return res.status(403).json({
    message: "Admin access required.",
  });
};

// ==========================================
// 5. HOME ROUTE
// ==========================================

app.get("/", (_req, res) => {
  res.json({
    message: "Assignment 1 To-Do API is running.",
  });
});

// ==========================================
// 6. AUTHENTICATION APIs
// ==========================================

// Register User
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email already registered.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    res.status(201).json({
      message: "Registered successfully.",
      user: publicUser(user),
      token: tokenFor(user._id),
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Login User
app.post("/api/auth/login", async (req, res) => {
  try {
    const email = (req.body.email || "").toLowerCase().trim();
    const password = req.body.password || "";

    const user = await User.findOne({
      email,
    }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    res.json({
      message: "Login successful.",
      user: publicUser(user),
      token: tokenFor(user._id),
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Get Logged-in User
app.get("/api/auth/me", protect, (req, res) => {
  res.json({
    user: publicUser(req.user),
  });
});

// ==========================================
// 7. USER MANAGEMENT APIs
// ==========================================

// Get All Users (Admin Only)
app.get("/api/users", protect, adminOnly, async (_req, res) => {
  const users = await User.find()
    .select("-password")
    .sort({ createdAt: -1 });

  res.json({
    users,
  });
});

// Get User by ID
app.get("/api/users/:id", protect, async (req, res) => {
  if (
    req.user.role !== "admin" &&
    req.user.id !== req.params.id
  ) {
    return res.status(403).json({
      message: "You can view only your own profile.",
    });
  }

  const user = await User.findById(req.params.id).select("-password");

  if (!user) {
    return res.status(404).json({
      message: "User not found.",
    });
  }

  res.json({
    user,
  });
});

// Update User
app.put("/api/users/:id", protect, async (req, res) => {
  if (
    req.user.role !== "admin" &&
    req.user.id !== req.params.id
  ) {
    return res.status(403).json({
      message: "You can update only your own profile.",
    });
  }

  const updates = {};

  if (req.body.name?.trim()) {
    updates.name = req.body.name.trim();
  }

  if (req.body.email?.trim()) {
    updates.email = req.body.email.trim().toLowerCase();
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    res.json({
      message: "User updated.",
      user,
    });
  } catch (error) {
    res.status(400).json({
      message:
        error.code === 11000
          ? "Email already in use."
          : error.message,
    });
  }
});

// Delete User
app.delete("/api/users/:id", protect, async (req, res) => {
  if (
    req.user.role !== "admin" &&
    req.user.id !== req.params.id
  ) {
    return res.status(403).json({
      message: "You can delete only your own account.",
    });
  }

  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    return res.status(404).json({
      message: "User not found.",
    });
  }

  res.json({
    message: "User deleted.",
  });
});

// ==========================================
// 8. TASK MANAGEMENT APIs
// ==========================================

// Create New Task
app.post("/api/tasks", protect, async (req, res) => {
  try {
    if (!req.body.title?.trim()) {
      return res.status(400).json({
        message: "Task title is required.",
      });
    }

    const task = await Task.create({
      title: req.body.title.trim(),
      description: req.body.description || "",
      priority: req.body.priority || "medium",
      dueDate: req.body.dueDate || null,
      owner: req.user._id,
    });

    res.status(201).json({
      message: "Task created.",
      task,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

// Get All Tasks of Logged-in User
app.get("/api/tasks", protect, async (req, res) => {
  const filter = {
    owner: req.user._id,
  };

  if (
    ["pending", "in-progress", "completed"].includes(
      req.query.status
    )
  ) {
    filter.status = req.query.status;
  }

  if (
    ["low", "medium", "high"].includes(req.query.priority)
  ) {
    filter.priority = req.query.priority;
  }

  const tasks = await Task.find(filter).sort({
    createdAt: -1,
  });

  res.json({
    count: tasks.length,
    tasks,
  });
});

// Get Task by ID
app.get("/api/tasks/:id", protect, async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.id,
    owner: req.user._id,
  });

  if (!task) {
    return res.status(404).json({
      message: "Task not found.",
    });
  }

  res.json({
    task,
  });
});

// Update Task
app.put("/api/tasks/:id", protect, async (req, res) => {
  const allowedFields = [
    "title",
    "description",
    "status",
    "priority",
    "dueDate",
  ];

  const changes = {};

  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      changes[key] = req.body[key];
    }
  }

  try {
    const task = await Task.findOneAndUpdate(
      {
        _id: req.params.id,
        owner: req.user._id,
      },
      changes,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    res.json({
      message: "Task updated.",
      task,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

// Delete Task
app.delete("/api/tasks/:id", protect, async (req, res) => {
  const task = await Task.findOneAndDelete({
    _id: req.params.id,
    owner: req.user._id,
  });

  if (!task) {
    return res.status(404).json({
      message: "Task not found.",
    });
  }

  res.json({
    message: "Task deleted.",
  });
});

// ==========================================
// 9. GLOBAL ERROR HANDLING
// ==========================================

app.use((err, _req, res, _next) => {
  console.error("Server Error:", err);

  res.status(500).json({
    message: err.message || "Server error.",
  });
});

// ==========================================
// 10. DATABASE CONNECTION AND SERVER START
// ==========================================

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully.");

    app.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
