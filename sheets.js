// sheets.js — FINAL, Render-safe, Node 18+

async function appendWarrantyRow(data) {
  const scriptUrl = process.env.APPS_SCRIPT_URL;

  // 🔒 Hard validation (prevents silent failures forever)
  if (!scriptUrl || !scriptUrl.startsWith("https://")) {
    throw new Error(
      "APPS_SCRIPT_URL is missing or invalid. It must start with https://"
    );
  }
console.log("Posting to Apps Script URL:", process.env.APPS_SCRIPT_URL);

const response = await fetch(process.env.APPS_SCRIPT_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
});


  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apps Script error: ${text}`);
  }

  return await response.json();
}

module.exports = { appendWarrantyRow };
