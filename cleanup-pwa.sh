#!/bin/bash
# Script untuk cleanup PWA/WebView files

echo "🧹 Cleaning up PWA/WebView files..."

# Remove viewer files
rm -f public/viewer.html
rm -f public/viewer-manifest.json
rm -f public/viewer-sw.js

# Remove PWA folder
rm -rf public/pwa/

# Remove mobile routes
rm -f src/routes/mobile.js
rm -f src/controllers/mobileController.js
rm -f src/models/mobileDevice.js

# Remove FCM service
rm -f src/services/fcmService.js

# Remove icons folder (optional)
# rm -rf public/icons/

echo "✅ Cleanup completed!"
echo ""
echo "📝 Don't forget to:"
echo "1. Remove viewer routes from server.js"
echo "2. Remove FCM imports from controllers"
echo "3. Update database dengan nomor WA yang benar"