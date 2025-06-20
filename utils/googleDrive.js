const { google } = require('googleapis');
const fs = require('fs');

let drive = null;

const initializeGoogleDrive = () => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://objekt-pro.at/auth/callback'
    );

    if (process.env.GOOGLE_REFRESH_TOKEN) {
      oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    }

    drive = google.drive({ version: 'v3', auth: oauth2Client });
    console.log('✅ Google Drive initialisiert');
    return true;
  } catch (error) {
    console.error('❌ Google Drive Fehler:', error.message);
    return false;
  }
};

const uploadMultipleFiles = async (files, folderId) => {
  if (!drive) return { success: false, error: 'Google Drive nicht initialisiert' };

  const results = { total: files.length, success: 0, failed: 0, uploads: [] };

  for (const file of files) {
    try {
      const fileMetadata = { name: file.originalname };
      if (folderId) fileMetadata.parents = [folderId];

      const response = await drive.files.create({
        resource: fileMetadata,
        media: { body: fs.createReadStream(file.path) },
        fields: 'id,name,size'
      });

      results.success++;
      results.uploads.push({ originalName: file.originalname, googleDriveId: response.data.id });
    } catch (error) {
      results.failed++;
    }
  }

  return results;
};

module.exports = { initializeGoogleDrive, uploadMultipleFiles };