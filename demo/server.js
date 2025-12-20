const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Multer setup for file uploads
const multer = require('multer');
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });

// In-memory OTP store (for demo)
const otpStore = {};
const emailOtpStore = {};
const aadhaarOtpStore = {};

// Database setup (using JSON file as simple database)
const DB_FILE = 'database.json';

// Initialize database if it doesn't exist
function initializeDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            users: [],
            passwordResetTokens: [],
            orders: [],
            payments: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    } else {
        // Ensure orders and payments arrays exist in existing database
        const db = readDatabase();
        if (!db.orders) {
            db.orders = [];
        }
        if (!db.payments) {
            db.payments = [];
        }
        writeDatabase(db);
    }
}

// Read database
function readDatabase() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading database:', error);
        return { users: [], passwordResetTokens: [] };
    }
}

// Write to database
function writeDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing to database:', error);
        return false;
    }
}

// Check if user exists
function userExists(username, email) {
    const db = readDatabase();
    return db.users.some(user => user.username === username || user.email === email);
}

// Find user by username
function findUserByUsername(username) {
    const db = readDatabase();
    return db.users.find(user => user.username === username);
}

// Find user by email
function findUserByEmail(email) {
    const db = readDatabase();
    return db.users.find(user => user.email === email);
}

// Helper to mask Aadhaar number
function maskAadhaar(aadhaar) {
    if (!aadhaar || aadhaar.length !== 12) return '';
    return 'XXXX-XXXX-' + aadhaar.slice(-4);
}

// Add admin user if not present
function ensureAdminUser() {
    const db = readDatabase();
    if (!db.users.some(u => u.role === 'admin')) {
        const adminPasswordHash = bcrypt.hashSync('admin123', 10);
        db.users.push({
            id: 'admin',
            username: 'admin',
            email: 'admin@demo.com',
            phone: '',
            password: adminPasswordHash,
            role: 'admin',
            createdAt: new Date().toISOString()
        });
        writeDatabase(db);
    }
}
ensureAdminUser();

