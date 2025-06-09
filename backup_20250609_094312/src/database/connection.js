// src/database/connection.js - UPDATE EXISTING FILE
const mysql = require('mysql2/promise');

let connection;

async function connectDB() {
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'komisi_db'
    });
    
    console.log('Database connected successfully');
    
    // Create tables if not exists
    await createTables();
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
}

async function createTables() {
  try {
    // Create main table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS komisi_links (
        id INT AUTO_INCREMENT PRIMARY KEY,
        link_produk VARCHAR(500) NOT NULL,
        komisi_flag BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP NULL,
        batch_id INT NULL,
        hp_label VARCHAR(20) NULL,
        batch_number INT DEFAULT 1,
        copied_at TIMESTAMP NULL,
        INDEX idx_sent (sent_at),
        INDEX idx_batch (batch_id),
        INDEX idx_label (hp_label),
        INDEX idx_batch_number (batch_number)
      )
    `;
    
    await connection.execute(createTableQuery);
    
    // Check if copied_at column exists, if not add it
    const [copiedColumns] = await connection.execute(
      "SHOW COLUMNS FROM komisi_links LIKE 'copied_at'"
    );
    
    if (copiedColumns.length === 0) {
      console.log('Adding copied_at column...');
      await connection.execute(
        'ALTER TABLE komisi_links ADD COLUMN copied_at TIMESTAMP NULL AFTER batch_number'
      );
    }
    
    // Create mobile devices table
    const createMobileDevicesTable = `
      CREATE TABLE IF NOT EXISTS mobile_devices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(50) UNIQUE NOT NULL,
        device_name VARCHAR(100) NOT NULL,
        fcm_token TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_device_id (device_id),
        INDEX idx_device_name (device_name)
      )
    `;
    
    await connection.execute(createMobileDevicesTable);
    
    // Create config table
    const createConfigTable = `
      CREATE TABLE IF NOT EXISTS komisi_config (
        id INT PRIMARY KEY,
        max_links INT DEFAULT 100,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    
    await connection.execute(createConfigTable);
    
    // Insert default config if not exists
    const [configRows] = await connection.execute('SELECT * FROM komisi_config WHERE id = 1');
    if (configRows.length === 0) {
      await connection.execute('INSERT INTO komisi_config (id, max_links) VALUES (1, 100)');
    }
    
    console.log('Database tables ready');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
}

function getConnection() {
  return connection;
}

module.exports = { connectDB, getConnection };