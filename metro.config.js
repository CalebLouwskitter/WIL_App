// Default Expo Metro config. Package exports must stay enabled: React Native
// 0.88 and Firebase both rely on them.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
