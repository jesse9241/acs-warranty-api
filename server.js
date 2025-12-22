require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");

// Node 18+ / Render supports global fetch
// (no need to import node-fetch)

const app = express();

app.use(cors());
app.use(express.json());

console.log("🔥 SERVER.JS LOADED");

// ================================
// SERVE WARRANTY FORM (ROOT)
// ================================
app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "Public", "index.html");
  console.log("📄 Serving file:", filePath);
  res.sendFile(filePath);
});

// ================================
// HEALTH CHECK
// ================================
app.get("/health", (req, res) => {
  res.send("Server is responding");
});

// ================================
// WARRANTY SUBMISSION ROUTE
// ================================
app.post("/warranty", async (req, res) => {
  try {
    if (!process.env.APPS_SCRIPT_URL) {
      throw new Error("Missing APPS_SCRIPT_URL environment variable");
    }

    const payload = req.body;

    const response = await fetch(process.env.APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Apps Script error: ${text}`);
    }

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Warranty submission failed:", err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ================================
// START SERVER
// ================================
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
