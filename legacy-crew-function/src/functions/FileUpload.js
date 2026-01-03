const { app } = require("@azure/functions");
const { ClientSecretCredential } = require("@azure/identity");
const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

/* -------------------- helpers -------------------- */

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function getGraphClient() {
  const credential = new ClientSecretCredential(
    requiredEnv("TENANT_ID"),
    requiredEnv("CLIENT_ID"),
    requiredEnv("CLIENT_SECRET")
  );

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () =>
        (await credential.getToken("https://graph.microsoft.com/.default")).token,
    },
  });
}

function sanitizeToken(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function utcTimestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}_${p(
    d.getUTCHours()
  )}-${p(d.getUTCMinutes())}-${p(d.getUTCSeconds())}`;
}

function detectCategory(name) {
  const n = String(name || "").toLowerCase();
  if (n.startsWith("vocals_")) return "vocals";
  if (n.startsWith("instrumental_")) return "instrumental";
  return "file";
}

/* -------------------- SharePoint folder logic (ID-based) -------------------- */

async function getDriveRoot(graph, driveId) {
  return await graph.api(`/drives/${driveId}/root`).select("id").get();
}

async function ensureChildFolder(graph, driveId, parentId, folderName) {
  const children = await graph
    .api(`/drives/${driveId}/items/${parentId}/children`)
    .select("id,name,folder")
    .top(999)
    .get();

  const existing = (children.value || []).find((c) => c.name === folderName);
  if (existing) return existing;

  return await graph.api(`/drives/${driveId}/items/${parentId}/children`).post({
    name: folderName,
    folder: {},
    "@microsoft.graph.conflictBehavior": "fail",
  });
}

/* -------------------- upload logic -------------------- */

async function uploadChunked(uploadUrl, file) {
  let offset = 0;

  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = Buffer.from(await chunk.arrayBuffer());
    const end = offset + buffer.length - 1;

    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": buffer.length,
        "Content-Range": `bytes ${offset}-${end}/${file.size}`,
      },
      body: buffer,
    });

    if (!res.ok && res.status !== 202) {
      const text = await res.text();
      throw new Error(`Chunk upload failed (${res.status}): ${text}`);
    }

    offset += buffer.length;
  }
}

/* -------------------- HTTP function -------------------- */

app.http("FileUpload", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",

  handler: async (req, ctx) => {
    if (req.method === "OPTIONS") {
      return {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      };
    }

    try {
      const graph = getGraphClient();
      const driveId = requiredEnv("SHAREPOINT_DRIVE_ID");
      const rootFolderName =
        process.env.SHAREPOINT_ROOT_FOLDER || "Song Improvement Services";

      const form = await req.formData();
      const artistRaw = form.get("artistName");
      const files = form.getAll("files");

      if (!files.length) throw new Error("No files received");

      const artist = sanitizeToken(artistRaw) || "unknown_artist";
      const songBase = sanitizeToken(
        files[0].name.replace(/\.[^/.]+$/, "")
      ) || "project";

      const projectFolderName = `${artist}_${songBase}_${utcTimestamp()}`;

      /* ---------- ensure folders ---------- */

      const driveRoot = await getDriveRoot(graph, driveId);
      const serviceRoot = await ensureChildFolder(
        graph,
        driveId,
        driveRoot.id,
        rootFolderName
      );

      const projectFolder = await ensureChildFolder(
        graph,
        driveId,
        serviceRoot.id,
        projectFolderName
      );

      /* ---------- upload files ---------- */

      const counters = { vocals: 0, instrumental: 0, file: 0 };
      const uploaded = [];

      for (const f of files) {
        const original = f.name;
        const category = detectCategory(original);
        counters[category]++;

        const ext = original.match(/\.[^/.]+$/)?.[0] || "";
        const finalName = `${category}_V${counters[category]}${ext}`;

        ctx.log(
          `Uploading ${original} → ${rootFolderName}/${projectFolderName}/${finalName}`
        );

        const session = await graph
          .api(
            `/drives/${driveId}/items/${projectFolder.id}:/${finalName}:/createUploadSession`
          )
          .post({});

        await uploadChunked(session.uploadUrl, f);

        uploaded.push({
          originalName: original,
          savedAs: finalName,
          category,
          version: counters[category],
          sizeBytes: f.size,
        });
      }

      /* ---------- manifest ---------- */

      const manifest = {
        submittedAtUTC: new Date().toISOString(),
        projectFolder: projectFolderName,
        files: uploaded,
        rules: {
          singleFolder: true,
          noSubfolders: true,
          versioning: "category_V#",
        },
      };

      await graph
        .api(
          `/drives/${driveId}/items/${projectFolder.id}:/project_manifest.json:/content`
        )
        .header("Content-Type", "application/json")
        .put(JSON.stringify(manifest, null, 2));

      return {
        status: 200,
        jsonBody: {
          ok: true,
          projectFolder: projectFolderName,
          uploadedCount: uploaded.length,
        },
        headers: { "Access-Control-Allow-Origin": "*" },
      };
    } catch (err) {
      ctx.error("FileUpload failed:", err);
      return {
        status: 500,
        jsonBody: { ok: false, error: err.message },
        headers: { "Access-Control-Allow-Origin": "*" },
      };
    }
  },
});
