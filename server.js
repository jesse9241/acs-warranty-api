console.log("🟢 Node version:", process.version);

require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

console.log("🔥 SERVER.JS LOADED");

/**
 * ============================
 * STATIC FORM (ROOT)
 * ============================
 * This serves Public/index.html
 * at https://acs-warranty-api.onrender.com/
 */
app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "Public", "index.html");
  console.log("📄 Serving:", filePath);
  res.sendFile(filePath);
});

/**
 * ============================
 * HEALTH CHECK
 * ============================
 */
app.get("/health", (req, res) => {
  res.json({ ok: true, status: "Server is responding" });
});

/**
 * ============================
 * WARRANTY SUBMIT
 * ============================
 * Receives form JSON
 * Forwards directly to Apps Script
 */
app.post("/submit", async (req, res) => {
  try {
    if (!process.env.APPS_SCRIPT_URL) {
      throw new Error("Missing APPS_SCRIPT_URL env variable");
    }

    console.log("📨 Warranty received:", req.body.customerEmail);

    const response = await fetch(process.env.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Apps Script error: ${text}`);
    }

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Warranty error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ============================
 * START SERVER
 * ============================
 */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
