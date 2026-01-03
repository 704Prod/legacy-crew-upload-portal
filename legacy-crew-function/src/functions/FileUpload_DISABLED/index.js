const { app } = require("@azure/functions");

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const FOLDER_PATH = "Song Improvement Services"; // Documents library folder

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function getAccessToken() {
  const tenantId = requireEnv("TENANT_ID");
  const clientId = requireEnv("CLIENT_ID");
  const clientSecret = requireEnv("CLIENT_SECRET");

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("scope", GRAPH_SCOPE);
  body.set("grant_type", "client_credentials");

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Token request failed (${resp.status}): ${txt}`);
  }

  const json = await resp.json();
  return json.access_token;
}

async function createUploadSession(accessToken, siteId, fileName) {
  const safeName = encodeURIComponent(fileName).replace(/%2F/g, "_");
  const folder = encodeURIComponent(FOLDER_PATH).replace(/%2F/g, "/");

  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${folder}/${safeName}:/createUploadSession`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item: {
        "@microsoft.graph.conflictBehavior": "rename",
        name: fileName,
      },
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`createUploadSession failed (${resp.status}): ${txt}`);
  }

  const json = await resp.json();
  return json.uploadUrl;
}

async function uploadBytesToSession(uploadUrl, buffer) {
  const chunkSize = 5 * 1024 * 1024; // 5MB
  const total = buffer.length;

  let start = 0;
  while (start < total) {
    const end = Math.min(start + chunkSize, total);
    const chunk = buffer.subarray(start, end);

    const resp = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end - 1}/${total}`,
      },
      body: chunk,
    });

    // 202 = still uploading; 200/201 = finished
    if (!(resp.status === 202 || resp.status === 200 || resp.status === 201)) {
      const txt = await resp.text();
      throw new Error(`Upload chunk failed (${resp.status}): ${txt}`);
    }

    // When finished, Graph returns the DriveItem JSON
    if (resp.status === 200 || resp.status === 201) {
      return await resp.json();
    }

    start = end;
  }

  throw new Error("Upload did not complete (unexpected).");
}

app.http("FileUpload", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      };
    }

    try {
      const siteId = requireEnv("SHAREPOINT_SITE_ID"); // you already have this
      const contentType = request.headers.get("content-type") || "";

      if (!contentType.toLowerCase().includes("multipart/form-data")) {
        return {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: "Expected multipart/form-data (FormData).",
        };
      }

      const form = await request.formData();
      const files = form.getAll("files") || [];

      if (!files.length) {
        return {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
          body: JSON.stringify({ ok: false, error: "No files found in form field 'files'." }),
        };
      }

      const accessToken = await getAccessToken();

      const results = [];
      for (const f of files) {
        const ab = await f.arrayBuffer();
        const buf = Buffer.from(ab);

        context.log(`Uploading: ${f.name} (${buf.length} bytes) → SharePoint folder '${FOLDER_PATH}'`);

        const uploadUrl = await createUploadSession(accessToken, siteId, f.name);
        const driveItem = await uploadBytesToSession(uploadUrl, buf);

        results.push({
          name: driveItem.name,
          size: driveItem.size,
          webUrl: driveItem.webUrl,
          id: driveItem.id,
        });
      }

      return {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, uploaded: results }),
      };
    } catch (err) {
      context.log("FileUpload error:", err);
      return {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: String(err?.message || err) }),
      };
    }
  },
});
