const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'public', 'customer-dashboard.html');
const outputFile = path.join(__dirname, 'temp_dashboard.html');

try {
    const content = fs.readFileSync(inputFile, 'utf16le'); // Read as UTF-16LE
    fs.writeFileSync(outputFile, content, 'utf8'); // Write as UTF-8
    console.log('Conversion successful');
} catch (error) {
    console.error('Error converting file:', error);
}
