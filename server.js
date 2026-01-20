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
 * INTERNAL AUTH GATE (PHASE 2 INTERNAL TOOLS)
 * Requires request header:
 *   X-ACS-KEY: <ACS_INTERNAL_KEY>
 ************************************************************/
function requireInternal(req, res, next) {
  const key = req.headers["x-acs-key"];
  if (!process.env.ACS_INTERNAL_KEY || key !== process.env.ACS_INTERNAL_KEY) {
    return res.status(401).send("Unauthorized");
  }
  next();
}

/************************************************************
 * QUICK HEALTH CHECK
 ************************************************************/
app.get("/ping", (req, res) => {
  res.json({ status: "ok", message: "Web app is live" });
});

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

// Quiet check (logs only if broken)
transporter.verify(err => {
  if (err) console.error("SMTP error:", err.message);
});

/************************************************************
 * EMAIL HELPERS
 ************************************************************/
async function sendCSEmail(data, rowNumber) {
  await transporter.sendMail({
    from: `"ACS Warranty" <${process.env.SMTP_USER}>`,
    to: "jesse@automotivecircuitsolutions.com",
    subject: `New Warranty Claim – Order ${data.originalOrderNumber || "N/A"}`,
    text:
      `New warranty claim submitted\n\n` +
      `Customer: ${data.customerName || ""}\n` +
      `Email: ${data.customerEmail || ""}\n` +
      `Phone: ${data.customerPhone || ""}\n\n` +
      `Source: ${data.source || ""}\n` +
      `Order #: ${data.originalOrderNumber || ""}\n` +
      `Warranty #: ${data.originalWarrantyNumber || ""}\n` +
      `Product: ${data.product || ""}\n` +
      `UPC: ${data.upc || ""}\n\n` +
      `Issue:\n${data.issueDescription || ""}\n\n` +
      `Sheet Row: ${rowNumber || ""}`
  });
}

async function sendCustomerEmail(data) {
  if (!data.customerEmail) return;

  await transporter.sendMail({
    from: `"Automotive Circuit Solutions" <${process.env.SMTP_USER}>`,
    to: data.customerEmail,
    subject: "We received your warranty claim",
    text:
      `Hello ${data.customerName || ""},\n\n` +
      `We’ve received your warranty claim and our team will review it shortly.\n\n` +
      `Order #: ${data.originalOrderNumber || ""}\n` +
      `Warranty #: ${data.originalWarrantyNumber || ""}\n` +
      `Product: ${data.product || ""}\n\n` +
      `Issue:\n${data.issueDescription || ""}\n\n` +
      `If any of this looks incorrect, please reply to this email.\n\n` +
      `Thank you,\nAutomotive Circuit Solutions`
  });
}

/************************************************************
 * WARRANTY SUBMISSION ENDPOINT (PHASE 1)
 * 1) Write to sheet via Apps Script
 * 2) Send CS notification email
 * 3) Send customer confirmation email
 ************************************************************/
app.post("/warranty", async (req, res) => {
  try {
    const r = await fetch(process.env.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });

    if (!r.ok) throw new Error(await r.text());
    const result = await r.json();

    // Emails only after sheet write succeeds
    await sendCSEmail(req.body, result.row);
    await sendCustomerEmail(req.body);

    res.json({ status: "ok", row: result.row || null });

  } catch (err) {
    console.error("Warranty submission failed:", err);
    res.status(500).json({ error: err.message });
  }
});

/************************************************************
 * PHASE 2 INTERNAL PROXY API
 * Server-side proxy so the Apps Script key is never exposed to browser JS.
 *
 * Requires:
 *   PHASE2_SCRIPT_URL
 *   PHASE2_KEY
 *
 * Request example:
 *   POST /internal/api/phase2
 *   Header: X-ACS-KEY: <ACS_INTERNAL_KEY>
 *   Body: { action:"lookup", originalOrderNumber:"335508" }
 ************************************************************/
