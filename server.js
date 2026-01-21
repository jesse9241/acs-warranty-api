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
  res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ACS Warranty – Receiving Intake</title>
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
  <p class="small">Lookup by <b>Original Order #</b> → Update <b>Intake Stage</b> + auto-assign <b>Internal Warranty #</b></p>

  <label>Original Order #</label>
  <input id="order" placeholder="Enter order number" />
  <button onclick="lookup()">Lookup</button>

  <div id="result" class="row" style="display:none;">
    <div><b>Row:</b> <span id="rowNum"></span></div>
    <div><b>Status:</b> <span id="status"></span></div>
    <div><b>Internal Warranty #:</b> <span id="iwNum">(blank)</span></div>
    <hr/>

    <label>Intake Stage</label>
    <select id="intakeStage">
      <option value=""></option>
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

  if (data.status === "not_found") return alert("No match found.");
  if (data.status === "multiple") return alert("Multiple matches found — chooser coming next.");
  if (data.status !== "ok") return alert("Error: " + (data.message || "Unknown"));

  const match = data.matches[0];
  currentRow = match.row;

  document.getElementById("result").style.display = "block";
  document.getElementById("rowNum").innerText = match.row;
  document.getElementById("status").innerText = match.status || "";
  document.getElementById("iwNum").innerText = match.internalWarrantyNumber || "(blank)";
  document.getElementById("intakeStage").value = match.intakeStage || "";
  document.getElementById("msg").innerHTML = "";
}

async function save() {
  if (!currentRow) return alert("Lookup a claim first.");

  const intakeStage = document.getElementById("intakeStage").value;

  // 1) Update Intake Stage
  const r1 = await fetch("/internal/api/phase2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "update",
      row: currentRow,
      updates: { "Intake Stage": intakeStage }
    })
  });

  const data1 = await r1.json();
  if (data1.status !== "ok") {
    document.getElementById("msg").innerHTML =
      "<p class='err'>Error saving Intake Stage: " + (data1.message || "Unknown") + "</p>";
    return;
  }

  // 2) Assign Internal Warranty # (only fills if blank)
  const r2 = await fetch("/internal/api/phase2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "assignInternalWarranty",
      row: currentRow
    })
  });

  const data2 = await r2.json();
  if (data2.status === "ok" && data2.internalWarrantyNumber) {
    document.getElementById("iwNum").innerText = data2.internalWarrantyNumber;
  }

  document.getElementById("msg").innerHTML = "<p class='ok'>Saved ✅</p>";
}
</script>
</body>
</html>`);
});
app.get("/internal/production", requireInternal, (req, res) => {
  res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ACS Warranty – Production</title>
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
  <h2>ACS Warranty – Production</h2>
  <p class="small">Lookup by <b>Original Order #</b> → Update <b>Production Stage</b></p>

  <label>Original Order #</label>
  <input id="order" placeholder="Enter order number" />
  <button onclick="lookup()">Lookup</button>

  <div id="result" class="row" style="display:none;">
    <div><b>Row:</b> <span id="rowNum"></span></div>
    <div><b>Status:</b> <span id="status"></span></div>
    <div><b>Original Warranty #:</b> <span id="owNum">(blank)</span></div>
    <div><b>Internal Warranty #:</b> <span id="iwNum">(blank)</span></div>

    <hr/>

    <label>Production Stage</label>
    <select id="productionStage">
      <option value=""></option>
      <option>Que</option>
      <option>Queued</option>
      <option>Complete</option>
    </select>

    <button onclick="save()">Save Production Stage</button>
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
  const ow =
  match.originalWarrantyNumber ||
  match.originalWarranty ||
  match["Original Warranty #"] ||
  "";

document.getElementById("owNum").innerText = ow ? ow : "(blank)";

  document.getElementById("iwNum").innerText = match.internalWarrantyNumber || "(blank)";
  document.getElementById("productionStage").value = match.productionStage || "";
  document.getElementById("msg").innerHTML = "";
}

async function save() {
  if (!currentRow) return alert("Lookup a claim first.");

  const productionStage = document.getElementById("productionStage").value;

  const r = await fetch("/internal/api/phase2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "update",
      row: currentRow,
      updates: { "Production Stage": productionStage }
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
 * INTERNAL PAGE: QC (auto-load reason codes from Apps Script)
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
      <option value="">Loading…</option>
    </select>

    <label>QC Failure Notes</label>
    <textarea id="qcFailureNotes" placeholder="What failed and why?"></textarea>

    <button onclick="save()">Save QC</button>
    <div id="msg"></div>
  </div>

<script>
let currentRow = null;

async function loadReasons(selected = "") {
  const dropdown = document.getElementById("qcReasonCode");

  // clear dropdown immediately
  dropdown.innerHTML = "<option value=''></option>";

  const r = await fetch("/internal/api/phase2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "qcreasons" })
  });

  const data = await r.json();

  if (data.status !== "ok") {
    dropdown.innerHTML = "<option value=''>ERROR LOADING LIST</option>";
    return;
  }

  (data.reasons || []).forEach(reason => {
    const opt = document.createElement("option");
    opt.value = reason;
    opt.textContent = reason;
    dropdown.appendChild(opt);
  });

  dropdown.value = selected || "";
}


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
  document.getElementById("owNum").innerText = match.originalWarrantyNumber || "(blank)";
  document.getElementById("iwNum").innerText = match.internalWarrantyNumber || "(blank)";

  document.getElementById("qcResult").value = match.qcResult || "";
  document.getElementById("qcFailureNotes").value = match.qcFailureNotes || "";
  await loadReasons(match.qcReasonCode || "");

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
