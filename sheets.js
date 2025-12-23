// sheets.js — LOCKED FINAL VERSION

const fetch = require("node-fetch");

if (!process.env.APPS_SCRIPT_URL) {
  throw new Error("Missing environment variable: APPS_SCRIPT_URL");
}

async function appendWarrantyRow(row) {
  const response = await fetch(process.env.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ row })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apps Script error: ${text}`);
  }

  return true;
}

module.exports = { appendWarrantyRow };
