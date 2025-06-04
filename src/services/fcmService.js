const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Note: You need to download service account key from Firebase Console
// and save it as firebase-credentials.json
try {
  const serviceAccount = require('../../firebase-credentials.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('Firebase Admin SDK initialized');
} catch (error) {
  console.error('Firebase initialization error:', error);
  console.log('Please add firebase-credentials.json file');
}

class FCMService {
  static async sendNotification(messageData) {
    try {
      const message = {
        notification: {
          title: messageData.title,
          body: messageData.body
        },
        data: messageData.data,
        topic: 'komisi_updates'
      };
      
      const response = await admin.messaging().send(message);
      console.log('Successfully sent message:', response);
      return response;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }
  
  static async sendToToken(token, messageData) {
    try {
      const message = {
        notification: {
          title: messageData.title,
          body: messageData.body
        },
        data: messageData.data,
        token: token
      };
      
      const response = await admin.messaging().send(message);
      return response;
    } catch (error) {
      console.error('Error sending to token:', error);
      throw error;
    }
  }
}

module.exports = FCMService;