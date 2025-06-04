// src/models/komisiConfig.js
const { getConnection } = require('../database/connection');

class KomisiConfig {
  static async get() {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM komisi_config WHERE id = 1'
    );
    
    if (rows.length === 0) {
      // Create default config if not exists
      await connection.execute(
        'INSERT INTO komisi_config (id, max_links) VALUES (1, 100)'
      );
      return { id: 1, max_links: 100 };
    }
    
    return rows[0];
  }
  
  static async update(data) {
    const connection = getConnection();
    const [result] = await connection.execute(
      'UPDATE komisi_config SET max_links = ? WHERE id = 1',
      [data.max_links]
    );
    return result;
  }
}

module.exports = KomisiConfig;