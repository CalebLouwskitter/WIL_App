#!/usr/bin/env node

/**
 * Firebase Configuration Checker
 * 
 * Run this script to verify your Firebase environment variables are set:
 * node scripts/checkFirebase.js
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '../.env');
const ENV_DEFAULT_FILE = path.join(__dirname, '../.env_default');

const REQUIRED_VARS = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
];

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔥 Firebase Configuration Checker');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Check if .env file exists
if (!fs.existsSync(ENV_FILE)) {
  console.log('❌ .env file not found!');
  console.log('\n📝 Action required:');
  console.log('   1. Copy .env_default to .env');
  console.log('   2. Fill in your Firebase configuration values');
  console.log('   3. Get values from: https://console.firebase.google.com/\n');
  
  if (fs.existsSync(ENV_DEFAULT_FILE)) {
    console.log('💡 Tip: Run this command to create .env from template:');
    console.log('   cp .env_default .env\n');
  }
  
  process.exit(1);
}

// Read and parse .env file
const envContent = fs.readFileSync(ENV_FILE, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

// Check each required variable
let missingVars = [];
let emptyVars = [];
let placeholderVars = [];
let validVars = [];

REQUIRED_VARS.forEach(varName => {
  const value = envVars[varName];
  
  if (!value) {
    missingVars.push(varName);
  } else if (value.startsWith('your_') || value === '') {
    placeholderVars.push(varName);
  } else if (value.length < 10) {
    emptyVars.push(varName);
  } else {
    validVars.push(varName);
  }
});

// Display results
console.log('📊 Configuration Status:\n');

if (validVars.length > 0) {
  console.log('✅ Valid Configuration:');
  validVars.forEach(v => {
    const value = envVars[v];
    const masked = value.substring(0, 8) + '...' + value.substring(value.length - 4);
    console.log(`   ${v}: ${masked}`);
  });
  console.log();
}

if (placeholderVars.length > 0) {
  console.log('⚠️  Placeholder Values (need updating):');
  placeholderVars.forEach(v => console.log(`   ${v}: ${envVars[v]}`));
  console.log();
}

if (emptyVars.length > 0) {
  console.log('⚠️  Empty or Too Short:');
  emptyVars.forEach(v => console.log(`   ${v}: ${envVars[v] || '(empty)'}`));
  console.log();
}

if (missingVars.length > 0) {
  console.log('❌ Missing Variables:');
  missingVars.forEach(v => console.log(`   ${v}`));
  console.log();
}

// Final verdict
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const totalIssues = missingVars.length + emptyVars.length + placeholderVars.length;

if (totalIssues === 0) {
  console.log('✅ All Firebase variables are configured!');
  console.log('   Your app should connect to Firebase successfully.\n');
  console.log('💡 Next steps:');
  console.log('   1. Start your app: npm start');
  console.log('   2. Check console for Firebase connection status');
  console.log('   3. Verify authentication and database access\n');
  process.exit(0);
} else {
  console.log(`❌ Found ${totalIssues} configuration issue(s)`);
  console.log('   Firebase will NOT work until these are fixed.\n');
  console.log('📝 How to fix:');
  console.log('   1. Go to: https://console.firebase.google.com/');
  console.log('   2. Select your project');
  console.log('   3. Go to Project Settings (⚙️ icon)');
  console.log('   4. Scroll to "Your apps" section');
  console.log('   5. Copy the config values to your .env file\n');
  console.log('📖 For detailed instructions, see: FIREBASE_SETUP.md\n');
  process.exit(1);
}
