/************************************************************
 * ACS Warranty API — server.js
 * Node 18+, Render-compatible
 ************************************************************/

const express = require("express");
const fetch = require("node-fetch");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;

/************************************************************
 * MIDDLEWARE
 ************************************************************/
app.use(express.json());
app.use(express.static("Public"));

/************************************************************
 * SMTP (GMAIL APP PASSWORD)
 ************************************************************/
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/************************************************************
 * EMAIL HELPER
 ************************************************************/
async function sendWarrantyEmail(data) {
  await transporter.sendMail({
    from: `"ACS Warranty" <${process.env.SMTP_USER}>`,
    to: "jesse@automotivecircuitsolutions.com",
    subject: `New Warranty – Order ${data.originalOrderNumber || "N/A"}`,
    text: `
New warranty submitted

Customer: ${data.customerName || ""}
Email: ${data.customerEmail || ""}
Phone: ${data.customerPhone || ""}

Source: ${data.source || ""}
Order #: ${data.originalOrderNumber || ""}
Warranty #: ${data.originalWarrantyNumber || ""}
Product: ${data.product || ""}

Issue:
${data.issueDescription || ""}
`
  });
}

/************************************************************
 * WARRANTY SUBMISSION ENDPOINT
 ************************************************************/
app.post("/warranty", async (req, res) => {
  try {
    console.log("📨 Warranty received:", req.body.customerEmail);

    const appsScriptRes = await fetch(process.env.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });

    if (!appsScriptRes.ok) {
      const text = await appsScriptRes.text();
      throw new Error(`Apps Script error: ${text}`);
    }

    const result = await appsScriptRes.json();
    console.log("📄 Sheet write OK:", result);

    // ✅ SEND EMAIL AFTER SHEET WRITE
    await sendWarrantyEmail(req.body);
    console.log("📧 Warranty email sent");

    res.json({ status: "ok" });

  } catch (err) {
    console.error("❌ Warranty error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

/************************************************************
 * SERVER START
 ************************************************************/
app.listen(PORT, () => {
  console.log("🚀 Server listening on port", PORT);
});
