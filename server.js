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
 * SMTP
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

transporter.verify(err => {
  if (err) console.error("SMTP error:", err.message);
});

/************************************************************
 * EXISTING WARRANTY SUBMIT (UNCHANGED)
 ************************************************************/
app.post("/warranty", async (req, res) => {
  try {
    const r = await fetch(process.env.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });

    if (!r.ok) throw new Error(await r.text());
    await r.json();

    res.json({ status: "ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/************************************************************
 * 🆕 STATUS UPDATE ENDPOINT (OPTION B)
 ************************************************************/
app.post("/warranty/status", async (req, res) => {
  const payload = {
    action: "updateStatus",
    lookupType: req.body.lookupType,   // "order" | "warranty"
    lookupValue: req.body.lookupValue,
    status: req.body.status,
    internalNotes: req.body.internalNotes || ""
  };

  try {
    const r = await fetch(process.env.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!r.ok) throw new Error(await r.text());
    const result = await r.json();

    // Send email ONLY if shipped
    if (req.body.status === "Shipped" && result.customerEmail) {
      await transporter.sendMail({
        from: `"ACS Warranty" <${process.env.SMTP_USER}>`,
        to: result.customerEmail,
        subject: "Your repair has shipped",
        text: `Hello ${result.customerName || ""},

Your repaired unit has shipped.

Order #: ${result.order || ""}
Warranty #: ${result.warranty || ""}

Thank you,
Automotive Circuit Solutions`
      });
    }

    res.json({ status: "ok", row: result.row });
  } catch (err) {
    console.error("STATUS UPDATE ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/************************************************************
 * SERVER START
 ************************************************************/
app.listen(PORT, () => {
  console.log("🚀 ACS Warranty API running on port", PORT);
});
