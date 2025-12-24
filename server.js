require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");

const { appendWarrantyRow } = require("./sheets");

const app = express();

app.use(cors());
app.use(express.json());

console.log("🔥 SERVER.JS LOADED");

// ✅ SERVE FORM
app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "Public", "index.html");
  console.log("📄 Serving:", filePath);
  res.sendFile(filePath);
});

// ✅ HEALTH CHECK
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// ✅ ***THIS IS THE CRITICAL ROUTE***
app.post("/warranty", async (req, res) => {
  console.log("📨 Warranty received:", req.body.customerEmail);

  try {
    const d = req.body;

    const row = [
      "",
      d.source || "",
      d.customerName || "",
      d.originalOrderNumber || "",
      "",
      "",
      d.originalWarrantyNumber || "",
      "",
      new Date().toISOString().split("T")[0],
      "",
      "",
      d.product || "",
      d.issueDescription || "",
      "",
      "",
      "",
      "Submitted",
      d.customerPhone || "",
      d.customerEmail || "",
      d.customerAddress || "",
      d.notes || ""
    ];

    await appendWarrantyRow(process.env.GOOGLE_SHEET_ID, row);

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Warranty error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
