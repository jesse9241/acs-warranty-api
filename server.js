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
 * Accepts either:
 *  - Header:   X-ACS-KEY: <ACS_INTERNAL_KEY>
 *  - Cookie:   acs_internal_key=<ACS_INTERNAL_KEY>
 ************************************************************/
function requireInternal(req, res, next) {
  const expected = process.env.ACS_INTERNAL_KEY;
  if (!expected) return res.status(401).send("Unauthorized");

  const headerKey = req.headers["x-acs-key"];

  const cookie = req.headers.cookie || "";
  const cookieKey = cookie
    .split(";")
    .map(x => x.trim())
    .find(x => x.startsWith("acs_internal_key="));

  const cookieVal = cookieKey ? cookieKey.split("=")[1] : null;

  if (headerKey === expected || cookieVal === expected) return next();
  return res.status(401).send("Unauthorized");
}

/************************************************************
 * QUICK HEALTH CHECK
 ************************************************************/
app.get("/ping", (req, res) => {
  res.json({ status: "ok", message: "Web app is live" });
});

/************************************************************
 * INTERNAL LOGIN HELPER (TEMP)
 * Visit once:
 *   /internal/login
 ************************************************************/
app.get("/internal/login", (req, res) => {
  res.setHeader(
    "Set-Cookie",
    `acs_internal_key=${process.env.ACS_INTERNAL_KEY}; Path=/; Max-Age=86400; SameSite=Lax`
  );
  res.send("Logged in ✅ You can now open /internal/intake");
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
 * Keeps Apps Script key server-side (not exposed in browser JS)
 ************************************************************/
app.post("/internal/api/phase2", requireInternal, async (req, res) => {
  try {
    const scriptUrl = process.env.PHASE2_SCRIPT_URL;
    const key = process.env.PHASE2_KEY;

    if (!scriptUrl) throw new Error("Missing env var PHASE2_SCRIPT_URL");
    if (!key) throw new Error("Missing env var PHASE2_KEY");

    const payload = { ...req.body, key };

    const r = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await r.text();

    try {
      const data = JSON.parse(text);
      return res.json(data);
    } catch (jsonErr) {
      console.error("Phase 2 proxy returned non-JSON:", text.slice(0, 600));
      return res.status(500).json({
        status: "error",
        message: "Phase 2 Apps Script did not return JSON (HTML returned).",
        preview: text.slice(0, 600)
      });
    }

  } catch (err) {
    console.error("Phase 2 proxy error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

/************************************************************
 * INTERNAL PAGE HTML GENERATOR (Intake/Production)
 ************************************************************/
function getInternalPageHtml(cfg) {
  const optionHtml = cfg.options.map(v => `<option>${v}</option>`).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${cfg.title}</title>
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
  <h2>${cfg.title}</h2>
  <p class="small">Lookup by <b>Original Order #</b> → Update <b>${cfg.stageLabel}</b></p>

  <label>Original Order #</label>
  <input id="order" placeholder="Enter order number" />
  <button onclick="lookup()">Lookup</button>

  <div id="result" class="row" style="display:none;">
    <div><b>Row:</b> <span id="rowNum"></span></div>
    <div><b>Status:</b> <span id="status"></span></div>
    <hr/>

    <label>${cfg.stageLabel}</label>
    <select id="${cfg.stageId}">
      ${optionHtml}
    </select>

    <button onclick="save()">${cfg.buttonText}</button>
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

  if (data.status === "not_found") return alert("No match found.");
  if (data.status === "multiple") return alert("Multiple matches found — chooser coming next.");
  if (data.status !== "ok") return alert("Error: " + (data.message || "Unknown"));

  const match = data.matches[0];
  currentRow = match.row;

  document.getElementById("result").style.display = "block";
  document.getElementById("rowNum").innerText = match.row;
  document.getElementById("status").innerText = match.status || "";
  document.getElementById("${cfg.stageId}").value = match["${cfg.matchField}"] || "";
  document.getElementById("msg").innerHTML = "";
}

async function save() {
  if (!currentRow) return alert("Lookup a claim first.");

  const val = document.getElementById("${cfg.stageId}").value;

  const r = await fetch("/internal/api/phase2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "update",
      row: currentRow,
      updates: { "${cfg.updateHeader}": val }
    })
  });

  const data = await r.json();
  const msg = document.getElementById("msg");

  msg.innerHTML = (data.status === "ok")
    ? "<p class='ok'>Saved ✅</p>"
    : "<p class='err'>Error: " + (data.message || "Unknown") + "</p>";
}
</script>
</body>
</html>`;
}

/************************************************************
 * INTERNAL PAGES: INTAKE + PRODUCTION
 ************************************************************/
app.get("/internal/intake", requireInternal, (req, res) => {
  res.send(getInternalPageHtml({
    title: "ACS Warranty – Receiving Intake",
    stageLabel: "Intake Stage",
    stageId: "intakeStage",
    options: ["", "Not Started", "In Intake", "Intake Complete"],
    matchField: "intakeStage",
    updateHeader: "Intake Stage",
    buttonText: "Save Intake Stage"
  }));
});

app.get("/internal/production", requireInternal, (req, res) => {
  res.send(getInternalPageHtml({
    title: "ACS Warranty – Production",
    stageLabel: "Production Stage",
    stageId: "productionStage",
    options: ["", "Que", "Queued", "Complete"],
    matchField: "productionStage",
    updateHeader: "Production Stage",
    buttonText: "Save Production Stage"
  }));
});

/************************************************************
 * INTERNAL PAGE: QC (Reason Code dropdown)
 ************************************************************/
app.get("/internal/qc", requireInternal, (req, res) => {
  res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ACS Warranty – QC</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 750px; margin: auto; }
    input, select, textarea, button { padding: 10px; margin: 6px 0; width: 100%; }
    textarea { min-height: 90px; }
    .row { border: 1px solid #ddd; padding: 12px; border-radius: 10px; margin-top: 15px; }
    .ok { color: green; }
    .err { color: red; }
    .small { color: #666; font-size: 12px; margin-top: 6px; }
  </style>
</head>
<body>
  <h2>ACS Warranty – QC</h2>
  <p class="small">Lookup by <b>Original Order #</b> → Update <b>QC Result / Reason / Notes</b></p>

  <label>Original Order #</label>
  <input id="order" placeholder="Enter order number" />
  <button onclick="lookup()">Lookup</button>

  <div id="result" class="row" style="display:none;">
    <div><b>Row:</b> <span id="rowNum"></span></div>
    <div><b>Status:</b> <span id="status"></span></div>
    <hr/>

    <label>QC Result</label>
    <select id="qcResult">
      <option value="">(blank)</option>
      <option>Pass</option>
      <option>Fail</option>
    </select>

    <label>AE: QC Reason Code</label>
    <select id="qcReasonCode">
      <option value="">(blank)</option>
      <option>NO ISSUE FOUND</option>
      <option>INTERMITTENT</option>
      <option>NO POWER</option>
      <option>WRONG PART / MISLABEL</option>
      <option>CONNECTOR DAMAGE</option>
      <option>PIN PUSHED / BENT</option>
      <option>SOLDER JOINT</option>
      <option>COMPONENT FAILURE</option>
      <option>SHORT / BURN</option>
      <option>PROGRAM / FIRMWARE</option>
      <option>USER ERROR / INSTALL</option>
      <option>WATER / CORROSION</option>
      <option>PHYSICAL DAMAGE</option>
      <option>OTHER</option>
    </select>

    <label>QC Failure Notes</label>
    <textarea id="qcFailureNotes" placeholder="What failed and why?"></textarea>

    <button onclick="save()">Save QC</button>
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

  if (data.status === "not_found") return alert("No match found.");
  if (data.status === "multiple") return alert("Multiple matches found — chooser coming next.");
  if (data.status !== "ok") return alert("Error: " + (data.message || "Unknown"));

  const match = data.matches[0];
  currentRow = match.row;

  document.getElementById("result").style.display = "block";
  document.getElementById("rowNum").innerText = match.row;
  document.getElementById("status").innerText = match.status || "";

  document.getElementById("qcResult").value = match.qcResult || "";
  document.getElementById("qcReasonCode").value = match.qcReasonCode || "";
  document.getElementById("qcFailureNotes").value = match.qcFailureNotes || "";

  document.getElementById("msg").innerHTML = "";
}

async function save() {
  if (!currentRow) return alert("Lookup a claim first.");

  const qcResult = document.getElementById("qcResult").value;
  const qcReasonCode = document.getElementById("qcReasonCode").value;
  const qcFailureNotes = document.getElementById("qcFailureNotes").value.trim();

  const r = await fetch("/internal/api/phase2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "update",
      row: currentRow,
      updates: {
        "QC Result": qcResult,
        "AE: QC Reason Code": qcReasonCode,
        "QC Failure Notes": qcFailureNotes
      }
    })
  });

  const data = await r.json();
  const msg = document.getElementById("msg");

  msg.innerHTML = (data.status === "ok")
    ? "<p class='ok'>Saved ✅</p>"
    : "<p class='err'>Error: " + (data.message || "Unknown") + "</p>";
}
</script>
</body>
</html>`);
});

/************************************************************
 * SERVER START
 ************************************************************/
app.listen(PORT, () => {
  console.log("🚀 ACS Warranty API running on port", PORT);
});
