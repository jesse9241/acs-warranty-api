// server.js – Render-ready version

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { appendWarrantyRow } = require("./sheets");

const app = express();
app.use(cors());
app.use(express.json());

// Serves warranty.html from /Public for local testing
app.use(express.static("Public"));

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
      "", // Technician assigned
      d.upc || "",
      d.replacementTracking || "",
      d.status || "Submitted",
      d.customerPhone || "",
      d.customerEmail || "",
      d.customerAddress || "",
      d.notes || ""
    ];

    await appendWarrantyRow(process.env.GOOGLE_SHEET_ID, row);

    res.json({ success: true, message: "Warranty submitted successfully." });

  } catch (err) {
    console.error("❌ Warranty submission error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  const isRender = process.env.RENDER === "true" || process.env.RENDER_EXTERNAL_URL;

  if (isRender) {
    console.log(`🚀 Warranty API running on Render at: ${process.env.RENDER_EXTERNAL_URL}`);
  } else {
    console.log(`🚀 Warranty API running locally at: http://localhost:${PORT}`);
  }
});
