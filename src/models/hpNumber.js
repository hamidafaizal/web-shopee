// src/models/hpNumber.js
const { getConnection } = require('../database/connection');

class HPNumber {
  static async getAll() {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM hp_numbers ORDER BY label'
    );
    return rows;
  }
  
  static async getByLabel(label) {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM hp_numbers WHERE label = ? LIMIT 1',
      [label]
    );
    return rows[0] || null;
  }
  
  static async update(label, phoneNumber, name = null) {
    const connection = getConnection();
    const [result] = await connection.execute(
      'UPDATE hp_numbers SET phone_number = ?, name = ? WHERE label = ?',
      [phoneNumber, name, label]
    );
    return result;
  }
  
  static async create(label, phoneNumber, name = null) {
    const connection = getConnection();
    const [result] = await connection.execute(
      'INSERT INTO hp_numbers (label, phone_number, name) VALUES (?, ?, ?)',
      [label, phoneNumber, name]
    );
    return result;
  }
}

module.exports = HPNumber;