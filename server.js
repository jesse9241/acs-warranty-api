require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

/**
 * 🔍 DEBUG: log directory contents
 */
console.log("Server directory:", __dirname);
console.log("Public path:", path.join(__dirname, "Public"));

/**
 * ✅ Serve static files FIRST
 */
app.use(express.static(path.join(__dirname, "Public")));

/**
 * ✅ Explicit root route
 */
app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "Public", "warranty.html");
  console.log("Serving:", filePath);
  res.sendFile(filePath);
});

/**
 * 🔧 TEMP sanity check route
 */
app.get("/health", (req, res) => {
  res.send("Server is responding");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
