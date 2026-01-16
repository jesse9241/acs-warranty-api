// gen-token.js
require("dotenv").config();
const fs = require("fs");
const http = require("http");
const { google } = require("googleapis");
const open = require("open");

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]; // write access
const TOKEN_PATH = "token.json";
const CREDS_PATH = "oauth-client.json";

function loadCreds() {
  if (!fs.existsSync(CREDS_PATH)) {
    throw new Error(`Missing ${CREDS_PATH}`);
  }
  const raw = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8"));
  const web = raw.web || raw.installed;
  if (!web) throw new Error(`oauth-client.json must contain "web" or "installed"`);
  const { client_id, client_secret, redirect_uris } = web;
  if (!client_id || !client_secret || !redirect_uris?.length) {
    throw new Error("oauth-client.json missing client_id/client_secret/redirect_uris");
  }
  return { client_id, client_secret, redirect_uris };
}

async function main() {
  const { client_id, client_secret, redirect_uris } = loadCreds();

  // Use a local redirect so we can capture the code automatically.
  // If your oauth-client.json redirect_uris does not include this exact URL,
  // add it in Google Cloud Console (OAuth client) and re-download oauth-client.json.
  const REDIRECT_URI = "http://localhost:4000/oauth2callback";

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // forces refresh_token creation
  });

  console.log("\n🔑 Authorize this app by visiting this URL:\n");
  console.log(authUrl + "\n");

  // Start a tiny local server to receive the OAuth callback
  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url.startsWith("/oauth2callback")) {
        res.writeHead(404);
        return res.end();
      }

      const url = new URL(req.url, "http://localhost:4000");
      const code = url.searchParams.get("code");
      if (!code) {
        res.writeHead(400);
        return res.end("Missing code");
      }

      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);

      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("✅ Token saved. You can close this window.");

      console.log(`✅ Saved ${TOKEN_PATH}`);
      console.log("Now redeploy your Render service so it can use the new token.\n");

      server.close();
    } catch (err) {
      console.error("❌ Error exchanging code for token:", err?.message || err);
      res.writeHead(500);
      res.end("OAuth failed. Check console.");
      server.close();
    }
  });

  server.listen(4000, async () => {
    try {
      // Open browser automatically if possible
      await open(authUrl);
    } catch {
      // If open fails, user can copy/paste the URL
    }
    console.log("🌐 Waiting for OAuth callback on http://localhost:4000/oauth2callback ...\n");
  });
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
