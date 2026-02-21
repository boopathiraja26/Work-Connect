const fs = require('fs');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const adminIndex = db.users.findIndex(u => u.role === 'admin');
const newPassword = 'admin123';
const hashedPassword = bcrypt.hashSync(newPassword, 10);

if (adminIndex !== -1) {
    db.users[adminIndex].password = hashedPassword;
    db.users[adminIndex].username = 'admin'; // Ensure username is admin
    console.log('Admin password reset to: ' + newPassword);
} else {
    db.users.push({
        id: 'admin',
        username: 'admin',
        email: 'admin@demo.com',
        password: hashedPassword,
        role: 'admin',
        createdAt: new Date().toISOString()
    });
    console.log('Admin user created with password: ' + newPassword);
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log('Database updated successfully.');
