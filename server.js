// server.js – Render-ready, serves UI + API + email

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const { appendWarrantyRow } = require("./sheets");
const { sendWarrantyEmail } = require("./email");

const app = express();

/* =======================
   MIDDLEWARE
======================= */
app.use(cors());
app.use(express.json());

/* =======================
   STATIC FILES
   (Public/warranty.html)
======================= */
app.use(express.static("Public"));

/* =======================
   ROOT ROUTE
   Serves the form
======================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "Public", "warranty.html"));
});

/* =======================
   API ROUTE
   Warranty submission
======================= */
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
      "", // Technician Assigned
      d.upc || "",
      d.replacementTracking || "",
      d.status || "Submitted",
      d.customerPhone || "",
      d.customerEmail || "",
      d.customerAddress || "",
      d.notes || ""
    ];

    // Save to Google Sheets
    await appendWarrantyRow(process.env.GOOGLE_SHEET_ID, row);

    // Send email notification (non-blocking)
    sendWarrantyEmail(d).catch(err =>
      console.error("Email failed:", err.message)
    );

    res.json({
      success: true,
      message: "Warranty claim submitted successfully."
    });

  } catch (err) {
    console.error("❌ Warranty submission error:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* =======================
   SERVER START
======================= */
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  if (process.env.RENDER_EXTERNAL_URL) {
    console.log(`🚀 Warranty API running on Render at: ${process.env.RENDER_EXTERNAL_URL}`);
  } else {
    console.log(`🚀 Warranty API running locally at: http://localhost:${PORT}`);
  }
});