app.post("/internal/api/phase2", requireInternal, async (req, res) => {
  try {
    const scriptUrl = process.env.PHASE2_SCRIPT_URL;
    const key = process.env.PHASE2_KEY;

    if (!scriptUrl) throw new Error("Missing env var PHASE2_SCRIPT_URL");
    if (!key) throw new Error("Missing env var PHASE2_KEY");

    const payload = {
      ...req.body,
      key
    };

    const r = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await r.json();
    res.json(data);

  } catch (err) {
    console.error("Phase 2 proxy error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

/************************************************************
 * PHASE 2 INTERNAL INTAKE PAGE
 * GET /internal/intake
 * Header required:
 *   X-ACS-KEY: <ACS_INTERNAL_KEY>
 ************************************************************/
app.get("/internal/intake", requireInternal, (req, res) => {
  res.send(`
    <html>
      <head>
        <title>ACS Warranty Intake</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 700px; margin: auto; }
          input, select, button { padding: 10px; margin: 6px 0; width: 100%; }
          .row { border: 1px solid #ddd; padding: 12px; border-radius: 10px; margin-top: 15px; }
          .ok { color: green; }
          .err { color: red; }
          .small { color: #666; font-size: 12px; margin-top: 6px; }
        </style>
      </head>
      <body>
        <h2>ACS Warranty – Receiving Intake</h2>
        <p class="small">
          Internal tool. Lookup by <b>Original Order #</b>, then update <b>Intake Stage</b>.
        </p>

        <label>Original Order #</label>
        <input id="order" placeholder="Enter order number" />

        <button onclick="lookup()">Lookup</button>

        <div id="result" class="row" style="display:none;">
          <div><b>Row:</b> <span id="rowNum"></span></div>
          <div><b>Status:</b> <span id="status"></span></div>

          <hr/>

          <label>Intake Stage</label>
          <select id="intakeStage">
            <option value="">(blank)</option>
            <option>Not Started</option>
            <option>In Intake</option>
            <option>Intake Complete</option>
          </select>

          <button onclick="save()">Save Intake Stage</button>

          <div id="msg"></div>
        </div>

        <script>
          let currentRow = null;

          async function lookup() {
            const order = document.getElementById("order").value.trim();
            if (!order) return alert("Enter an order number.");

            const r = await fetch("/internal/api/phase2", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "lookup", originalOrderNumber: order })
            });

            const data = await r.json();

            if (data.status === "not_found") {
              alert("No match found.");
              return;
            }

            if (data.status === "multiple") {
              alert("Multiple matches found — we’ll add a chooser next.");
              return;
            }

            if (data.status !== "ok") {
              alert("Error: " + (data.message || "Unknown"));
              return;
            }

            const match = data.matches[0];
            currentRow = match.row;

            document.getElementById("result").style.display = "block";
            document.getElementById("rowNum").innerText = match.row;
            document.getElementById("status").innerText = match.status || "";
            document.getElementById("intakeStage").value = match.intakeStage || "";
            document.getElementById("msg").innerHTML = "";
          }

          async function save() {
            if (!currentRow) return alert("Lookup a claim first.");

            const intakeStage = document.getElementById("intakeStage").value;

            const r = await fetch("/internal/api/phase2", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "update",
                row: currentRow,
                updates: { "Intake Stage": intakeStage }
              })
            });

            const data = await r.json();
            const msg = document.getElementById("msg");

            if (data.status === "ok") {
              msg.innerHTML = "<p class='ok'>Saved ✅</p>";
            } else {
              msg.innerHTML = "<p class='err'>Error: " + (data.message || "Unknown") + "</p>";
            }
          }
        </script>
      </body>
    </html>
  `);
});

/************************************************************
 * SERVER START
 ************************************************************/
app.listen(PORT, () => {
  console.log("🚀 ACS Warranty API running on port", PORT);
});
