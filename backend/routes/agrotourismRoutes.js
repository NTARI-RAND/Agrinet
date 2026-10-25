const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const Agrotourism = require("../models/agrotourism");
const authMiddleware = require("../middleware/authMiddleware");
const { apiLimiter, uploadLimiter } = require("../middleware/rateLimit");

// Configure Multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/agrotourism");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Listing reads hit Mongo; /create also accepts up to five image uploads.
router.use(apiLimiter);
router.use("/create", uploadLimiter);

// Create Agrotourism Listing
router.post("/create", authMiddleware, upload.array("images", 5), async (req, res) => {
  try {
    const { title, location, description, date, maxGuests } = req.body;
    const imagePaths = req.files.map(file => file.path);

    const newListing = new Agrotourism({
      userId: req.user.id,
      title,
      location,
      description,
      date,
      maxGuests,
      images: imagePaths
    });

    await newListing.save();
    res.status(201).json({ message: "Agrotourism listing created", listing: newListing });
  } catch (error) {
    res.status(500).json({ error: "Error creating listing" });
  }
});

// Get all Agrotourism listings
router.get("/all", async (req, res) => {
  try {
    const listings = await Agrotourism.find().sort({ date: -1 });
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: "Error fetching listings" });
  }
});

module.exports = router;
