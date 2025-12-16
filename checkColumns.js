require("dotenv").config();
const fs = require("fs");
const { google } = require("googleapis");

console.log("🚀 Script started! Loading env and files...");

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const RANGE = "'Warranty Lookup'!1:1"; // <-- FIXED here

if (!SHEET_ID) {
  console.error("❌ Missing GOOGLE_SHEET_ID in .env");
  process.exit(1);
}

let credentials, token;

try {
  credentials = JSON.parse(fs.readFileSync("oauth-client.json"));
  console.log("✔ Loaded oauth-client.json");
} catch {
  console.error("❌ ERROR: Missing oauth-client.json");
  process.exit(1);
}

try {
  token = JSON.parse(fs.readFileSync("token.json"));
  console.log("✔ Loaded token.json");
} catch {
  console.error("❌ ERROR: Missing token.json");
  process.exit(1);
}

async function run() {
  console.log("\n🔑 Building Google OAuth client...");
  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  auth.setCredentials(token);

  const sheets = google.sheets({ version: "v4", auth });

  console.log("📡 Fetching header row...");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGE,
  });

  const headers = res.data.values[0];
  console.log("\n📌 SHEET HEADERS FOUND:");
  headers.forEach((h, i) => console.log(`${i + 1}. ${h}`));

  console.log(`\nTotal columns: ${headers.length}`);
}

run().catch(err => console.error("❌ ERROR:", err));
