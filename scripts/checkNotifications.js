/**
 * Firebase Push Notifications Configuration Checker
 * This script verifies that all required components for Firebase Push Notifications
 * with Expo Go are properly configured.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Firebase Push Notifications Configuration...\n');

const issues = [];
const warnings = [];
const success = [];

// 1. Check package.json
console.log('📦 Checking package.json...');
try {
  const packageJson = require('../package.json');
  
  if (packageJson.dependencies['expo-notifications']) {
    success.push(`✓ expo-notifications installed (${packageJson.dependencies['expo-notifications']})`);
  } else {
    issues.push('✗ expo-notifications not found in dependencies');
  }
  
  if (packageJson.dependencies['expo-device']) {
    success.push(`✓ expo-device installed (${packageJson.dependencies['expo-device']})`);
  } else {
    warnings.push('⚠ expo-device not found (recommended for device checks)');
  }
  
  if (packageJson.dependencies['firebase']) {
    success.push(`✓ firebase installed (${packageJson.dependencies['firebase']})`);
  } else {
    issues.push('✗ firebase not found in dependencies');
  }
} catch (error) {
  issues.push('✗ Could not read package.json');
}

// 2. Check app.config.ts
console.log('\n⚙️  Checking app.config.ts...');
try {
  const appConfigPath = path.join(__dirname, '../app.config.ts');
  const appConfigContent = fs.readFileSync(appConfigPath, 'utf8');
  
  // Check for expo-notifications plugin
  if (appConfigContent.includes('expo-notifications')) {
    success.push('✓ expo-notifications plugin configured in app.config.ts');
  } else {
    issues.push('✗ expo-notifications plugin NOT configured in app.config.ts');
  }
  
  // Check for projectId in EAS config
  if (appConfigContent.includes('projectId:') && appConfigContent.includes('eas:')) {
    success.push('✓ EAS projectId configured');
  } else {
    warnings.push('⚠ EAS projectId not found in app.config.ts');
  }
  
  // Check for POST_NOTIFICATIONS permission
  if (appConfigContent.includes('POST_NOTIFICATIONS')) {
    success.push('✓ Android POST_NOTIFICATIONS permission configured');
  } else {
    issues.push('✗ Android POST_NOTIFICATIONS permission missing');
  }
  
  // Check owner field
  if (appConfigContent.includes('owner:')) {
    success.push('✓ Expo owner configured');
  } else {
    warnings.push('⚠ Expo owner not configured (needed for EAS)');
  }
} catch (error) {
  issues.push('✗ Could not read app.config.ts');
}

// 3. Check hooks/useNotifications.ts
console.log('\n🪝 Checking hooks/useNotifications.ts...');
try {
  const useNotificationsPath = path.join(__dirname, '../hooks/useNotifications.ts');
  const useNotificationsContent = fs.readFileSync(useNotificationsPath, 'utf8');
  
  // Check for projectId
  if (useNotificationsContent.includes('projectId =') || useNotificationsContent.includes('projectId:')) {
    success.push('✓ projectId configured in useNotifications.ts');
    
    // Check if it's a placeholder
    if (useNotificationsContent.includes('@caleblouwskiter/SBHRA') || 
        useNotificationsContent.includes('@your-username')) {
      warnings.push('⚠ projectId might be a placeholder - verify it matches your Expo project');
    }
  } else {
    issues.push('✗ projectId not configured in useNotifications.ts');
  }
  
  // Check for Notifications.setNotificationHandler
  if (useNotificationsContent.includes('setNotificationHandler')) {
    success.push('✓ Notification handler configured');
  } else {
    warnings.push('⚠ Notification handler not configured');
  }
  
  // Check for saveFCMToken
  if (useNotificationsContent.includes('saveFCMToken')) {
    success.push('✓ FCM token saving implemented');
  } else {
    warnings.push('⚠ FCM token not being saved to Firestore');
  }
} catch (error) {
  issues.push('✗ Could not read hooks/useNotifications.ts');
}

// 4. Check services/FirebaseNotificationService.ts
console.log('\n🔥 Checking services/FirebaseNotificationService.ts...');
try {
  const servicePath = path.join(__dirname, '../services/FirebaseNotificationService.ts');
  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  
  if (serviceContent.includes('saveFCMToken')) {
    success.push('✓ saveFCMToken function exists');
  } else {
    issues.push('✗ saveFCMToken function missing');
  }
  
  if (serviceContent.includes('pushNotificationRequests')) {
    success.push('✓ Push notification request queue implemented');
  } else {
    warnings.push('⚠ Push notification request queue not found');
  }
} catch (error) {
  issues.push('✗ Could not read services/FirebaseNotificationService.ts');
}

// 5. Check Firebase Cloud Functions
console.log('\n☁️  Checking Firebase Cloud Functions...');
try {
  const functionsIndexPath = path.join(__dirname, '../functions/src/index.ts');
  const functionsContent = fs.readFileSync(functionsIndexPath, 'utf8');
  
  if (functionsContent.includes('processPushNotifications')) {
    success.push('✓ processPushNotifications Cloud Function exists');
  } else {
    issues.push('✗ processPushNotifications Cloud Function missing');
  }
  
  if (functionsContent.includes('cleanupOldNotificationRequests')) {
    success.push('✓ Cleanup Cloud Function exists');
  } else {
    warnings.push('⚠ Cleanup Cloud Function not found');
  }
  
  if (functionsContent.includes('admin.messaging()')) {
    success.push('✓ Firebase Admin Messaging SDK used');
  } else {
    issues.push('✗ Firebase Admin Messaging SDK not found');
  }
} catch (error) {
  issues.push('✗ Could not read functions/src/index.ts');
}

// 6. Check App.tsx integration
console.log('\n📱 Checking App.tsx integration...');
try {
  const appPath = path.join(__dirname, '../App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');
  
  if (appContent.includes('useNotifications')) {
    success.push('✓ useNotifications hook integrated in App.tsx');
  } else {
    issues.push('✗ useNotifications hook not used in App.tsx');
  }
  
  if (appContent.includes('user?.uid')) {
    success.push('✓ User ID passed to useNotifications');
  } else {
    warnings.push('⚠ User ID might not be passed to useNotifications');
  }
} catch (error) {
  issues.push('✗ Could not read App.tsx');
}

// 7. Check for notification assets
console.log('\n🎨 Checking notification assets...');
const notificationIconPath = path.join(__dirname, '../assets/icons/notification-icon.png');
const notificationSoundPath = path.join(__dirname, '../assets/sounds/notification.wav');

if (fs.existsSync(notificationIconPath)) {
  success.push('✓ Notification icon exists');
} else {
  warnings.push('⚠ notification-icon.png not found (Android will use default)');
}

if (fs.existsSync(notificationSoundPath)) {
  success.push('✓ Notification sound exists');
} else {
  warnings.push('⚠ notification.wav not found (will use default sound)');
}

// 8. Check constants/config.ts
console.log('\n⚙️  Checking constants/config.ts...');
try {
  const configPath = path.join(__dirname, '../constants/config.ts');
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  if (configContent.includes('NOTIFICATIONS_ENABLED')) {
    if (configContent.includes('NOTIFICATIONS_ENABLED = true')) {
      success.push('✓ Notifications enabled in config');
    } else {
      warnings.push('⚠ Notifications disabled in config');
    }
  } else {
    warnings.push('⚠ NOTIFICATIONS_ENABLED flag not found');
  }
} catch (error) {
  warnings.push('⚠ Could not read constants/config.ts');
}

// Print Results
console.log('\n' + '='.repeat(60));
console.log('📊 RESULTS\n');

if (success.length > 0) {
  console.log('✅ SUCCESS (' + success.length + '):\n');
  success.forEach(msg => console.log('   ' + msg));
  console.log('');
}

if (warnings.length > 0) {
  console.log('⚠️  WARNINGS (' + warnings.length + '):\n');
  warnings.forEach(msg => console.log('   ' + msg));
  console.log('');
}

if (issues.length > 0) {
  console.log('❌ ISSUES (' + issues.length + '):\n');
  issues.forEach(msg => console.log('   ' + msg));
  console.log('');
}

console.log('='.repeat(60));

if (issues.length === 0) {
  console.log('\n🎉 All critical checks passed!');
  console.log('\n📋 Next Steps:');
  console.log('   1. Deploy Firebase Cloud Functions: cd functions && firebase deploy --only functions');
  console.log('   2. Configure FCM credentials in Expo: eas credentials');
  console.log('   3. Test on a physical device (notifications don\'t work in emulators)');
  console.log('   4. Check Expo project ID matches: https://expo.dev/');
} else {
  console.log('\n⚠️  Please fix the critical issues listed above.');
  process.exit(1);
}
