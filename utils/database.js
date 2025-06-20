// Database Connection für objekt-pro.at (aktualisiert)
const pool = require('../db');

// Connection aus Pool holen
const getConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('📡 MySQL-Verbindung aus Pool erhalten');
    return connection;
  } catch (error) {
    console.error('❌ MySQL-Verbindungsfehler:', error.message);
    throw error;
  }
};

// Verbindung testen
const testConnection = async () => {
  try {
    const connection = await getConnection();
    const [rows] = await connection.execute('SELECT 1 as test, NOW() as server_time, @@version as mysql_version');
    connection.release();

    console.log('✅ Database-Verbindung erfolgreich getestet');
    return {
      success: true,
      message: 'Database erreichbar',
      server_time: rows[0].server_time,
      mysql_version: rows[0].mysql_version
    };
  } catch (error) {
    console.error('❌ Database-Test fehlgeschlagen:', error.message);
    return { success: false, error: error.message };
  }
};

// Pool-Status abrufen
const getPoolStatus = () => {
  return {
    all_connections: pool._allConnections?.length || 0,
    free_connections: pool._freeConnections?.length || 0,
    acquired_connections: pool._acquiringConnections?.length || 0
  };
};

module.exports = {
  getConnection,
  testConnection,
  getPoolStatus,
  pool
};