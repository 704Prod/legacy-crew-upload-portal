const { app } = require('@azure/functions');
const { ClientSecretCredential } = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');
const Busboy = require('busboy');
const path = require('path');

// Initialize Graph client
const credential = new ClientSecretCredential(
    process.env.TENANT_ID,
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET
);

const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default']
});

const graphClient = Client.initWithMiddleware({
    authProvider: authProvider
});

app.http('FileUpload', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // Handle CORS
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            };
        }

        try {
            // Parse multipart form data
            const { fields, files } = await parseMultipartForm(request);
            
            // Validate required fields
            const requiredFields = ['artistName', 'songTitle', 'serviceType'];
            for (const field of requiredFields) {
                if (!fields[field]) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }

            // Create timestamp for folder name
            const now = new Date();
            const timestamp = now.toISOString()
                .replace(/T/, '_')
                .replace(/:/g, '-')
                .replace(/\..+/, '');
            
            // Create project folder name
            const folderName = `${fields.artistName}_${fields.songTitle}_${timestamp}`;
            
            // Get SharePoint drive
            const driveId = await getDriveId();
            
            // Create project folder in Song Improvement Services
            const folder = await graphClient
                .api(`/drives/${driveId}/root:/Song Improvement Services/${folderName}:/children`)
                .put({
                    name: 'temp.txt',
                    content: 'temp'
                });
            
            // Process and upload files with versioning
            const categoryCounters = {};
            const uploadedFiles = {};
            
            for (const file of files) {
                // Extract category from filename prefix (vocals_, instrumental_, etc.)
                const originalPrefix = file.filename.split('_')[0];
                
                // Count files per category for versioning
                if (!categoryCounters[originalPrefix]) {
                    categoryCounters[originalPrefix] = 0;
                    uploadedFiles[originalPrefix] = [];
                }
                categoryCounters[originalPrefix]++;
                
                // Create versioned filename
                const extension = path.extname(file.filename.split('_').slice(1).join('_'));
                const newFilename = `${originalPrefix}_V${categoryCounters[originalPrefix]}${extension}`;
                
                // Upload file to project folder
                await graphClient
                    .api(`/drives/${driveId}/root:/Song Improvement Services/${folderName}/${newFilename}:/content`)
                    .put(file.data);
                
                uploadedFiles[originalPrefix].push(newFilename);
            }
            
            // Create manifest JSON
            const manifest = {
                service: fields.serviceType.toLowerCase(),
                mode: fields.mode || 'basic',
                artist: fields.artistName,
                song: fields.songTitle,
                email: fields.email,
                phone: fields.phone,
                bpm: fields.bpm,
                key: fields.key,
                notes: fields.notes,
                submittedAt: now.toISOString(),
                payment: {
                    amount: fields.totalPrice,
                    paymentId: fields.paymentIntentId,
                    status: fields.paymentStatus
                },
                files: uploadedFiles
            };
            
            // Save manifest to project folder
            await graphClient
                .api(`/drives/${driveId}/root:/Song Improvement Services/${folderName}/project_manifest.json:/content`)
                .put(JSON.stringify(manifest, null, 2));
            
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: true,
                    message: 'Files uploaded successfully',
                    projectFolder: folderName,
                    filesUploaded: Object.values(uploadedFiles).flat().length
                })
            };

        } catch (error) {
            console.error('Upload error:', error);
            return {
                status: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: false,
                    error: error.message
                })
            };
        }
    }
});

// Helper functions remain the same
async function getDriveId() {
    const site = await graphClient
        .api(`/sites/${process.env.SHAREPOINT_SITE_ID}`)
        .get();
    
    const drives = await graphClient
        .api(`/sites/${site.id}/drives`)
        .get();
    
    return drives.value[0].id;
}

async function parseMultipartForm(request) {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: { 'content-type': request.headers.get('content-type') } });
        const fields = {};
        const files = [];
        
        busboy.on('file', (fieldname, file, info) => {
            const { filename } = info;
            const chunks = [];
            
            file.on('data', (chunk) => chunks.push(chunk));
            file.on('end', () => {
                files.push({
                    fieldname,
                    filename,
                    data: Buffer.concat(chunks)
                });
            });
        });
        
        busboy.on('field', (fieldname, val) => {
            fields[fieldname] = val;
        });
        
        busboy.on('finish', () => resolve({ fields, files }));
        busboy.on('error', reject);
        
        const bodyBuffer = request.arrayBuffer ? 
            Buffer.from(await request.arrayBuffer()) : 
            Buffer.from(await request.text());
        busboy.write(bodyBuffer);
        busboy.end();
    });
}

module.exports = { FileUpload: app.http('FileUpload', handler) };
