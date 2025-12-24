// sheets.js
const fetch = require("node-fetch");
const { google } = require("googleapis");

async function appendWarrantyRow(data) {
  if (!process.env.APPS_SCRIPT_URL) {
    throw new Error("Missing APPS_SCRIPT_URL environment variable");
  }

  const response = await fetch(process.env.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apps Script error: ${text}`);
  }

  return await response.json();
}

module.exports = { appendWarrantyRow };
