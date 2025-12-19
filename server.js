require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const { appendWarrantyRow } = require("./sheets");
const { sendWarrantyEmail } = require("./email");

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Serve static files from /Public
app.use(express.static(path.join(__dirname, "Public")));

// ✅ ROOT ROUTE — THIS FIXES "Cannot GET /"
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "Public", "warranty.html"));
});

// ✅ Warranty submission endpoint
app.post("/warranty", async (req, res) => {
  try {
    const d = req.body;

    const row = [
      d.claimId || "",
      d.source || "",
      d.customerName || "",
      d.originalOrderNumber || "",
      "",
      d.originalOrderDate || "",
      d.originalWarrantyNumber || "",
      "",
      d.dateReceived || "",
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

    await appendWarrantyRow(process.env.GOOGLE_SHEET_ID, row);

    // Fire-and-forget email
    sendWarrantyEmail(d).catch(err =>
      console.error("Email failed:", err.message)
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Warranty submission error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Warranty API running on port ${PORT}`);
});
