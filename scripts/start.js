const { exec } = require('child_process');
const path = require('path');

console.log('Starting Doctor Desk Navigation System API...');
console.log('Node.js version:', process.version);

// Check if .env file exists
const fs = require('fs');
const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found!');
    console.log('Please copy env.example to .env and configure your database settings.');
    process.exit(1);
}

console.log('✅ Environment configuration found');
console.log('🚀 Starting server...');
