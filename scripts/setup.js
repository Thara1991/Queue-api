const fs = require('fs');
const path = require('path');

console.log('🔧 Doctor Desk Navigation System - Setup Script');
console.log('================================================\n');

// Check Node.js version
const nodeVersion = process.version;
const requiredVersion = 'v12.22.12';
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 12) {
    console.error(`❌ Node.js version ${nodeVersion} is not supported.`);
    console.error(`   Required: Node.js ${requiredVersion} or higher`);
    process.exit(1);
}

console.log(`✅ Node.js version: ${nodeVersion}`);

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', 'env.example');

if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
        console.log('📝 Creating .env file from template...');
        fs.copyFileSync(envExamplePath, envPath);
        console.log('✅ .env file created');
        console.log('⚠️  Please edit .env file with your database configuration');
    } else {
        console.error('❌ env.example file not found');
        process.exit(1);
    }
} else {
    console.log('✅ .env file already exists');
}

// Check if database setup script exists
const setupSqlPath = path.join(__dirname, '..', 'database', 'setup.sql');
if (fs.existsSync(setupSqlPath)) {
    console.log('✅ Database setup script found');
} else {
    console.error('❌ Database setup script not found');
    process.exit(1);
}

console.log('\n📋 Setup Instructions:');
console.log('=====================');
console.log('1. Configure your database settings in .env file');
console.log('2. Create database "QNurseDB" in your SQL Server instance');
console.log('3. Run the setup script: database/setup.sql');
console.log('4. Install dependencies: npm install');
console.log('5. Start the server: npm start');
console.log('\n🚀 Setup complete! Follow the instructions above to get started.');
