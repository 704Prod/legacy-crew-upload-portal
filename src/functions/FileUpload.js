const { app } = require("@azure/functions");

app.http("FileUpload", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
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

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return { status: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: "Expected multipart/form-data" };
    }

    const form = await request.formData();
    const file = form.get("files"); // your front-end must send "files"
    if (!file || !file.arrayBuffer) {
      return { status: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: "No file provided (field name must be 'files')" };
    }

    const tenant = process.env.TENANT_ID;
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const siteId = process.env.SHAREPOINT_SITE_ID;
    const folderId = process.env.SHAREPOINT_FOLDER_ID;

    if (!tenant || !clientId || !clientSecret || !siteId || !folderId) {
      return { status: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: "Missing SharePoint/Graph app settings" };
    }

    // 1) Get Graph token (client credentials)
    const tokenResp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    });
    const tokenJson = await tokenResp.json();
    if (!tokenResp.ok) {
      context.log("Token error:", tokenJson);
      return { status: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: "Failed to get Graph token" };
    }
    const headers = { Authorization: `Bearer ${tokenJson.access_token}` };

    // 2) Get Documents drive id
    const drivesResp = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drives?$select=id,name`, { headers });
    const drivesJson = await drivesResp.json();
    if (!drivesResp.ok) {
      context.log("Drives error:", drivesJson);
      return { status: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: "Failed to read drives" };
    }
    const documentsDrive = (drivesJson.value || []).find(d => d.name === "Documents");
    if (!documentsDrive) {
      return { status: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: "Documents drive not found" };
    }

    // 3) Upload (simple upload <= ~4MB recommended; your WAV might exceed that—this will still try)
    const bytes = Buffer.from(await file.arrayBuffer());
    const fileName = file.name || "upload.bin";

    const uploadUrl =
      `https://graph.microsoft.com/v1.0/drives/${documentsDrive.id}/items/${folderId}:/${encodeURIComponent(fileName)}:/content`;

    const upResp = await fetch(uploadUrl, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/octet-stream" },
      body: bytes,
    });
    const upJson = await upResp.json().catch(() => ({}));
    if (!upResp.ok) {
      context.log("Upload error:", upJson);
      return { status: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: "SharePoint upload failed" };
    }

    return {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, name: upJson.name, id: upJson.id }),
    };
  },
});
