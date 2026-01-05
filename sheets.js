async function appendWarrantyRow(data) {
  const scriptUrl = process.env.APPS_SCRIPT_URL;

  if (!scriptUrl || !scriptUrl.startsWith("https://")) {
    throw new Error(
      "APPS_SCRIPT_URL is missing or invalid. It must start with https://"
    );
  }

  console.log("Posting to Apps Script URL:", scriptUrl);

  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data) // ✅ FIX
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apps Script error: ${text}`);
  }

  return await response.json();
}

module.exports = { appendWarrantyRow };
