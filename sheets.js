// sheets.js
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const TOKEN_PATH = path.join(__dirname, "token.json");
const CREDENTIALS_PATH = path.join(__dirname, "oauth-client.json");

// Load OAuth Credentials
function loadCredentials() {
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
}

// Load Saved Token
function loadToken() {
  return JSON.parse(fs.readFileSync(TOKEN_PATH));
}

// Authenticate Google Sheets API
async function getSheetsClient() {
  const credentials = loadCredentials();
  const token = loadToken();

  const { client_id, client_secret, redirect_uris } = credentials.installed;

  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  auth.setCredentials(token);

  return google.sheets({ version: "v4", auth });
}

// Append row to Sheet
async function appendWarrantyRow(sheetId, values) {
  const sheets = await getSheetsClient();

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Sheet1!A:Z",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    resource: { values: [values] }
  });

  return response.data;
}

module.exports = { appendWarrantyRow };
