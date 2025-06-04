// src/database/connection.js
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
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS komisi_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      link_produk VARCHAR(500) NOT NULL,
      komisi_flag BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMP NULL,
      batch_id INT NULL,
      hp_label VARCHAR(20) NULL,
      INDEX idx_sent (sent_at),
      INDEX idx_batch (batch_id),
      INDEX idx_label (hp_label)
    )
  `;
  
  const createConfigTable = `
    CREATE TABLE IF NOT EXISTS komisi_config (
      id INT PRIMARY KEY,
      max_links INT DEFAULT 100,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;
  
  await connection.execute(createTableQuery);
  await connection.execute(createConfigTable);
  
  // Insert default config if not exists
  const [configRows] = await connection.execute('SELECT * FROM komisi_config WHERE id = 1');
  if (configRows.length === 0) {
    await connection.execute('INSERT INTO komisi_config (id, max_links) VALUES (1, 100)');
  }
}

function getConnection() {
  return connection;
}

module.exports = { connectDB, getConnection };