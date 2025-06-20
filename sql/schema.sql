USE objektpro_db;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('admin', 'mitarbeiter') DEFAULT 'mitarbeiter',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE anlagen (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    description TEXT,
    google_drive_folder_id VARCHAR(255),
    created_by INT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE files (
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
    FOREIGN KEY (anlage_id) REFERENCES anlagen(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id),
    INDEX idx_batch (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE upload_batches (
    id VARCHAR(255) PRIMARY KEY,
    anlage_id INT NOT NULL,
    user_id INT NOT NULL,
    total_files INT NOT NULL,
    processed_files INT DEFAULT 0,
    status ENUM('pending', 'processing', 'completed') DEFAULT 'pending',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (anlage_id) REFERENCES anlagen(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO users (email, password, name, role) VALUES 
('admin@objekt-pro.at', '$2b$10$rOKwN8qAP9vKOqALkqmEaOuOAh0VK5TvnFXhvC9F8YQTJQmOSDgHO', 'Administrator', 'admin');

INSERT INTO anlagen (name, address, description, created_by) VALUES 
('Breitenfurter Strasse 18', '1120 Wien', 'Hauptgebäude', 1),
('Demo-Anlage', '1010 Wien', 'Test-Anlage für 100-Dateien', 1);

SELECT 'objekt-pro.at Database mit 100-Dateien Support erstellt!' as Status;