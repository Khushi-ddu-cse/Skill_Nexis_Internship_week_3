
const express = require("express");
const fs = require("fs");
const path = require("path");
const upload = require("../middleware/upload");

const router = express.Router();
const uploadDirectory = path.join(__dirname, "../../uploads");

// 1. Get all uploaded images
router.get("/images", (req, res) => {
  fs.readdir(uploadDirectory, (error, files) => {
    if (error) {
      return res.status(500).json({
        message: "Unable to read uploaded images."
      });
    }

    const images = files
      .filter((file) => /\.(jpe?g|png|gif|webp)$/i.test(file))
      .map((filename) => ({
        filename,
        url: `${req.protocol}://${req.get("host")}/uploads/${encodeURIComponent(filename)}`
      }))
      .sort((a, b) => b.filename.localeCompare(a.filename));

    res.json({ images });
  });
});

// 2. Upload an image
router.post("/upload", (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (error) return next(error);

    if (!req.file) {
      return res.status(400).json({
        message: "Please select an image to upload."
      });
    }

    res.status(201).json({
      message: "Image uploaded successfully.",
      image: {
        filename: req.file.filename,
        url: `${req.protocol}://${req.get("host")}/uploads/${encodeURIComponent(req.file.filename)}`
      }
    });
  });
});

// 3. Delete an uploaded image
router.delete("/images/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(uploadDirectory, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      message: "Image not found."
    });
  }

  fs.unlink(filePath, (error) => {
    if (error) {
      return res.status(500).json({
        message: "Unable to delete image."
      });
    }

    res.json({
      message: "Image deleted successfully."
    });
  });
});

module.exports = router;
