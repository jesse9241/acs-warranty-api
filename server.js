// server.js – FINAL, FIXED VERSION

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { appendWarrantyRow } = require("./sheets");
const { sendWarrantyEmail } = require("./email");

console.log("🔥 SERVER.JS LOADED");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Serve static files
app.use(express.static(path.join(__dirname, "Public")));

// ✅ ROOT ROUTE — THIS WAS MISSING
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "Public", "warranty.html"));
});

// ✅ Health check
app.get("/health", (req, res) => {
  res.json({ status: "Server is responding" });
});

// ✅ Warranty submission
app.post("/warranty", async (req, res) => {
  try {
    const d = req.body;

    const row = [
      d.claimId || "",
      d.source || "",
      d.customerName || "",
      d.originalOrderNumber || "",
      d.originalOrder || "",
      d.originalOrderDate || "",
      d.originalWarrantyNumber || "",
      d.previousWarrantyDate || "",
      d.dateReceived || "",
      d.newOrderNumber || "",
      d.newWarrantyNumber || "",
      d.product || "",
      d.issueDescription || "",
      "",
      d.upc || "",
      d.replacementTracking || "",
      d.status || "Submitted",
      d.customerPhone || "",
      d.customerEmail || "",
      d.customerAddress || "",
      d.notes || ""
    ];

    await appendWarrantyRow(process.env.GOOGLE_SHEET_ID, row);
    await sendWarrantyEmail(d);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Warranty submission error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Warranty API running on port ${PORT}`);
});
