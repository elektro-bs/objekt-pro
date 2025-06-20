// backend/routes/files.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Upload-Verzeichnis erstellen
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer-Konfiguration für 100 Dateien
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Dateityp nicht erlaubt: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB pro Datei
    files: 100 // Max 100 Dateien
  },
  fileFilter: fileFilter
}).array('files', 100);

// Upload-Route für bis zu 100 Dateien
router.post('/upload/:anlageId', async (req, res) => {
  const { anlageId } = req.params;
  const userId = req.user?.userId || 1; // Development default

  upload(req, res, async function(err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: 'Datei zu groß (max 100MB)'
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(413).json({
          success: false,
          error: 'Zu viele Dateien (max 100)'
        });
      }
      return res.status(400).json({
        success: false,
        error: err.message
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }

    // Keine Dateien hochgeladen
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Keine Dateien hochgeladen'
      });
    }

    const batchId = 'batch-' + uuidv4();
    const startTime = Date.now();
    const pool = require('../db');

    try {
      const connection = await pool.getConnection();

      // Batch in DB erstellen
      await connection.execute(
          'INSERT INTO upload_batches (id, anlage_id, user_id, total_files, status) VALUES (?, ?, ?, ?, ?)',
          [batchId, anlageId, userId, req.files.length, 'processing']
      );

      const successfulFiles = [];
      const failedFiles = [];
      let totalSize = 0;

      // Jede Datei verarbeiten
      for (const file of req.files) {
        try {
          // In DB speichern
          const googleDriveId = 'gdrive-' + uuidv4(); // Placeholder für später

          await connection.execute(
              `INSERT INTO files (
              anlage_id, filename, original_filename, mimetype, 
              size, google_drive_file_id, batch_id, uploaded_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                anlageId, file.filename, file.originalname, file.mimetype,
                file.size, googleDriveId, batchId, userId
              ]
          );

          totalSize += file.size;
          successfulFiles.push({
            id: connection.lastInsertId,
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size
          });

        } catch (error) {
          console.error('Fehler beim Speichern der Datei:', error);
          failedFiles.push({
            filename: file.originalname,
            error: error.message
          });
        }
      }

      // Batch-Status aktualisieren
      await connection.execute(
          `UPDATE upload_batches 
         SET processed_files = ?, successful_files = ?, failed_files = ?, 
             status = 'completed', completed_at = NOW()
         WHERE id = ?`,
          [req.files.length, successfulFiles.length, failedFiles.length, batchId]
      );

      connection.release();

      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        batch: {
          id: batchId,
          total: req.files.length,
          successful: successfulFiles.length,
          failed: failedFiles.length
        },
        files: {
          successful: successfulFiles,
          failed: failedFiles
        },
        statistics: {
          total_size: totalSize,
          processing_time: processingTime,
          file_types: [...new Set(successfulFiles.map(f => f.mimetype.split('/')[0]))]
        }
      });

    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({
        success: false,
        error: 'Datenbankfehler: ' + error.message
      });
    }
  });
});

// Dateien einer Anlage abrufen
router.get('/:anlageId', async (req, res) => {
  const { anlageId } = req.params;

  try {
    const pool = require('../db');
    const connection = await pool.getConnection();

    const [files] = await connection.execute(
        `SELECT * FROM files WHERE anlage_id = ? ORDER BY created_at DESC`,
        [anlageId]
    );

    const [stats] = await connection.execute(
        `SELECT COUNT(*) as count, SUM(size) as total_size FROM files WHERE anlage_id = ?`,
        [anlageId]
    );

    connection.release();

    res.json({
      anlage_id: anlageId,
      total_files: stats[0].count,
      total_size: stats[0].total_size || 0,
      files: files
    });

  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({
      error: 'Fehler beim Abrufen der Dateien'
    });
  }
});

// Test-Route
router.get('/test/system', (req, res) => {
  res.json({
    files: '✅ File-System bereit für 100-Dateien Upload',
    routes: [
      'POST /upload/:anlageId - Upload bis zu 100 Dateien',
      'GET /:anlageId - Dateien einer Anlage abrufen',
      'GET /test/system - Diese Test-Route'
    ]
  });
});

module.exports = router;