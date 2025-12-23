require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");

const { appendWarrantyRow } = require("./sheets");

const app = express();

app.use(cors());
app.use(express.json());

console.log("🔥 SERVER.JS LOADED");

// ==============================
// ROOT ROUTE – SERVE THE FORM
// ==============================
app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "Public", "index.html");
  console.log("📄 Serving:", filePath);
  res.sendFile(filePath);
});

// ==============================
// HEALTH CHECK
// ==============================
app.get("/health", (req, res) => {
  res.send("Server is responding");
});

// ==============================
// WARRANTY SUBMISSION
// ==============================
app.post("/warranty", async (req, res) => {
  try {
    const d = req.body;

    console.log("📨 Warranty received:", d.customerEmail);

    // 🔑 IMPORTANT:
    // We now send RAW FORM DATA to Apps Script
    await appendWarrantyRow(null, d);

    res.json({
      success: true,
      message: "Warranty submitted successfully"
    });

  } catch (err) {
    console.error("❌ Warranty error:", err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
