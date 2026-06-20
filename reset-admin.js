const fs = require('fs');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const adminIndex = db.users.findIndex(u => u.role === 'admin');
const newUsername = 'boopathi26';
const newPassword = 'Boopathi26@';
const hashedPassword = bcrypt.hashSync(newPassword, 10);

if (adminIndex !== -1) {
    db.users[adminIndex].password = hashedPassword;
    db.users[adminIndex].username = newUsername; // Match current config
    console.log('Admin password reset to: ' + newPassword);
} else {
    db.users.push({
        id: 'admin',
        username: newUsername,
        email: 'admin@workconnect.com',
        password: hashedPassword,
        role: 'admin',
        createdAt: new Date().toISOString()
    });
    console.log('Admin user created with password: ' + newPassword);
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log('Database updated successfully.');
