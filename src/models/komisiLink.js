// src/models/komisiLink.js
const { getConnection } = require('../database/connection');

class KomisiLink {
  static async create(data) {
    const connection = getConnection();
    const [result] = await connection.execute(
      'INSERT INTO komisi_links (link_produk, komisi_flag, hp_label, batch_number) VALUES (?, ?, ?, ?)',
      [data.link_produk, data.komisi_flag || true, data.hp_label || null, data.batch_number || 1]
    );
    return result;
  }
  
  static async findUnsent() {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM komisi_links WHERE sent_at IS NULL ORDER BY created_at ASC'
    );
    return rows;
  }
  
  static async countUnsent() {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT COUNT(*) as count FROM komisi_links WHERE sent_at IS NULL'
    );
    return rows[0].count;
  }
  
  static async existsUnsent(link) {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT id FROM komisi_links WHERE link_produk = ? AND sent_at IS NULL LIMIT 1',
      [link]
    );
    return rows.length > 0;
  }
  
  static async markAsSent(ids, batchId) {
    const connection = getConnection();
    const placeholders = ids.map(() => '?').join(',');
    const query = `
      UPDATE komisi_links 
      SET sent_at = NOW(), batch_id = ? 
      WHERE id IN (${placeholders})
    `;
    const params = [batchId, ...ids];
    const [result] = await connection.execute(query, params);
    return result;
  }
  
  static async getUnsentLimited(limit = 100) {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM komisi_links WHERE sent_at IS NULL ORDER BY created_at ASC LIMIT ?',
      [limit]
    );
    return rows;
  }
  
  static async getUnsentDetailed(limit = 100) {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT id, link_produk, hp_label, created_at FROM komisi_links WHERE sent_at IS NULL ORDER BY created_at ASC LIMIT ?',
      [limit]
    );
    return rows;
  }
  
  static async deleteAllUnsent() {
    const connection = getConnection();
    const [result] = await connection.execute(
      'DELETE FROM komisi_links WHERE sent_at IS NULL'
    );
    return result;
  }
  
  static async setHPLabelForNext(limit, label) {
    const connection = getConnection();
    const [result] = await connection.execute(
      `UPDATE komisi_links 
       SET hp_label = ? 
       WHERE sent_at IS NULL 
       AND hp_label IS NULL
       ORDER BY created_at ASC 
       LIMIT ?`,
      [label, limit]
    );
    return result;
  }
  
  static async updateBatchLabel(batchNumber, label) {
    const connection = getConnection();
    
    // MariaDB compatible - gunakan subquery
    const [result] = await connection.execute(
      `UPDATE komisi_links 
       SET hp_label = ? 
       WHERE sent_at IS NULL 
       AND id IN (
         SELECT id FROM (
           SELECT id FROM komisi_links 
           WHERE sent_at IS NULL 
           ORDER BY created_at ASC 
           LIMIT 100
         ) tmp
       )`,
      [label]
    );
    return result;
  }

  static async getByHPLabel(label) {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM komisi_links WHERE hp_label = ? AND sent_at IS NOT NULL ORDER BY created_at DESC',
      [label]
    );
    return rows;
  }

  static async markBatchCopied(batchId) {
    const connection = getConnection();
    await connection.execute(
      'UPDATE komisi_links SET copied_at = CURRENT_TIMESTAMP WHERE batch_id = ?',
      [batchId]
    );
  }

  static async deleteBatch(batchId) {
    const connection = getConnection();
    await connection.execute(
      'DELETE FROM komisi_links WHERE batch_id = ?',
      [batchId]
    );
  }
}

module.exports = KomisiLink;
