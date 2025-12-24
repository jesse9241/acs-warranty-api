require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");

const { appendWarrantyRow } = require("./sheets");

const app = express();

app.use(cors());
app.use(express.json());

console.log("🔥 SERVER.JS LOADED");

// ===============================
// SERVE WARRANTY FORM
// ===============================
app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "Public", "index.html");
  console.log("📄 Serving:", filePath);
  res.sendFile(filePath);
});

// ===============================
// HEALTH CHECK
// ===============================
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// ===============================
// WARRANTY SUBMISSION (APPS SCRIPT)
// ===============================
app.post("/warranty", async (req, res) => {
  try {
    const data = req.body;

    console.log("📨 Warranty received:", data.customerEmail);

    // 🔥 SEND FULL OBJECT TO APPS SCRIPT
    await appendWarrantyRow(data);

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Warranty error:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ===============================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
