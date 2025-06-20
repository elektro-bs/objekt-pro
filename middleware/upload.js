// Upload Middleware für 100-Dateien Support (ERWEITERT)
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Upload-Verzeichnis sicherstellen
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Batch-spezifische Ordner
const createBatchDir = (batchId) => {
  const batchDir = path.join(uploadDir, batchId);
  if (!fs.existsSync(batchDir)) {
    fs.mkdirSync(batchDir, { recursive: true });
  }
  return batchDir;
};

// Multer-Storage für 100-Dateien
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Eindeutige Batch-ID erstellen falls nicht vorhanden
    if (!req.batchId) {
      req.batchId = 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    const batchDir = createBatchDir(req.batchId);
    cb(null, batchDir);
  },
  filename: (req, file, cb) => {
    // Sichere Dateinamen mit Timestamp
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50);

    const filename = `${timestamp}_${random}_${baseName}${ext}`;
    cb(null, filename);
  }
});

// Erweiterte File-Filter für 100-Dateien
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    // Bilder
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
    // Videos
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/x-ms-wmv',
    'video/mov'
  ];

  const maxSize = 100 * 1024 * 1024; // 100MB

  if (allowedTypes.includes(file.mimetype)) {
    if (file.size && file.size > maxSize) {
      cb(new Error(`Datei "${file.originalname}" ist zu groß (${Math.round(file.size/1024/1024)}MB). Maximum: 100MB`), false);
    } else {
      cb(null, true);
    }
  } else {
    cb(new Error(`Dateityp "${file.mimetype}" nicht erlaubt für "${file.originalname}". Erlaubt: JPG, PNG, GIF, MP4, MOV, AVI`), false);
  }
};

// Haupt-Upload-Middleware (100 Dateien)
const uploadFiles = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB pro Datei
    files: 100, // Maximal 100 Dateien
    fields: 50, // Zusätzliche Form-Felder
    fieldSize: 2 * 1024 * 1024 // 2MB für Text-Felder
  },
  fileFilter: fileFilter
}).array('files', 100); // 'files' ist der Feldname, 100 = Limit

// Progress-Tracking Middleware
const trackUploadProgress = (req, res, next) => {
  const batchId = req.body.batchId || 'batch_' + Date.now();
  req.batchId = batchId;

  // Progress in global Map speichern
  global.uploadProgress.set(batchId, {
    status: 'starting',
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
    startedAt: new Date(),
    files: [],
    errors: []
  });

  next();
};

// Erweiterte Error-Handler
const handleUploadError = (err, req, res, next) => {
  console.error('Upload Error:', err);

  // Progress-Status auf Fehler setzen
  if (req.batchId && global.uploadProgress.has(req.batchId)) {
    const progress = global.uploadProgress.get(req.batchId);
    progress.status = 'failed';
    progress.errors.push({
      type: 'system_error',
      message: err.message,
      timestamp: new Date()
    });
  }

  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({
          success: false,
          error: 'Datei zu groß',
          message: 'Maximale Dateigröße: 100MB pro Datei',
          code: 'FILE_TOO_LARGE'
        });

      case 'LIMIT_FILE_COUNT':
        return res.status(413).json({
          success: false,
          error: 'Zu viele Dateien',
          message: 'Maximal 100 Dateien pro Upload möglich',
          code: 'TOO_MANY_FILES'
        });

      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Unerwartete Datei',
          message: 'Verwenden Sie das Feld "files" für den Upload',
          code: 'UNEXPECTED_FIELD'
        });

      default:
        return res.status(400).json({
          success: false,
          error: 'Upload-Fehler',
          message: err.message,
          code: err.code
        });
    }
  }

  // Andere Fehler (z.B. Dateityp nicht erlaubt)
  if (err.message.includes('nicht erlaubt') || err.message.includes('zu groß')) {
    return res.status(400).json({
      success: false,
      error: 'Datei-Validierung fehlgeschlagen',
      message: err.message,
      supported_types: [
        'JPG', 'PNG', 'GIF', 'WEBP', 'BMP', 'TIFF',
        'MP4', 'MOV', 'AVI', 'WEBM', 'WMV'
      ],
      max_file_size: '100MB',
      max_files: 100
    });
  }

  next(err);
};

// Batch-ID Generator
const generateBatchId = () => {
  return 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// File-Info extrahieren
const getFileInfo = (file) => {
  return {
    originalName: file.originalname,
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path,
    timestamp: new Date()
  };
};

module.exports = {
  uploadFiles,
  handleUploadError,
  trackUploadProgress,
  generateBatchId,
  getFileInfo,
  createBatchDir
};