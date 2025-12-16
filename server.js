// ======================================================
//  WARRANTY API - CLEAN SERVER FILE
// ======================================================

// ---------------------------
// Imports
// ---------------------------
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const sheets = require("./sheets");
require("dotenv").config();

// ---------------------------
// Express Setup
// ---------------------------
const app = express();
app.use(cors());
app.use(express.json());
// Serve static files from the "public" folder
app.use(express.static("public"));

// ---------------------------
// File Paths
// ---------------------------
const TOKEN_PATH = path.join(__dirname, "token.json");
const CREDENTIALS_PATH = path.join(__dirname, "oauth-client.json");

// ---------------------------
// Load OAuth Client Credentials
// ---------------------------
function loadCredentials() {
  try {
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  } catch (err) {
    console.error("❌ ERROR: oauth-client.json is missing!");
    process.exit(1);
  }
}

// ---------------------------
// Authorize Google Client
// ---------------------------
async function authorize() {
  const credentials = loadCredentials();

  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2 = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // If token already exists → use it
  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
    return oAuth2;
  }

  // Otherwise request new user authorization
  const authUrl = oAuth2.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  console.log("\n--------------------------------------------------");
  console.log("⚠️  No Google token found — authentication required.");
  console.log("👉 Open this URL in your browser:");
  console.log(authUrl);
  console.log("--------------------------------------------------\n");

  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    readline.question("Enter the code from the browser: ", async (code) => {
      readline.close();

      const { tokens } = await oAuth2.getToken(code);
      oAuth2.setCredentials(tokens);

      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
      console.log("✔ Token saved to token.json\n");

      resolve(oAuth2);
    });
  });
}

// ======================================================
//  GOOGLE SHEETS APPEND FUNCTION
// ======================================================
async function appendWarrantyRow(sheetId, rowValues) {
  const auth = await authorize();
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Warranty Lookup!A:Z",
    valueInputOption: "RAW",
    resource: {
      values: [rowValues],
    },
  });

  console.log("✔ Row added to Google Sheet");
}

// ======================================================
//  TEST ROUTE
// ======================================================
app.get("/", (req, res) => {
  res.send("Warranty API is running!");
});

// ======================================================
//  WARRANTY SUBMISSION ENDPOINT
// ======================================================
app.post("/warranty", async (req, res) => {
  try {
    const d = req.body;

    // Map incoming form data to Google Sheet row format
const row = [
  d.claimId || "",                    // 1 Claim ID
  d.source || "",                     // 2 Source
  d.customerName || "",               // 3 Customer Name
  d.originalOrderNumber || "",        // 4 Original Order #
  "",                                 // 5 Original Order (ALWAYS BLANK)
  d.originalOrderDate || "",          // 6 Original order date
  d.originalWarrantyNumber || "",     // 7 Original Warranty #
  d.previousWarrantyDate || "",       // 8 Previous warranty claim date
  d.dateReceived || "",               // 9 Date Received
  d.newOrderNumber || "",             // 10 New Order #
  d.newWarrantyNumber || "",          // 11 New Warranty #
  d.product || "",                    // 12 Product
  d.issueDescription || "",           // 13 Issue Description
  null,                               // 14 Technician Assigned (KEEP DROPDOWN IN SHEET)
  d.upc || "",                        // 15 UPC
  d.replacementTracking || "",        // 16 Replacement Tracking Number
  d.status || "Submitted",            // 17 Status
  d.customerPhone || "",              // 18 Customer Phone
  d.customerEmail || "",              // 19 Customer Email
  d.customerAddress || "",            // 20 Customer Address
  d.notes || ""                       // 21 Notes
];

    await appendWarrantyRow(process.env.GOOGLE_SHEET_ID, row);

    res.json({ success: true, message: "Warranty submitted successfully." });
  } catch (err) {
    console.error("❌ Warranty submission error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ======================================================
//  SERVER START
// ======================================================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n🚀 Warranty API running at: http://localhost:${PORT}\n`);
});