// Nodemailer setup (Ethereal for dev/demo)
const nodemailer = require('nodemailer');
let testAccount, transporter;
(async () => {
    testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass
        }
    });
})();
async function sendEmail({ to, subject, text, html }) {
    if (!transporter) return;
    const info = await transporter.sendMail({
        from: 'demo-app@example.com',
        to,
        subject,
        text,
        html
    });
    console.log('Email sent:', nodemailer.getTestMessageUrl(info));
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Registration endpoint (multipart for worker with image)
app.post('/api/register', upload.single('profileImage'), async (req, res) => {
    try {
        // If multipart, fields are in req.body, file in req.file
        const isMultipart = !!req.file;
        const body = isMultipart ? req.body : req.body;
        const { username, email, phone, password, role, aadhaarNumber, address, location, aadhaarOtp, digilockerVerified } = body;
        
        // Validation
        if (!username || !email || !phone || !password || !role) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        
        // Check if user already exists
        if (userExists(username, email)) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }
        
        // Verify email OTP for both workers and customers
        const emailOtpEntry = emailOtpStore[email];
        if (!emailOtpEntry || !emailOtpEntry.verified || Date.now() > emailOtpEntry.expires) {
            return res.status(400).json({ message: 'Email OTP verification required' });
        }
        
        // Aadhaar OTP or DigiLocker verification for workers
        if (role === 'worker') {
            const hasDigiLocker = digilockerVerified === true || digilockerVerified === 'true';

            if (!hasDigiLocker) {
                // Legacy Aadhaar OTP flow
                if (!aadhaarNumber) {
                    return res.status(400).json({ message: 'Aadhaar number is required for workers' });
                }
                if (!aadhaarOtp) {
                    return res.status(400).json({ message: 'Aadhaar OTP is required for workers' });
                }
                
                // Verify Aadhaar OTP
                const aadhaarOtpEntry = aadhaarOtpStore[aadhaarNumber];
                if (!aadhaarOtpEntry || aadhaarOtpEntry.otp !== aadhaarOtp || Date.now() > aadhaarOtpEntry.expires) {
                    return res.status(400).json({ message: 'Invalid or expired Aadhaar OTP' });
                }
                
                // Aadhaar OTP verified, remove from store
                delete aadhaarOtpStore[aadhaarNumber];
            }
        }
        
        // Email OTP verified, remove from store
        delete emailOtpStore[email];
        
        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Parse address/location if present
        let addressObj = null;
        let locationObj = null;
        try {
            if (address) addressObj = JSON.parse(address);
        } catch {}
        try {
            if (location) locationObj = JSON.parse(location);
        } catch {}
        
        // Create new user
        const newUser = {
            id: Date.now().toString(),
            username,
            email,
            phone,
            password: hashedPassword,
            role,
            createdAt: new Date().toISOString(),
            // Worker-specific fields
            profileImage: req.file ? '/uploads/' + req.file.filename : undefined,
            address: addressObj,
            location: locationObj,
            // Only store Aadhaar number for legacy OTP flow, not for DigiLocker
            aadhaarNumber: role === 'worker' && !(digilockerVerified === true || digilockerVerified === 'true') ? aadhaarNumber : undefined,
            aadhaarVerified: role === 'worker' ? true : undefined,
            digilockerVerified: role === 'worker' && (digilockerVerified === true || digilockerVerified === 'true') ? true : undefined
        };
        
        // Save to database
        const db = readDatabase();
        db.users.push(newUser);
        if (writeDatabase(db)) {
            const { password: _, ...userWithoutPassword } = newUser;
            res.status(201).json({ 
                message: 'User registered successfully',
                user: userWithoutPassword
            });
        } else {
            res.status(500).json({ message: 'Error saving user to database' });
        }
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Send Email OTP endpoint
app.post('/api/send-email-otp', async (req, res) => {
    try {
        const { email, role } = req.body;
        
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        
        // Generate 6-digit OTP
        const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store OTP with expiration (5 minutes)
        emailOtpStore[email] = {
            otp: emailOtp,
            role: role,
            expires: Date.now() + 5 * 60 * 1000
        };
        
        // In a real application, you would send this OTP via email
        // For demo purposes, we return it in the response
        console.log(`Email OTP for ${email} (${role}): ${emailOtp}`);
        
        res.status(200).json({
            message: 'Email OTP sent successfully',
            emailOtp: emailOtp // Remove this in production
        });
    } catch (error) {
        console.error('Email OTP error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Verify Email OTP endpoint
app.post('/api/verify-email-otp', async (req, res) => {
    try {
        const { email, emailOtp, role } = req.body;
        
        if (!email || !emailOtp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }
        
        // Check if OTP exists and is valid
        const otpEntry = emailOtpStore[email];
        if (!otpEntry || otpEntry.otp !== emailOtp || Date.now() > otpEntry.expires) {
            return res.status(400).json({ message: 'Invalid or expired email OTP' });
        }
        
        // Verify role matches
        if (otpEntry.role !== role) {
            return res.status(400).json({ message: 'Role mismatch' });
        }
        
        // OTP verified, mark as verified but keep for final registration
        emailOtpStore[email].verified = true;
        
        res.status(200).json({
            message: 'Email OTP verified successfully'
        });
    } catch (error) {
        console.error('Email OTP verification error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Send Aadhaar OTP endpoint
app.post('/api/send-aadhaar-otp', async (req, res) => {
    try {
        const { aadhaarNumber, phone } = req.body;
        
        if (!aadhaarNumber || !phone) {
            return res.status(400).json({ message: 'Aadhaar number and phone are required' });
        }
        
        // Validate Aadhaar number format
        if (!/^\d{12}$/.test(aadhaarNumber)) {
            return res.status(400).json({ message: 'Invalid Aadhaar number format' });
        }
        
        // Generate 6-digit OTP
        const aadhaarOtp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store OTP with expiration (5 minutes)
        aadhaarOtpStore[aadhaarNumber] = {
            otp: aadhaarOtp,
            phone: phone,
            expires: Date.now() + 5 * 60 * 1000
        };
        
        // In a real application, you would send this OTP via SMS to the Aadhaar-linked mobile
        // For demo purposes, we return it in the response
        console.log(`Aadhaar OTP for ${aadhaarNumber} (${phone}): ${aadhaarOtp}`);
        
        res.status(200).json({
            message: 'Aadhaar OTP sent to your mobile successfully',
            aadhaarOtp: aadhaarOtp // Remove this in production
        });
    } catch (error) {
        console.error('Aadhaar OTP error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        // Find user
        const user = findUserByUsername(username);
        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;
        res.json({ 
            message: 'Login successful',
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Forgot password endpoint
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        // Validation
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Find user by email
        const user = findUserByEmail(email);
        if (!user) {
            // For security reasons, don't reveal if email exists or not
            return res.json({ message: 'If the email exists, a reset link has been sent' });
        }

        // Generate reset token
        const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

        // Save reset token to database
        const db = readDatabase();
        db.passwordResetTokens.push({
            email,
            token: resetToken,
            expiry: resetTokenExpiry.toISOString(),
            used: false
        });

        if (writeDatabase(db)) {
            // In a real application, you would send an email here
            console.log(`Password reset token for ${email}: ${resetToken}`);
            console.log(`Reset link: http://localhost:${PORT}/reset-password?token=${resetToken}`);
            
            res.json({ message: 'If the email exists, a reset link has been sent' });
        } else {
            res.status(500).json({ message: 'Error processing request' });
        }

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Reset password endpoint
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        // Validation
        if (!token || !newPassword) {
            return res.status(400).json({ message: 'Token and new password are required' });
        }

        // Find valid reset token
        const db = readDatabase();
        const resetToken = db.passwordResetTokens.find(rt => 
            rt.token === token && 
            !rt.used && 
            new Date(rt.expiry) > new Date()
        );

        if (!resetToken) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        // Hash new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update user password
        const userIndex = db.users.findIndex(user => user.email === resetToken.email);
        if (userIndex === -1) {
            return res.status(400).json({ message: 'User not found' });
        }

        db.users[userIndex].password = hashedPassword;
        resetToken.used = true;

        if (writeDatabase(db)) {
            res.json({ message: 'Password reset successfully' });
        } else {
            res.status(500).json({ message: 'Error updating password' });
        }

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get all users (for admin purposes)
app.get('/api/users', (req, res) => {
    try {
        const db = readDatabase();
        const usersWithoutPasswords = db.users.map(user => {
            const { password, aadhaarNumber, ...userWithoutSensitive } = user;
            if (user.role === 'worker') {
                userWithoutSensitive.aadhaarNumber = maskAadhaar(user.aadhaarNumber);
            }
            return userWithoutSensitive;
        });
        res.json(usersWithoutPasswords);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Add review to worker and mark order as reviewed
app.post('/api/worker/:id/review', (req, res) => {
    const { id } = req.params; // worker id
    const { customerId, customerName, rating, comment, orderId } = req.body;

    if (!customerId || !rating || !orderId) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const db = readDatabase();
    const worker = db.users.find(u => u.id === id && u.role === 'worker');
    if (!worker) return res.status(404).json({ message: 'Worker not found' });

    if (!worker.reviews) worker.reviews = [];

    // Prevent duplicate review for same order by same customer
    if (worker.reviews.some(r => r.orderId === orderId && r.customerId === customerId)) {
        return res.status(400).json({ message: 'You have already reviewed this order.' });
    }

    const review = {
        customerId,
        customerName,
        rating: Number(rating),
        comment: comment || '',
        orderId,
        createdAt: new Date().toISOString()
    };

    worker.reviews.push(review);

    // Also mark the corresponding order as reviewed so the customer dashboard
    // can hide the review form and show "Your Review" in the modal.
    if (db.orders && db.orders.length > 0) {
        const orderIndex = db.orders.findIndex(
            o => o.id === orderId && o.workerId === id && o.customerId === customerId
        );
        if (orderIndex !== -1) {
            db.orders[orderIndex].reviewed = true;
            db.orders[orderIndex].review = {
                rating: review.rating,
                comment: review.comment,
                customerId: review.customerId,
                customerName: review.customerName,
                createdAt: review.createdAt
            };
        }
    }

    writeDatabase(db);
    res.json({ message: 'Review submitted', reviews: worker.reviews, review });
});

// Update existing review for a worker and order
app.put('/api/worker/:id/review', (req, res) => {
    const { id } = req.params; // worker id
    const { customerId, orderId, rating, comment } = req.body;

    if (!customerId || !orderId || !rating) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const db = readDatabase();
    const worker = db.users.find(u => u.id === id && u.role === 'worker');
    if (!worker || !worker.reviews) {
        return res.status(404).json({ message: 'Review not found' });
    }

    const reviewIndex = worker.reviews.findIndex(
        r => r.orderId === orderId && r.customerId === customerId
    );
    if (reviewIndex === -1) {
        return res.status(404).json({ message: 'Review not found' });
    }

    worker.reviews[reviewIndex].rating = Number(rating);
    worker.reviews[reviewIndex].comment = comment || '';
    worker.reviews[reviewIndex].updatedAt = new Date().toISOString();

    // Update review stored on the order as well
    if (db.orders && db.orders.length > 0) {
        const orderIndex = db.orders.findIndex(
            o => o.id === orderId && o.workerId === id && o.customerId === customerId
        );
        if (orderIndex !== -1) {
            db.orders[orderIndex].reviewed = true;
            db.orders[orderIndex].review = {
                rating: Number(rating),
                comment: comment || '',
                customerId,
                customerName: db.orders[orderIndex].review
                    ? db.orders[orderIndex].review.customerName
                    : undefined,
                updatedAt: new Date().toISOString()
            };
        }
    }

    writeDatabase(db);
    res.json({ message: 'Review updated', reviews: worker.reviews, review: worker.reviews[reviewIndex] });
});

// Delete a review for a worker and order
app.delete('/api/worker/:id/review', (req, res) => {
    const { id } = req.params; // worker id
    const { customerId, orderId } = req.body || {};

    if (!customerId || !orderId) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const db = readDatabase();
    const worker = db.users.find(u => u.id === id && u.role === 'worker');
    if (!worker || !worker.reviews) {
        return res.status(404).json({ message: 'Review not found' });
    }

    const originalLength = worker.reviews.length;
    worker.reviews = worker.reviews.filter(
        r => !(r.orderId === orderId && r.customerId === customerId)
    );

    if (worker.reviews.length === originalLength) {
        return res.status(404).json({ message: 'Review not found' });
    }

    // Clear review info on the related order
    if (db.orders && db.orders.length > 0) {
        const orderIndex = db.orders.findIndex(
            o => o.id === orderId && o.workerId === id && o.customerId === customerId
        );
        if (orderIndex !== -1) {
            db.orders[orderIndex].reviewed = false;
            db.orders[orderIndex].review = null;
        }
    }

    writeDatabase(db);
    res.json({ message: 'Review deleted', reviews: worker.reviews });
});

// Get all reviews for a worker
app.get('/api/worker/:id/reviews', (req, res) => {
    const { id } = req.params;
    const db = readDatabase();
    const worker = db.users.find(u => u.id === id && u.role === 'worker');
    if (!worker) return res.status(404).json({ message: 'Worker not found' });
    res.json(worker.reviews || []);
});

// Helper to calculate average rating
function getAverageRating(worker) {
    if (!worker.reviews || worker.reviews.length === 0) return null;
    const sum = worker.reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return (sum / worker.reviews.length).toFixed(2);
}

// Update /api/worker/:id to include averageRating and reviews count
app.get('/api/worker/:id', (req, res) => {
    try {
        const { id } = req.params;
        const db = readDatabase();
        const worker = db.users.find(user => user.id === id && user.role === 'worker');
        
        if (!worker) {
            return res.status(404).json({ message: 'Worker not found' });
        }
        
        const { password, aadhaarNumber, ...workerWithoutSensitive } = worker;
        workerWithoutSensitive.aadhaarNumber = maskAadhaar(worker.aadhaarNumber);
        workerWithoutSensitive.averageRating = getAverageRating(worker);
        workerWithoutSensitive.reviewsCount = worker.reviews ? worker.reviews.length : 0;
        res.json(workerWithoutSensitive);
    } catch (error) {
        console.error('Get worker error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get all workers (for customers to browse)
app.get('/api/workers', (req, res) => {
    try {
        const db = readDatabase();
        const workers = db.users
            .filter(user => user.role === 'worker')
            .map(worker => {
                const { password, aadhaarNumber, ...workerWithoutSensitive } = worker;
                workerWithoutSensitive.aadhaarNumber = maskAadhaar(worker.aadhaarNumber);
                workerWithoutSensitive.averageRating = getAverageRating(worker);
                workerWithoutSensitive.reviewsCount = worker.reviews ? worker.reviews.length : 0;
                return workerWithoutSensitive;
            });
        res.json(workers);
    } catch (error) {
        console.error('Get workers error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Update worker profile (multipart for image upload)
app.put('/api/worker/:id', upload.single('profileImage'), (req, res) => {
    try {
        const { id } = req.params;
        const isMultipart = !!req.file;
        const body = isMultipart ? req.body : req.body;
        const { name, skills, experience, hourlyRate, description, availability, address, location, upiId } = body;
        
        const db = readDatabase();
        const workerIndex = db.users.findIndex(user => user.id === id && user.role === 'worker');
        
        if (workerIndex === -1) {
            return res.status(404).json({ message: 'Worker not found' });
        }
        
        // Parse address/location if present
        let addressObj = null;
        let locationObj = null;
        try {
            if (address) addressObj = JSON.parse(address);
        } catch {}
        try {
            if (location) locationObj = JSON.parse(location);
        } catch {}
        
        // Update worker profile
        db.users[workerIndex] = {
            ...db.users[workerIndex],
            name: name || db.users[workerIndex].name,
            skills: skills ? (typeof skills === 'string' ? JSON.parse(skills) : skills) : db.users[workerIndex].skills || [],
            experience: experience || db.users[workerIndex].experience || '',
            hourlyRate: hourlyRate || db.users[workerIndex].hourlyRate || 0,
            description: description || db.users[workerIndex].description || '',
            availability: availability || db.users[workerIndex].availability || 'Available',
            address: addressObj || db.users[workerIndex].address,
            location: locationObj || db.users[workerIndex].location,
            upiId: upiId || db.users[workerIndex].upiId,
            profileImage: req.file ? '/uploads/' + req.file.filename : db.users[workerIndex].profileImage,
            updatedAt: new Date().toISOString()
        };
        
        if (writeDatabase(db)) {
            const { password, ...workerWithoutPassword } = db.users[workerIndex];
            res.json({ 
                message: 'Worker profile updated successfully',
                worker: workerWithoutPassword
            });
        } else {
            res.status(500).json({ message: 'Error updating worker profile' });
        }
    } catch (error) {
        console.error('Update worker error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Create order
app.post('/api/orders', (req, res) => {
    try {
        const { customerId, workerId, serviceType, description, duration, totalAmount } = req.body;
        
        if (!customerId || !workerId || !serviceType || !description || !duration || !totalAmount) {
            return res.status(400).json({ message: 'All order fields are required' });
        }
        
        const db = readDatabase();
        
        // Verify customer and worker exist
        const customer = db.users.find(user => user.id === customerId && user.role === 'customer');
        const worker = db.users.find(user => user.id === workerId && user.role === 'worker');
        
        if (!customer || !worker) {
            return res.status(400).json({ message: 'Invalid customer or worker' });
        }
        
        // Create new order
        const newOrder = {
            id: Date.now().toString(),
            customerId,
            workerId,
            serviceType,
            description,
            duration,
            totalAmount,
            status: 'pending',
            paymentStatus: 'unpaid',
            createdAt: new Date().toISOString()
        };
        
        // Initialize orders array if it doesn't exist
        if (!db.orders) {
            db.orders = [];
        }
        
        db.orders.push(newOrder);
        
        if (writeDatabase(db)) {
            res.status(201).json({ 
                message: 'Order created successfully',
                order: newOrder
            });
            // Send email notification to worker
            if (worker.email) {
                sendEmail({
                    to: worker.email,
                    subject: 'New Order Received',
                    text: `Hello ${worker.name || worker.username},\n\nYou have received a new order for: ${serviceType}.\nDescription: ${description}\nAmount: $${totalAmount}\n\nLogin to view details: http://localhost:3000/worker-profile.html`,
                    html: `<p>Hello <b>${worker.name || worker.username}</b>,</p><p>You have received a new order for: <b>${serviceType}</b>.<br>Description: ${description}<br>Amount: <b>$${totalAmount}</b></p><p><a href='http://localhost:3000/worker-profile.html'>Login to view details</a></p>`
                });
            }
        } else {
            res.status(500).json({ message: 'Error creating order' });
        }
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get orders for a specific customer (used by enhanced customer dashboard and pages)
app.get('/api/orders/customer/:customerId', (req, res) => {
    try {
        const { customerId } = req.params;
        const db = readDatabase();

        if (!db.orders) {
            return res.json([]);
        }

        const customerOrders = db.orders.filter(order => order.customerId === customerId);

        const ordersWithDetails = customerOrders.map(order => {
            const customer = db.users.find(user => user.id === order.customerId);
            const worker = db.users.find(user => user.id === order.workerId);

            return {
                ...order,
                customer: customer ? {
                    id: customer.id,
                    username: customer.username,
                    email: customer.email,
                    name: customer.name,
                    phone: customer.phone,
                    address: customer.address,
                    location: customer.location
                } : null,
                worker: worker ? {
                    id: worker.id,
                    username: worker.username,
                    email: worker.email,
                    name: worker.name,
                    phone: worker.phone,
                    upiId: worker.upiId
                } : null
            };
        });

        res.json(ordersWithDetails);
    } catch (error) {
        console.error('Get customer orders error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get orders for a user (customer or worker)
app.get('/api/orders/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const db = readDatabase();
        
        if (!db.orders) {
            return res.json([]);
        }
        
        const userOrders = db.orders.filter(order => 
            order.customerId === userId || order.workerId === userId
        );
        
        // Add user details to orders
        const ordersWithDetails = userOrders.map(order => {
            const customer = db.users.find(user => user.id === order.customerId);
            const worker = db.users.find(user => user.id === order.workerId);
            
            return {
                ...order,
                customer: customer ? {
                    id: customer.id,
                    username: customer.username,
                    email: customer.email,
                    name: customer.name,
                    phone: customer.phone,
                    address: customer.address,
                    location: customer.location
                } : null,
                worker: worker ? {
                    id: worker.id,
                    username: worker.username,
                    email: worker.email,
                    name: worker.name,
                    phone: worker.phone,
                    upiId: worker.upiId
                } : null
            };
        });
        
        res.json(ordersWithDetails);
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get a single order by ID
app.get('/api/order/:orderId', (req, res) => {
    try {
        const { orderId } = req.params;
        const db = readDatabase();
        
        if (!db.orders) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        const order = db.orders.find(order => order.id === orderId);
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        // Add user details to order
        const customer = db.users.find(user => user.id === order.customerId);
        const worker = db.users.find(user => user.id === order.workerId);
        
        const orderWithDetails = {
            ...order,
            customer: customer ? { 
                id: customer.id, 
                username: customer.username, 
                email: customer.email,
                name: customer.name,
                phone: customer.phone
            } : null,
            worker: worker ? { 
                id: worker.id, 
                username: worker.username, 
                email: worker.email,
                name: worker.name,
                phone: worker.phone,
                experience: worker.experience,
                hourlyRate: worker.hourlyRate,
                profileImage: worker.profileImage,
                location: worker.location,
                upiId: worker.upiId
            } : null,
            workerLiveLocation: order.workerLiveLocation || null
        };
        
        res.json(orderWithDetails);
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Update order status
app.put('/api/orders/:orderId', (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({ message: 'Status is required' });
        }
        
        const db = readDatabase();
        
        if (!db.orders) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        const orderIndex = db.orders.findIndex(order => order.id === orderId);
        
        if (orderIndex === -1) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        db.orders[orderIndex].status = status;
        db.orders[orderIndex].updatedAt = new Date().toISOString();
        
        if (writeDatabase(db)) {
            res.json({ 
                message: 'Order status updated successfully',
                order: db.orders[orderIndex]
            });
            // Send email notifications
            const order = db.orders[orderIndex];
            const customer = db.users.find(u => u.id === order.customerId);
            const worker = db.users.find(u => u.id === order.workerId);
            if (worker && worker.email) {
                sendEmail({
                    to: worker.email,
                    subject: 'Order Status Updated',
                    text: `Order for ${order.serviceType} is now: ${status}.`,
                    html: `<p>Your order for <b>${order.serviceType}</b> is now: <b>${status}</b>.</p>`
                });
            }
            if (customer && customer.email) {
                sendEmail({
                    to: customer.email,
                    subject: 'Order Status Updated',
                    text: `Order for ${order.serviceType} is now: ${status}.`,
                    html: `<p>Your order for <b>${order.serviceType}</b> is now: <b>${status}</b>.</p>`
                });
            }
        } else {
            res.status(500).json({ message: 'Error updating order' });
        }
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Mark order as paid (simulate payment) - with screenshot upload support
app.post('/api/orders/:orderId/pay', upload.single('screenshot'), (req, res) => {
    try {
        const { orderId } = req.params;
        const { method, customerId } = req.body; // e.g., 'card', 'upi', 'cash'

        const db = readDatabase();
        if (!db.orders) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const orderIndex = db.orders.findIndex(order => order.id === orderId);
        if (orderIndex === -1) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const order = db.orders[orderIndex];
        
        // Security check: verify customer owns the order
        if (customerId && order.customerId !== customerId) {
            return res.status(403).json({ message: 'Access denied: This order does not belong to you' });
        }
        
        // Check if order is in a valid state for payment
        if (order.status !== 'accepted' && order.status !== 'completed') {
            return res.status(400).json({ message: 'Payment can only be made for accepted or completed orders' });
        }
        
        const alreadyPaid = order.paymentStatus === 'paid';
        if (alreadyPaid) {
            return res.status(400).json({ message: 'Order already paid' });
        }

        const transactionId = 'TXN-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 10000).toString(16);

        db.orders[orderIndex].paymentStatus = 'paid';
        db.orders[orderIndex].paymentMethod = method || 'online';
        db.orders[orderIndex].transactionId = transactionId;
        db.orders[orderIndex].paidAt = new Date().toISOString();

        // Ensure payments array exists
        if (!db.payments) {
            db.payments = [];
        }

        const paymentRecord = {
            id: Date.now().toString(),
            transactionId,
            orderId: order.id,
            customerId: order.customerId,
            workerId: order.workerId,
            amount: order.totalAmount,
            method: method || 'online',
            status: 'success',
            screenshot: req.file ? '/uploads/' + req.file.filename : null,
            createdAt: new Date().toISOString()
        };
        db.payments.push(paymentRecord);

        if (writeDatabase(db)) {
            // Send notification email to worker
            const worker = db.users.find(u => u.id === order.workerId);
            const customer = db.users.find(u => u.id === order.customerId);
            if (worker && worker.email) {
                sendEmail({
                    to: worker.email,
                    subject: 'Payment Received - WorkConnect',
                    text: `Hello ${worker.name || worker.username},\n\nPayment of ₹${order.totalAmount} has been received for Order #${order.id.slice(-6)}.\n\nService: ${order.serviceType}\nCustomer: ${customer ? (customer.name || customer.username) : 'N/A'}\nTransaction ID: ${transactionId}\n\nThank you for your service!\n\nLogin to view details: http://localhost:3000/worker-profile.html`,
                    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                            <h1 style="margin: 0;">💰 Payment Received!</h1>
                        </div>
                        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
                            <p>Hello <strong>${worker.name || worker.username}</strong>,</p>
                            <p>Great news! You have received a payment for your service.</p>
                            <div style="background: #f0f9ff; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0;">
                                <p style="margin: 5px 0;"><strong>Amount:</strong> ₹${order.totalAmount}</p>
                                <p style="margin: 5px 0;"><strong>Order ID:</strong> #${order.id.slice(-6)}</p>
                                <p style="margin: 5px 0;"><strong>Service:</strong> ${order.serviceType}</p>
                                <p style="margin: 5px 0;"><strong>Customer:</strong> ${customer ? (customer.name || customer.username) : 'N/A'}</p>
                                <p style="margin: 5px 0;"><strong>Transaction ID:</strong> ${transactionId}</p>
                                <p style="margin: 5px 0;"><strong>Payment Method:</strong> ${method || 'online'}</p>
                            </div>
                            ${req.file ? `<p style="color: #666; font-size: 14px;">📸 Payment screenshot has been uploaded by the customer.</p>` : ''}
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="http://localhost:3000/worker-profile.html" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Order Details</a>
                            </div>
                            <p style="margin-top: 30px; color: #666; font-size: 14px;">Thank you for your excellent service!</p>
                        </div>
                    </div>`
                });
            }
            
            return res.json({
                message: 'Payment successful',
                order: db.orders[orderIndex],
                payment: paymentRecord
            });
        }

        return res.status(500).json({ message: 'Error saving payment' });
    } catch (error) {
        console.error('Order payment error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get payment history for a customer
app.get('/api/payments/customer/:customerId', (req, res) => {
    try {
        const { customerId } = req.params;
        const db = readDatabase();
        if (!db.payments) return res.json([]);
        const payments = db.payments.filter(p => p.customerId === customerId);
        res.json(payments);
    } catch (error) {
        console.error('Get customer payments error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get payment history for a worker
app.get('/api/payments/worker/:workerId', (req, res) => {
    try {
        const { workerId } = req.params;
        const db = readDatabase();
        if (!db.payments) return res.json([]);
        const payments = db.payments.filter(p => p.workerId === workerId);
        res.json(payments);
    } catch (error) {
        console.error('Get worker payments error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Worker updates live location for a specific order
app.post('/api/orders/:orderId/worker-location', (req, res) => {
    try {
        const { orderId } = req.params;
        const { latitude, longitude, timestamp } = req.body;

        if (typeof latitude === 'undefined' || typeof longitude === 'undefined') {
            return res.status(400).json({ message: 'latitude and longitude are required' });
        }

        const db = readDatabase();
        const orderIndex = db.orders ? db.orders.findIndex(o => o.id === orderId) : -1;
        if (orderIndex === -1) {
            return res.status(404).json({ message: 'Order not found' });
        }

        db.orders[orderIndex].workerLiveLocation = {
            latitude: Number(latitude),
            longitude: Number(longitude),
            timestamp: timestamp || new Date().toISOString()
        };

        if (writeDatabase(db)) {
            return res.json({ message: 'Worker location updated' });
        }
        return res.status(500).json({ message: 'Error saving location' });
    } catch (error) {
        console.error('Update worker location error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Admin login endpoint
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    const db = readDatabase();
    const admin = db.users.find(u => u.role === 'admin' && u.username === username);
    if (!admin) return res.status(401).json({ message: 'Invalid admin credentials' });
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ message: 'Invalid admin credentials' });
    const { password: _, ...adminSafe } = admin;
    res.json({ message: 'Admin login successful', admin: adminSafe });
});

// List all workers (admin view, with approval status)
app.get('/api/admin/workers', (req, res) => {
    const db = readDatabase();
    const workers = db.users.filter(u => u.role === 'worker').map(w => {
        const { password, ...safe } = w;
        return safe;
    });
    res.json(workers);
});

// Approve/reject worker
app.post('/api/admin/worker/:id/approve', async (req, res) => {
    const { id } = req.params;
    const { approved } = req.body;
    const db = readDatabase();
    const idx = db.users.findIndex(u => u.id === id && u.role === 'worker');
    if (idx === -1) return res.status(404).json({ message: 'Worker not found' });
    db.users[idx].approved = !!approved;
    writeDatabase(db);
    res.json({ message: 'Worker approval updated', worker: db.users[idx] });
    // Send email notification if approved
    if (approved && db.users[idx].email) {
        sendEmail({
            to: db.users[idx].email,
            subject: 'Your worker account has been approved',
            text: `Hello ${db.users[idx].name || db.users[idx].username},\n\nYour worker account has been approved! You can now log in and receive orders.\n\nLogin: http://localhost:3000/login.html`,
            html: `<p>Hello <b>${db.users[idx].name || db.users[idx].username}</b>,</p><p>Your worker account has been <b>approved</b>! You can now log in and receive orders.</p><p><a href='http://localhost:3000/login.html'>Login here</a></p>`
        });
    }
});

// Initialize database and start server
initializeDatabase();

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Database initialized successfully');
}); 
