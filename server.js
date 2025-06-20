const db = require('./db');

db.getConnection()
    .then(() => console.log('✅ MySQL-Verbindung erfolgreich!'))
    .catch(err => console.error('❌ Fehler bei der MySQL-Verbindung:', err));



require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const anlagenRoutes = require('./routes/anlagen');
const filesRoutes = require('./routes/files');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.set('trust proxy', 1);
process.setMaxListeners(0);

// Ersetzen Sie die aktuelle helmet() Konfiguration mit dieser:
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://drive.google.com", "https://lh3.googleusercontent.com"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",  // Für Inline-Scripts
        "'unsafe-eval'",    // Für dynamische Scripts
        "http://gc.kis.v2.scr.kaspersky-labs.com",  // Kaspersky
        "ws://gc.kis.v2.scr.kaspersky-labs.com"     // Kaspersky WebSocket
      ],
      scriptSrcAttr: ["'unsafe-inline'"],  // Für onclick, onchange etc.
      connectSrc: ["'self'", "https://objekt-pro.at", "https://www.googleapis.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https://drive.google.com"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: '50mb' }));
// Static files (vor den API-Routes)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Upload-Test HTML Route - DIREKT EINGEBAUT
app.get('/upload-test.html', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
    <title>objekt-pro.at Upload-Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .upload-area { border: 3px dashed #4CAF50; padding: 40px; text-align: center; margin: 20px 0; border-radius: 10px; background: #f9f9f9; }
        .upload-area:hover { background: #f0f8f0; }
        .progress { width: 100%; height: 30px; background: #e0e0e0; margin: 20px 0; border-radius: 15px; overflow: hidden; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); width: 0%; transition: width 0.3s; }
        .progress-text { text-align: center; line-height: 30px; font-weight: bold; color: white; }
        .result { margin: 20px 0; padding: 20px; background: #f9f9f9; border-radius: 8px; border-left: 4px solid #4CAF50; }
        .error { border-left-color: #f44336; background: #ffebee; }
        .success { border-left-color: #4CAF50; background: #e8f5e8; }
        button { background: #4CAF50; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; }
        button:hover { background: #45a049; }
        input[type="file"] { margin: 10px 0; padding: 8px; }
        .file-info { background: #e3f2fd; padding: 10px; margin: 10px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 objekt-pro.at Upload-Test</h1>
        <p><strong>100-Dateien Upload-System</strong> - Testen Sie das Massen-Upload</p>
        
        <div class="upload-area">
            <h3>📁 Dateien auswählen</h3>
            <input type="file" id="fileInput" multiple accept="image/*,video/*">
            <br><br>
            <button onclick="uploadFiles()">🚀 Upload starten</button>
            <p style="margin-top: 15px; color: #666;">
                <strong>Limits:</strong> Max. 100 Dateien, je max. 100MB
            </p>
        </div>
        
        <div class="file-info" id="fileInfo" style="display:none;"></div>
        <div class="progress" id="progressContainer" style="display:none;">
            <div class="progress-bar" id="progressBar">
                <div class="progress-text" id="progressText">0%</div>
            </div>
        </div>
        <div class="result" id="result"></div>
    </div>

    <script>
        document.getElementById('fileInput').addEventListener('change', function(e) {
            const files = e.target.files;
            const fileInfo = document.getElementById('fileInfo');
            
            if (files.length > 0) {
                let totalSize = 0;
                for (let file of files) totalSize += file.size;
                
                fileInfo.style.display = 'block';
                fileInfo.innerHTML = \`<strong>📊 \${files.length} Dateien ausgewählt (\${(totalSize/1024/1024).toFixed(2)} MB)</strong>\`;
            } else {
                fileInfo.style.display = 'none';
            }
        });

        async function uploadFiles() {
            const fileInput = document.getElementById('fileInput');
            const files = fileInput.files;
            const resultDiv = document.getElementById('result');
            
            if (files.length === 0) {
                resultDiv.className = 'result error';
                resultDiv.innerHTML = '<h3>❌ Fehler</h3><p>Bitte Dateien auswählen</p>';
                return;
            }
            
            if (files.length > 100) {
                resultDiv.className = 'result error';
                resultDiv.innerHTML = '<h3>❌ Zu viele Dateien</h3><p>Max. 100 erlaubt</p>';
                return;
            }
            
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('files', files[i]);
            }
            
            document.getElementById('progressContainer').style.display = 'block';
            document.getElementById('progressBar').style.width = '10%';
            document.getElementById('progressText').textContent = 'Upload läuft...';
            
            resultDiv.className = 'result';
            resultDiv.innerHTML = \`<h3>⏳ Upload läuft...</h3><p>\${files.length} Dateien werden verarbeitet</p>\`;
            
            try {
                const response = await fetch('/api/files/upload/1', {
                    method: 'POST',
                    body: formData
                });
                
                const responseText = await response.text();
                let result = JSON.parse(responseText);
                
                if (result.success) {
                    document.getElementById('progressBar').style.width = '100%';
                    document.getElementById('progressText').textContent = '100% - Fertig!';
                    
                    resultDiv.className = 'result success';
                    resultDiv.innerHTML = \`
                        <h3>🎉 Upload erfolgreich!</h3>
                        <p><strong>Batch:</strong> \${result.batch.id}</p>
                        <p><strong>Erfolg:</strong> \${result.batch.successful}/\${result.batch.total}</p>
                        <p><strong>Größe:</strong> \${(result.statistics.total_size/1024/1024).toFixed(2)} MB</p>
                        <h4>Dateien:</h4>
                        <ul>\${result.files.successful.map(f => \`<li>\${f.originalName} (\${(f.size/1024).toFixed(1)} KB)</li>\`).join('')}</ul>
                    \`;
                } else {
                    throw new Error(result.error);
                }
                
            } catch (error) {
                document.getElementById('progressContainer').style.display = 'none';
                resultDiv.className = 'result error';
                resultDiv.innerHTML = \`<h3>❌ Fehler</h3><p>\${error.message}</p>\`;
            }
        }
    </script>
</body>
</html>`);
});

global.uploadProgress = new Map();

app.use('/api/auth', authRoutes);
app.use('/api/anlagen', authenticateToken, anlagenRoutes);
// Development: Authentication optional für Files
app.use('/api/files', (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    // Fake-User für Development
    req.user = {
      userId: 1,
      email: 'dev@objekt-pro.at',
      role: 'admin',
      name: 'Development User'
    };
  }
  next();
}, filesRoutes);

app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: 'OK',
    service: 'objekt-pro.at API',
    version: '1.0.0',
    environment: NODE_ENV,
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB'
    },
    upload_system: {
      max_files_per_batch: 100,
      max_file_size: '100MB',
      active_uploads: global.uploadProgress.size,
      supported_formats: ['JPG', 'PNG', 'MP4', 'MOV']
    }
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'objekt-pro.at API',
    version: '1.0.0',
    description: '100-Dateien Upload System',
    features: {
      max_simultaneous_uploads: 100,
      batch_processing: true,
      progress_tracking: true
    },
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      anlagen: '/api/anlagen',
      files: '/api/files'
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/test', async (req, res) => {
  // Database-Status prüfen
  let databaseStatus = '⏳ noch nicht verbunden';
  try {
    const pool = require('./db');
    const connection = await pool.getConnection();
    await connection.execute('SELECT 1');
    connection.release();
    databaseStatus = '✅ verbunden';
  } catch (error) {
    databaseStatus = '❌ Fehler: ' + error.message;
  }

  res.json({
    api: '✅ API funktioniert',
    upload_system: {
      status: '✅ bereit für 100-Dateien Uploads',
      max_files: 100,
      max_file_size: '100MB'
    },
    database: databaseStatus,
    google_drive: '⏳ noch nicht konfiguriert',
    timestamp: new Date().toISOString()
  });
});
// Database Test Route - DIREKT NACH /api/test hinzufügen
app.get('/api/database/test', async (req, res) => {
  try {
    const pool = require('./db');
    const connection = await pool.getConnection();

    const [rows] = await connection.execute('SELECT 1 as test, NOW() as server_time, @@version as mysql_version');
    connection.release();

    res.json({
      database: '✅ Verbindung erfolgreich',
      message: 'Database erreichbar',
      server_time: rows[0].server_time,
      mysql_version: rows[0].mysql_version,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      database: '❌ Verbindung fehlgeschlagen',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
// Database Setup Route - NACH /api/database/test hinzufügen
app.get('/api/database/setup', async (req, res) => {
  try {
    const pool = require('./db');
    const connection = await pool.getConnection();

    console.log('🗄️ Erstelle Database-Schema...');

    // 1. USERS TABELLE
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role ENUM('admin', 'mitarbeiter') DEFAULT 'mitarbeiter',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ Tabelle users erstellt');

    // 2. ANLAGEN TABELLE
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS anlagen (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        description TEXT,
        google_drive_folder_id VARCHAR(255),
        created_by INT NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ Tabelle anlagen erstellt');

    // 3. FILES TABELLE
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        anlage_id INT NOT NULL,
        filename VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        mimetype VARCHAR(100) NOT NULL,
        size BIGINT NOT NULL,
        google_drive_file_id VARCHAR(255) NOT NULL,
        batch_id VARCHAR(255),
        uploaded_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_batch (batch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ Tabelle files erstellt');

    // 4. UPLOAD BATCHES TABELLE
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS upload_batches (
        id VARCHAR(255) PRIMARY KEY,
        anlage_id INT NOT NULL,
        user_id INT NOT NULL,
        total_files INT NOT NULL,
        processed_files INT DEFAULT 0,
        status ENUM('pending', 'processing', 'completed') DEFAULT 'pending',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ Tabelle upload_batches erstellt');

    // FOREIGN KEYS HINZUFÜGEN (falls noch nicht vorhanden)
    try {
      await connection.execute('ALTER TABLE anlagen ADD CONSTRAINT fk_anlagen_user FOREIGN KEY (created_by) REFERENCES users(id)');
    } catch (e) { console.log('Foreign key anlagen->users bereits vorhanden oder wird übersprungen'); }

    try {
      await connection.execute('ALTER TABLE files ADD CONSTRAINT fk_files_anlage FOREIGN KEY (anlage_id) REFERENCES anlagen(id) ON DELETE CASCADE');
      await connection.execute('ALTER TABLE files ADD CONSTRAINT fk_files_user FOREIGN KEY (uploaded_by) REFERENCES users(id)');
    } catch (e) { console.log('Foreign keys files bereits vorhanden oder werden übersprungen'); }

    try {
      await connection.execute('ALTER TABLE upload_batches ADD CONSTRAINT fk_batches_anlage FOREIGN KEY (anlage_id) REFERENCES anlagen(id)');
      await connection.execute('ALTER TABLE upload_batches ADD CONSTRAINT fk_batches_user FOREIGN KEY (user_id) REFERENCES users(id)');
    } catch (e) { console.log('Foreign keys upload_batches bereits vorhanden oder werden übersprungen'); }

    // INITIAL-DATEN EINFÜGEN
    await connection.execute(`
      INSERT IGNORE INTO users (email, password, name, role) VALUES 
      ('admin@objekt-pro.at', '$2b$10$rOKwN8qAP9vKOqALkqmEaOuOAh0VK5TvnFXhvC9F8YQTJQmOSDgHO', 'Administrator', 'admin')
    `);
    console.log('✅ Admin-User eingefügt');

    await connection.execute(`
      INSERT IGNORE INTO anlagen (id, name, address, description, created_by) VALUES 
      (1, 'Breitenfurter Strasse 18', '1120 Wien', 'Hauptgebäude - Bürokomplex', 1),
      (2, 'Demo-Anlage für Tests', '1010 Wien', 'Test-Anlage für 100-Dateien Upload', 1)
    `);
    console.log('✅ Test-Anlagen eingefügt');

    // ERFOLG PRÜFEN
    const [userCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
    const [anlagenCount] = await connection.execute('SELECT COUNT(*) as count FROM anlagen');
    const [tables] = await connection.execute('SHOW TABLES');

    connection.release();
    console.log('✅ Database-Setup abgeschlossen!');

    res.json({
      success: true,
      message: '✅ objekt-pro.at Database erfolgreich erstellt!',
      tables_created: tables.length,
      data: {
        users: userCount[0].count,
        anlagen: anlagenCount[0].count,
        files: 0,
        upload_batches: 0
      },
      login: {
        admin_email: 'admin@objekt-pro.at',
        admin_password: 'admin123'
      },
      test_anlagen: [
        'Breitenfurter Strasse 18',
        'Demo-Anlage für Tests'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Database-Setup Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Database-Setup fehlgeschlagen',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
// Database Setup Route - NEU HINZUGEFÜGT
app.get('/api/database/setup', async (req, res) => {
  try {
    const { getConnection } = require('./utils/database');
    const connection = await getConnection();

    console.log('🗄️ Erstelle Database-Schema...');

    // 1. USERS TABELLE
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role ENUM('admin', 'mitarbeiter') DEFAULT 'mitarbeiter',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ Tabelle users erstellt');

    // 2. ANLAGEN TABELLE
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS anlagen (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        description TEXT,
        google_drive_folder_id VARCHAR(255),
        created_by INT NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ Tabelle anlagen erstellt');

    // 3. FILES TABELLE
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        anlage_id INT NOT NULL,
        filename VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        mimetype VARCHAR(100) NOT NULL,
        size BIGINT NOT NULL,
        google_drive_file_id VARCHAR(255) NOT NULL,
        batch_id VARCHAR(255),
        uploaded_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_batch (batch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ Tabelle files erstellt');

    // 4. UPLOAD BATCHES TABELLE
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS upload_batches (
        id VARCHAR(255) PRIMARY KEY,
        anlage_id INT NOT NULL,
        user_id INT NOT NULL,
        total_files INT NOT NULL,
        processed_files INT DEFAULT 0,
        status ENUM('pending', 'processing', 'completed') DEFAULT 'pending',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ Tabelle upload_batches erstellt');

    // FOREIGN KEYS HINZUFÜGEN
    try {
      await connection.execute('ALTER TABLE anlagen ADD CONSTRAINT fk_anlagen_user FOREIGN KEY (created_by) REFERENCES users(id)');
    } catch (e) { console.log('Foreign key anlagen->users bereits vorhanden'); }

    try {
      await connection.execute('ALTER TABLE files ADD CONSTRAINT fk_files_anlage FOREIGN KEY (anlage_id) REFERENCES anlagen(id) ON DELETE CASCADE');
      await connection.execute('ALTER TABLE files ADD CONSTRAINT fk_files_user FOREIGN KEY (uploaded_by) REFERENCES users(id)');
    } catch (e) { console.log('Foreign keys files bereits vorhanden'); }

    try {
      await connection.execute('ALTER TABLE upload_batches ADD CONSTRAINT fk_batches_anlage FOREIGN KEY (anlage_id) REFERENCES anlagen(id)');
      await connection.execute('ALTER TABLE upload_batches ADD CONSTRAINT fk_batches_user FOREIGN KEY (user_id) REFERENCES users(id)');
    } catch (e) { console.log('Foreign keys upload_batches bereits vorhanden'); }

    // INITIAL-DATEN EINFÜGEN
    await connection.execute(`
      INSERT IGNORE INTO users (email, password, name, role) VALUES 
      ('admin@objekt-pro.at', '$2b$10$rOKwN8qAP9vKOqALkqmEaOuOAh0VK5TvnFXhvC9F8YQTJQmOSDgHO', 'Administrator', 'admin')
    `);
    console.log('✅ Admin-User eingefügt');

    await connection.execute(`
      INSERT IGNORE INTO anlagen (id, name, address, description, created_by) VALUES 
      (1, 'Breitenfurter Strasse 18', '1120 Wien', 'Hauptgebäude - Bürokomplex', 1),
      (2, 'Demo-Anlage für Tests', '1010 Wien', 'Test-Anlage für 100-Dateien Upload', 1)
    `);
    console.log('✅ Test-Anlagen eingefügt');

    // ERFOLG PRÜFEN
    const [userCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
    const [anlagenCount] = await connection.execute('SELECT COUNT(*) as count FROM anlagen');
    const [tables] = await connection.execute('SHOW TABLES');

    connection.release();
    console.log('✅ Database-Setup abgeschlossen!');

    res.json({
      success: true,
      message: '✅ objekt-pro.at Database erfolgreich erstellt!',
      tables_created: tables.length,
      data: {
        users: userCount[0].count,
        anlagen: anlagenCount[0].count
      },
      login: {
        admin_email: 'admin@objekt-pro.at',
        admin_password: 'admin123'
      },
      test_anlagen: [
        'Breitenfurter Strasse 18',
        'Demo-Anlage für Tests'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Database-Setup Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Database-Setup fehlgeschlagen',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Database Test Route - NEU HINZUGEFÜGT
app.get('/api/database/test', async (req, res) => {
  try {
    const { testConnection } = require('./utils/database');
    const result = await testConnection();

    if (result.success) {
      res.json({
        database: '✅ Verbindung erfolgreich',
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        database: '❌ Verbindung fehlgeschlagen',
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      database: '❌ Fehler beim Test',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/upload/progress/:batchId', authenticateToken, (req, res) => {
  const { batchId } = req.params;
  const progress = global.uploadProgress.get(batchId);
  if (!progress) {
    return res.status(404).json({ error: 'Upload-Batch nicht gefunden' });
  }
  res.json({
    batchId,
    status: progress.status,
    files_total: progress.total,
    files_processed: progress.processed,
    progress_percent: Math.round((progress.processed / progress.total) * 100)
  });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API-Endpoint nicht gefunden' });
  }
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Datei zu groß', message: 'Max 100MB' });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(413).json({ error: 'Zu viele Dateien', message: 'Max 100 Dateien' });
  }
  console.error('Server Error:', err);
  res.status(500).json({ error: NODE_ENV === 'production' ? 'Serverfehler' : err.message });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 objekt-pro.at Server gestartet`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  console.log(`📊 Environment: ${NODE_ENV}`);
  console.log(`📁 100-Dateien Upload: AKTIV`);
});

const gracefulShutdown = (signal) => {
  console.log(`🛑 ${signal} empfangen`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;

// Database Status Route - nach /api/database/setup hinzufügen
app.get('/api/database/status', async (req, res) => {
  try {
    const pool = require('./db');
    const connection = await pool.getConnection();

    // Tabellen und Daten zählen
    const [tables] = await connection.execute('SHOW TABLES');
    const [userCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
    const [anlagenCount] = await connection.execute('SELECT COUNT(*) as count FROM anlagen');
    const [filesCount] = await connection.execute('SELECT COUNT(*) as count FROM files');
    const [batchesCount] = await connection.execute('SELECT COUNT(*) as count FROM upload_batches');

    // Beispiel-Daten abrufen
    const [users] = await connection.execute('SELECT id, email, name, role FROM users');
    const [anlagen] = await connection.execute('SELECT id, name, address, created_at FROM anlagen');

    connection.release();

    res.json({
      database: '✅ Fully Connected',
      tables: tables.map(row => Object.values(row)[0]),
      counts: {
        users: userCount[0].count,
        anlagen: anlagenCount[0].count,
        files: filesCount[0].count,
        upload_batches: batchesCount[0].count
      },
      sample_data: {
        users: users,
        anlagen: anlagen
      },
      ready_for: [
        '✅ User Authentication',
        '✅ Anlagen Management',
        '✅ 100-Files Upload',
        '✅ Google Drive Integration'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
// Upload-Test HTML Route - DIREKT HINZUFÜGEN
app.get('/upload-test.html', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
    <title>objekt-pro.at Upload-Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .upload-area { border: 3px dashed #4CAF50; padding: 40px; text-align: center; margin: 20px 0; border-radius: 10px; background: #f9f9f9; }
        .upload-area:hover { background: #f0f8f0; }
        .progress { width: 100%; height: 30px; background: #e0e0e0; margin: 20px 0; border-radius: 15px; overflow: hidden; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); width: 0%; transition: width 0.3s; }
        .progress-text { text-align: center; line-height: 30px; font-weight: bold; color: white; }
        .result { margin: 20px 0; padding: 20px; background: #f9f9f9; border-radius: 8px; border-left: 4px solid #4CAF50; }
        .error { border-left-color: #f44336; background: #ffebee; }
        .success { border-left-color: #4CAF50; background: #e8f5e8; }
        button { background: #4CAF50; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; }
        button:hover { background: #45a049; }
        input[type="file"] { margin: 10px 0; padding: 8px; }
        .file-info { background: #e3f2fd; padding: 10px; margin: 10px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 objekt-pro.at Upload-Test</h1>
        <p><strong>100-Dateien Upload-System</strong> - Testen Sie das Massen-Upload für Anlagen</p>
        
        <div class="upload-area">
            <h3>📁 Dateien für Upload auswählen</h3>
            <input type="file" id="fileInput" multiple accept="image/*,video/*">
            <br><br>
            <button onclick="uploadFiles()">🚀 Upload starten</button>
            <p style="margin-top: 15px; color: #666;">
                <strong>Unterstützt:</strong> JPG, PNG, GIF, MP4, MOV, AVI<br>
                <strong>Limits:</strong> Maximal 100 Dateien, je max. 100MB
            </p>
        </div>
        
        <div class="file-info" id="fileInfo" style="display:none;"></div>
        
        <div class="progress" id="progressContainer" style="display:none;">
            <div class="progress-bar" id="progressBar">
                <div class="progress-text" id="progressText">0%</div>
            </div>
        </div>
        
        <div class="result" id="result"></div>
    </div>

    <script>
        // File-Selection Handler
        document.getElementById('fileInput').addEventListener('change', function(e) {
            const files = e.target.files;
            const fileInfo = document.getElementById('fileInfo');
            
            if (files.length > 0) {
                let totalSize = 0;
                let fileTypes = new Set();
                
                for (let file of files) {
                    totalSize += file.size;
                    fileTypes.add(file.type);
                }
                
                fileInfo.style.display = 'block';
                fileInfo.innerHTML = \`
                    <strong>📊 Ausgewählte Dateien:</strong><br>
                    <strong>Anzahl:</strong> \${files.length} Dateien<br>
                    <strong>Gesamtgröße:</strong> \${(totalSize / 1024 / 1024).toFixed(2)} MB<br>
                    <strong>Dateitypen:</strong> \${Array.from(fileTypes).join(', ')}<br>
                    <strong>Status:</strong> \${files.length <= 100 ? '✅ Bereit' : '❌ Zu viele Dateien (max. 100)'}
                \`;
            } else {
                fileInfo.style.display = 'none';
            }
        });

        async function uploadFiles() {
            const fileInput = document.getElementById('fileInput');
            const files = fileInput.files;
            const resultDiv = document.getElementById('result');
            
            if (files.length === 0) {
                resultDiv.className = 'result error';
                resultDiv.innerHTML = '<h3>❌ Fehler</h3><p>Bitte wählen Sie mindestens eine Datei aus</p>';
                return;
            }
            
            if (files.length > 100) {
                resultDiv.className = 'result error';
                resultDiv.innerHTML = '<h3>❌ Zu viele Dateien</h3><p>Maximal 100 Dateien erlaubt. Sie haben ' + files.length + ' ausgewählt.</p>';
                return;
            }
            
            // FormData erstellen
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('files', files[i]);
            }
            
            // Progress anzeigen
            document.getElementById('progressContainer').style.display = 'block';
            document.getElementById('progressBar').style.width = '10%';
            document.getElementById('progressText').textContent = 'Upload wird gestartet...';
            
            resultDiv.className = 'result';
            resultDiv.innerHTML = \`
                <h3>⏳ Upload läuft...</h3>
                <p><strong>Dateien:</strong> \${files.length}</p>
                <p><strong>Ziel:</strong> Breitenfurter Strasse 18</p>
                <p><strong>Status:</strong> Dateien werden verarbeitet...</p>
            \`;
            
            try {
                const startTime = Date.now();
                
                const response = await fetch('/api/files/upload/1', {
                    method: 'POST',
                    body: formData
                });
                
                const responseText = await response.text();
                console.log('🔍 Server Response:', responseText);
                
                let result;
                try {
                    result = JSON.parse(responseText);
                } catch (parseError) {
                    throw new Error('Server antwortete mit HTML statt JSON. Möglicherweise ein Server-Fehler. Response: ' + responseText.substring(0, 300));
                }
                
                const endTime = Date.now();
                const uploadTime = endTime - startTime;
                
                if (result.success) {
                    // Success
                    document.getElementById('progressBar').style.width = '100%';
                    document.getElementById('progressText').textContent = '100% - Abgeschlossen!';
                    
                    resultDiv.className = 'result success';
                    resultDiv.innerHTML = \`
                        <h3>🎉 Upload erfolgreich!</h3>
                        <p><strong>Batch-ID:</strong> \${result.batch.id}</p>
                        <p><strong>Erfolgreich:</strong> \${result.batch.successful}/\${result.batch.total} Dateien</p>
                        <p><strong>Fehlgeschlagen:</strong> \${result.batch.failed} Dateien</p>
                        <p><strong>Gesamtgröße:</strong> \${(result.statistics.total_size / 1024 / 1024).toFixed(2)} MB</p>
                        <p><strong>Upload-Zeit:</strong> \${uploadTime} ms</p>
                        <p><strong>Verarbeitung:</strong> \${result.statistics.processing_time} ms</p>
                        
                        <h4>📁 Erfolgreich hochgeladene Dateien:</h4>
                        <ul>
                            \${result.files.successful.map(f => \`
                                <li><strong>\${f.originalName}</strong> (\${(f.size / 1024).toFixed(1)} KB) - \${f.mimetype}</li>
                            \`).join('')}
                        </ul>
                        
                        \${result.files.failed && result.files.failed.length > 0 ? \`
                            <h4>❌ Fehlgeschlagene Dateien:</h4>
                            <ul>
                                \${result.files.failed.map(f => \`<li>\${f.filename}: \${f.error}</li>\`).join('')}
                            </ul>
                        \` : ''}
                        
                        <h4>📊 Statistiken:</h4>
                        <ul>
                            <li><strong>Dateitypen:</strong> \${result.statistics.file_types.join(', ')}</li>
                            <li><strong>Durchschnitt pro Datei:</strong> \${(result.statistics.total_size / result.batch.successful / 1024).toFixed(1)} KB</li>
                        </ul>
                        
                        <p style="margin-top: 15px;">
                            <button onclick="window.location.reload()">🔄 Neuer Upload</button>
                            <button onclick="checkFiles()" style="margin-left: 10px;">📋 Dateien anzeigen</button>
                        </p>
                    \`;
                } else {
                    throw new Error(result.error || 'Unbekannter Upload-Fehler');
                }
                
            } catch (error) {
                document.getElementById('progressContainer').style.display = 'none';
                resultDiv.className = 'result error';
                resultDiv.innerHTML = \`
                    <h3>❌ Upload fehlgeschlagen</h3>
                    <p><strong>Fehler:</strong> \${error.message}</p>
                    <p><strong>Tipp:</strong> Öffnen Sie die Browser-Konsole (F12) für Details</p>
                    <button onclick="window.location.reload()" style="margin-top: 10px;">🔄 Erneut versuchen</button>
                \`;
                console.error('❌ Upload Error:', error);
            }
        }
        
        async function checkFiles() {
            try {
                const response = await fetch('/api/files/1');
                const result = await response.json();
                
                document.getElementById('result').innerHTML += \`
                    <hr>
                    <h4>📋 Aktuelle Dateien in der Anlage:</h4>
                    <p><strong>Gesamt:</strong> \${result.total_files} Dateien (\${(result.total_size / 1024 / 1024).toFixed(2)} MB)</p>
                    \${result.files.length > 0 ? \`
                        <ul>
                            \${result.files.slice(0, 10).map(f => \`
                                <li>\${f.original_filename} (\${(f.size / 1024).toFixed(1)} KB) - \${new Date(f.created_at).toLocaleString()}</li>
                            \`).join('')}
                        </ul>
                        \${result.files.length > 10 ? '<p>... und ' + (result.files.length - 10) + ' weitere Dateien</p>' : ''}
                    \` : '<p>Noch keine Dateien in dieser Anlage.</p>'}
                \`;
            } catch (error) {
                console.error('Fehler beim Laden der Dateien:', error);
            }
        }
    </script>
</body>
</html>`);
});