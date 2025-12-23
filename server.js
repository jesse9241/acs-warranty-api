// server.js — LOCKED FINAL VERSION

require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const { appendWarrantyRow } = require("./sheets");

const app = express();

app.use(cors());
app.use(express.json());

console.log("🔥 SERVER.JS LOADED");

// ✅ ROOT — SERVE THE FORM
app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "Public", "index.html");
  console.log("📄 Serving:", filePath);
  res.sendFile(filePath);
});

// ✅ HEALTH CHECK
app.get("/health", (req, res) => {
  res.send("Server is responding");
});

// ✅ WARRANTY SUBMISSION
app.post("/warranty", async (req, res) => {
  try {
    const d = req.body;

    const row = [
      "",                             // claimId (auto later)
      d.source || "",
      d.customerName || "",
      d.originalOrderNumber || "",
      "",
      d.originalOrderDate || "",
      d.originalWarrantyNumber || "",
      "",
      new Date().toISOString().split("T")[0],
      "",
      "",
      d.product || "",
      d.issueDescription || "",
      "",
      d.upc || "",
      "",
      "Submitted",
      d.customerPhone || "",
      d.customerEmail || "",
      d.customerAddress || "",
      d.notes || ""
    ];

    await appendWarrantyRow(row);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ WARRANTY ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
