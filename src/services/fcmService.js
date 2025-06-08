// src/services/fcmService.js - REPLACE EXISTING FILE
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
try {
  const serviceAccount = require(path.join(__dirname, '../../firebase-credentials.json'));
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Failed to initialize Firebase Admin:', error);
  console.error('Make sure firebase-credentials.json exists in the root directory');
}

class FCMService {
  static async broadcastToAll(data) {
    try {
      const topic = 'all_devices'; // Topic untuk semua device
      
      const message = {
        topic: topic,
        notification: {
          title: data.title,
          body: data.body
        },
        data: {
          type: data.data.type || 'komisi_batch',
          count: data.data.count.toString(),
          hp_label: data.data.hp_label || 'HP',
          links: data.data.links,
          timestamp: new Date().toISOString()
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            clickAction: 'OPEN_KOMISI_ACTIVITY',
            channelId: 'komisi_channel'
          }
        },
        webpush: {
          headers: {
            Urgency: 'high'
          },
          notification: {
            icon: '/pwa/icons/icon-192.png',
            badge: '/pwa/icons/icon-192.png',
            tag: 'komisi-batch',
            requireInteraction: true
          }
        }
      };
      
      const response = await admin.messaging().send(message);
      console.log('FCM broadcast sent successfully:', response);
      
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Error broadcasting FCM:', error);
      return { success: false, error: error.message };
    }
  }
  
  static async sendBatchToAll(batchNumber, links, hpLabel) {
    try {
      // Format links dengan newlines
      const linksArray = links.map(link => link.link_produk);
      const linksText = linksArray.join('\n');
      
      return await FCMService.broadcastToAll({
        title: `📱 Batch Baru ${hpLabel}!`,
        body: `${links.length} link komisi siap diproses`,
        data: {
          links: linksText,
          count: links.length,
          type: 'komisi_batch',
          hp_label: hpLabel
        }
      });
    } catch (error) {
      console.error('Error sending batch to all:', error);
      throw error;
    }
  }
  
  // Method untuk subscribe device ke topic (opsional)
  static async subscribeToTopic(token) {
    try {
      await admin.messaging().subscribeToTopic([token], 'all_devices');
      console.log('Device subscribed to all_devices topic');
    } catch (error) {
      console.error('Error subscribing to topic:', error);
    }
  }
}

module.exports = FCMService;