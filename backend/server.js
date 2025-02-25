const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const contractRoutes = require("./routes/contracts");
const authMiddleware = require("./middleware/authMiddleware");

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors({ origin: "https://www.ntari.org", credentials: true }));
app.use(authMiddleware); // Ensuring Wix API calls are authenticated

// Routes
const authRoutes = require("./routes/authRoutes");
const keyRoutes = require("./routes/keyRoutes");
const contractRoutes = require("./routes/contracts");

app.use("/api/auth", authRoutes);
app.use("/api/keys", keyRoutes);
app.use("/api/contracts", contractRoutes);

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB Connection Error:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));