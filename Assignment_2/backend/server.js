require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const imageRoutes = require("./routes/imageRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173"
}));
app.use(express.json());

// Uploaded files are served as static assets.
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/api/health", (req, res) => {
  res.json({ message: "Image Upload API is running." });
});

app.use("/api", imageRoutes);

// Central error handler for Multer and other upload errors.
app.use((error, req, res, next) => {
  console.error(error.message);

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "Image size must be 5 MB or less." });
  }

  res.status(400).json({ message: error.message || "Something went wrong." });
});

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});
