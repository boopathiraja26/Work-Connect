const fs = require('fs');
const bcrypt = require('bcryptjs');

// Sample workers with location data
const sampleWorkers = [
    {
        id: 'worker1',
        username: 'john_plumber',
        email: 'john@example.com',
        phone: '+91-9876543210',
        password: '$2a$10$Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0QeQ0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0', // 'password123'
        role: 'worker',
        name: 'John Smith',
        skills: ['Plumbing', 'Pipe Repair', 'Water Heater Installation'],
        experience: '8',
        hourlyRate: '25',
        availability: 'Available',
        description: 'Professional plumber with 8 years of experience in residential and commercial plumbing services.',
        address: {
            street: '123 Main Street',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001'
        },
        location: {
            link: 'https://maps.google.com/?q=19.0760,72.8777',
            latitude: '19.0760',
            longitude: '72.8777'
        },
        aadhaarNumber: '123456789012',
        aadhaarVerified: true,
        approved: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'worker2',
        username: 'sarah_electrician',
        email: 'sarah@example.com',
        phone: '+91-9876543211',
        password: '$2a$10$Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0QeQ0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0', // 'password123'
        role: 'worker',
        name: 'Sarah Johnson',
        skills: ['Electrical', 'Wiring', 'Circuit Repair', 'Light Installation'],
        experience: '5',
        hourlyRate: '30',
        availability: 'Available',
        description: 'Licensed electrician specializing in residential electrical work and safety inspections.',
        address: {
            street: '456 Park Avenue',
            city: 'Delhi',
            state: 'Delhi',
            pincode: '110001'
        },
        location: {
            link: 'https://maps.google.com/?q=28.7041,77.1025',
            latitude: '28.7041',
            longitude: '77.1025'
        },
        aadhaarNumber: '234567890123',
        aadhaarVerified: true,
        approved: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'worker3',
        username: 'mike_carpenter',
        email: 'mike@example.com',
        phone: '+91-9876543212',
        password: '$2a$10$Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0QeQ0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0Q0', // 'password123'
        role: 'worker',
        name: 'Mike Wilson',
        skills: ['Carpentry', 'Furniture Repair', 'Woodworking', 'Door Installation'],
        experience: '12',
        hourlyRate: '35',
        availability: 'Busy',
        description: 'Master carpenter with extensive experience in custom furniture and home renovations.',
        address: {
            street: '789 Oak Street',
            city: 'Bangalore',
            state: 'Karnataka',
            pincode: '560001'
        },
        location: {
            link: 'https://maps.google.com/?q=12.9716,77.5946',
            latitude: '12.9716',
            longitude: '77.5946'
        },
        aadhaarNumber: '345678901234',
        aadhaarVerified: true,
        approved: true,
        createdAt: new Date().toISOString()
    }
];

// Function to read database
function readDatabase() {
    try {
        const data = fs.readFileSync('database.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading database:', error);
        return { users: [], passwordResetTokens: [], orders: [] };
    }
}

// Function to write to database
function writeDatabase(data) {
    try {
        fs.writeFileSync('database.json', JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing to database:', error);
        return false;
    }
}

// Add sample workers to database
function addSampleWorkers() {
    const db = readDatabase();
    
    // Check if workers already exist
    const existingWorkers = db.users.filter(user => user.role === 'worker');
    if (existingWorkers.length > 0) {
        console.log('Workers already exist in database. Skipping...');
        return;
    }
    
    // Add sample workers
    db.users.push(...sampleWorkers);
    
    if (writeDatabase(db)) {
        console.log('Sample workers added successfully!');
        console.log('Added workers:');
        sampleWorkers.forEach(worker => {
            console.log(`- ${worker.name} (${worker.username})`);
        });
    } else {
        console.error('Error adding sample workers');
    }
}

// Run the script
addSampleWorkers(); 