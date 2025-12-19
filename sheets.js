// sheets.js – Render-ready version

const { google } = require("googleapis");

/**
 * Loads OAuth credentials from environment variables
 * (OAUTH_CREDENTIALS_JSON and TOKEN_JSON)
 */
function getAuth() {
  if (!process.env.OAUTH_CREDENTIALS_JSON) {
    throw new Error("Missing OAUTH_CREDENTIALS_JSON env variable.");
  }
  if (!process.env.TOKEN_JSON) {
    throw new Error("Missing TOKEN_JSON env variable.");
  }

  const credentials = JSON.parse(process.env.OAUTH_CREDENTIALS_JSON);
  const token = JSON.parse(process.env.TOKEN_JSON);

  const { client_secret, client_id, redirect_uris } = credentials.web;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}

/**
 * Appends a row to Google Sheets
 */
async function appendWarrantyRow(spreadsheetId, rowValues) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Warranty Lookup!A1",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [rowValues],
    },
  });

  return response.data;
}

module.exports = {
  appendWarrantyRow
};
