const { getConnection } = require('../database/connection');

class MobileDevice {
  static async register(data) {
    const connection = getConnection();
    const [result] = await connection.execute(
      `INSERT INTO mobile_devices (device_id, device_name, fcm_token) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       device_name = VALUES(device_name),
       fcm_token = VALUES(fcm_token),
       last_active = CURRENT_TIMESTAMP`,
      [data.deviceId, data.deviceName, data.fcmToken || null]
    );
    return result;
  }
  
  static async getByName(deviceName) {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM mobile_devices WHERE device_name = ? LIMIT 1',
      [deviceName]
    );
    return rows[0] || null;
  }
  
  static async getByDeviceId(deviceId) {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM mobile_devices WHERE device_id = ? LIMIT 1',
      [deviceId]
    );
    return rows[0] || null;
  }
  
  static async getAllDevices() {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT device_id, device_name, created_at, last_active FROM mobile_devices ORDER BY device_name'
    );
    return rows;
  }
  
  static async updateFCMToken(deviceId, token) {
    const connection = getConnection();
    await connection.execute(
      'UPDATE mobile_devices SET fcm_token = ?, last_active = CURRENT_TIMESTAMP WHERE device_id = ?',
      [token, deviceId]
    );
  }
  
  static async getFCMTokenByDeviceName(deviceName) {
    const connection = getConnection();
    const [rows] = await connection.execute(
      'SELECT fcm_token FROM mobile_devices WHERE device_name = ? AND fcm_token IS NOT NULL LIMIT 1',
      [deviceName]
    );
    return rows[0]?.fcm_token || null;
  }
}

module.exports = MobileDevice;