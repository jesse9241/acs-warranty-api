require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const { appendWarrantyRow } = require("./sheets");
const { sendWarrantyEmail } = require("./email");

const app = express();

app.use(cors());
app.use(express.json());

console.log("🔥 SERVER.JS LOADED");

/* =========================
   FORCE ROOT PAGE
========================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "Public", "index.html"));
});

/* =========================
   Health Check
========================= */
app.get("/health", (req, res) => {
  res.send("Server is responding");
});

/* =========================
   Warranty API
========================= */
app.post("/warranty", async (req, res) => {
  try {
    const d = req.body;

    const row = [
      "",
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

    await appendWarrantyRow(process.env.GOOGLE_SHEET_ID, row);
    sendWarrantyEmail(d).catch(() => {});

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* =========================
   Start Server
========================= */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Warranty API running on port ${PORT}`);
});
