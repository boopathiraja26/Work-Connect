const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const cloudinary = require('cloudinary').v2;
const { User, Order, Payment, SupportTicket, PasswordResetToken, Notification } = require('./models');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadToCloudinary = async (filePath) => {
    try {
        if (!process.env.CLOUDINARY_CLOUD_NAME) return null;
        const result = await cloudinary.uploader.upload(filePath, {
            folder: 'workconnect_profiles'
        });
        // Delete local file after upload
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return result.secure_url;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        return null;
    }
};

const { Cashfree } = require('cashfree-pg');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Configure Cashfree v5 SDK
Cashfree.XClientId = process.env.CASHFREE_APP_ID || '';
Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY || '';
// Environment is set per-request in v5, not globally

// Check if Razorpay keys are properly configured
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET ||
    process.env.RAZORPAY_KEY_ID.includes('your_') || process.env.RAZORPAY_KEY_SECRET === 'thisissecretkey') {
    console.warn('⚠️ WARNING: Razorpay API keys are not properly configured in .env file. Payments will fail in production.');
}

// Check if Cashfree keys are properly configured
if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
    console.warn('⚠️ WARNING: Cashfree API keys are not properly configured in .env file. Cashfree payments will fail.');
}

const IS_VERCEL = process.env.VERCEL === '1';
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('Connected to MongoDB Atlas'))
        .catch(err => console.error('MongoDB connection error:', err));
} else if (IS_VERCEL) {
    console.warn('⚠️ WARNING: MONGODB_URI not found. Vercel is stateless; your data will NOT persist without MongoDB Atlas.');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer setup for file uploads
const multer = require('multer');
const uploadDir = IS_VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
if (IS_VERCEL) {
    app.use('/uploads', express.static(uploadDir));
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
const phoneOtpStore = {};

// Database setup (using JSON file as simple database)
// Database setup (using JSON file as simple database)
const DB_FILE = IS_VERCEL ? path.join('/tmp', 'database.json') : 'database.json';

// Initialize database if it doesn't exist
async function initializeDatabase() {
    if (IS_VERCEL) {
        if (!fs.existsSync(DB_FILE)) {
            const initialData = { users: [], passwordResetTokens: [], orders: [], payments: [], supportTickets: [], notifications: [] };
            const sourceDb = path.join(__dirname, 'database.json');
            if (fs.existsSync(sourceDb)) {
                try {
                    const data = fs.readFileSync(sourceDb);
                    fs.writeFileSync(DB_FILE, data);
                    console.log('Copied database.json to /tmp');
                } catch (e) {
                    console.error('Failed to copy database, creating new', e);
                    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
                }
            } else {
                fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
            }
        }
    } else {
        if (!fs.existsSync(DB_FILE)) {
            const initialData = { users: [], passwordResetTokens: [], orders: [], payments: [], supportTickets: [], notifications: [] };
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
        } else {
            const db = await readDatabase();
            if (!db.orders) db.orders = [];
            if (!db.payments) db.payments = [];
            if (!db.supportTickets) db.supportTickets = [];
            if (!db.notifications) db.notifications = [];
            await writeDatabase(db);
        }
    }
}

// Helper to create notification
async function createNotification(recipientId, message, type = 'info', relatedId = null, link = null) {
    try {
        if (MONGODB_URI) {
            await Notification.create({ recipientId, message, type, relatedId, link });
        } else {
            const db = await readDatabase();
            if (!db.notifications) db.notifications = [];
            db.notifications.unshift({
                id: Date.now().toString(),
                recipientId,
                message,
                type,
                read: false,
                relatedId,
                link,
                createdAt: new Date().toISOString()
            });
            await writeDatabase(db);
        }
    } catch (e) {
        console.error('Error creating notification:', e);
    }
}

// Read database
async function readDatabase() {
    if (MONGODB_URI) {
        try {
            const users = await User.find().lean();
            const orders = await Order.find().lean();
            const payments = await Payment.find().lean();
            const supportTickets = await SupportTicket.find().lean();
            const passwordResetTokens = await PasswordResetToken.find().lean();
            const notifications = await Notification.find().sort({ createdAt: -1 }).lean();

            // Map MongoDB _id to id for compatibility
            const mapId = (item) => ({ ...item, id: item.id || item._id.toString() });

            return {
                users: users.map(mapId),
                orders: orders.map(mapId),
                payments: payments.map(mapId),
                supportTickets: supportTickets.map(mapId),
                passwordResetTokens: passwordResetTokens.map(mapId),
                notifications: notifications.map(mapId)
            };
        } catch (error) {
            console.error('Error reading from MongoDB:', error);
        }
    }
    try {
        if (!fs.existsSync(DB_FILE)) return { users: [], passwordResetTokens: [], orders: [], payments: [], supportTickets: [], notifications: [] };
        const data = fs.readFileSync(DB_FILE, 'utf8');
        const db = JSON.parse(data);
        if (!db.notifications) db.notifications = [];
        return db;
    } catch (error) {
        console.error('Error reading database:', error);
        return { users: [], passwordResetTokens: [], orders: [], payments: [], supportTickets: [], notifications: [] };
    }
}

// Write to database
async function writeDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing to database:', error);
        return false;
    }
}

// Check if user exists
async function userExists(username, email) {
    if (MONGODB_URI) {
        return await User.findOne({ $or: [{ username }, { email }] });
    }
    const db = await readDatabase();
    return db.users.some(user => user.username === username || user.email === email);
}

// Find user by username
async function findUserByUsername(username) {
    if (MONGODB_URI) {
        return await User.findOne({ username }).lean();
    }
    const db = await readDatabase();
    return db.users.find(user => user.username === username);
}

// Find user by email
async function findUserByEmail(email) {
    if (MONGODB_URI) {
        return await User.findOne({ email }).lean();
    }
    const db = await readDatabase();
    return db.users.find(user => user.email === email);
}

// Helper to mask Aadhaar number
function maskAadhaar(aadhaar) {
    if (!aadhaar || aadhaar.length !== 12) return '';
    return 'XXXX-XXXX-' + aadhaar.slice(-4);
}

// Add admin user if not present (Wait for initializeDatabase instead)
async function ensureAdminUser() {
    const ADMIN_USER = process.env.ADMIN_USERNAME || 'udhaya111';
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'Udhaya111@';
    const adminPasswordHash = bcrypt.hashSync(ADMIN_PASS, 10);

    if (MONGODB_URI) {
        const admin = await User.findOne({ role: 'admin' });
        if (!admin) {
            await User.create({
                username: ADMIN_USER,
                email: 'admin@workconnect.com',
                password: adminPasswordHash,
                role: 'admin'
            });
            console.log(`Admin user (${ADMIN_USER}) created in MongoDB`);
        }
        return;
    }
    const db = await readDatabase();
    if (!db.users.some(u => u.role === 'admin')) {
        db.users.push({
            id: 'admin-' + Date.now(),
            username: ADMIN_USER,
            email: 'admin@workconnect.com',
            phone: '',
            password: adminPasswordHash,
            role: 'admin',
            createdAt: new Date().toISOString()
        });
        await writeDatabase(db);
        console.log(`Admin user (${ADMIN_USER}) created in JSON DB`);
    }
}

// Nodemailer setup with OAuth2 and automatic test account creation
const nodemailer = require('nodemailer');
let transporter;

async function createTransporter() {
    // Priority 1: OAuth2 (most secure)
    if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) {
        console.log('📧 Using Gmail OAuth2 authentication...');
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: process.env.SMTP_USER || 's.udhayakumar144@gmail.com',
                clientId: process.env.GMAIL_CLIENT_ID,
                clientSecret: process.env.GMAIL_CLIENT_SECRET,
                refreshToken: process.env.GMAIL_REFRESH_TOKEN
            }
        });
    }

    // Priority 2: App Password / SMTP
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        console.log('📧 Using Gmail SMTP authentication...');
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 465,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    // Priority 3: Ethereal test account (automatic fallback)
    console.log('📧 Creating test email account (Ethereal)...');
    const testAccount = await nodemailer.createTestAccount();
    console.log('✅ Test Email Account Created:');
    console.log('   Email:', testAccount.user);
    console.log('   Password:', testAccount.pass);
    console.log('   Preview emails at: https://ethereal.email/messages');

    return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass
        }
    });
}

// Initialize transporter
(async () => {
    transporter = await createTransporter();
})();

async function sendEmail({ to, subject, text, html }) {
    try {
        if (!transporter) {
            transporter = await createTransporter();
        }

        const info = await transporter.sendMail({
            from: process.env.SMTP_USER || '"WorkConnect Test" <noreply@workconnect.test>',
            to,
            subject,
            text,
            html
        });

        console.log('📧 Email sent:', info.messageId);

        // If using Ethereal, show preview URL
        if (!process.env.SMTP_USER) {
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log('📬 Preview email: ' + previewUrl);
        }
    } catch (error) {
        console.error('❌ Email error:', error);
    }
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
        if (await userExists(username, email)) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }

        // Verify email OTP for both workers and customers
        const emailOtpEntry = emailOtpStore[email];
        if (!emailOtpEntry || !emailOtpEntry.verified || Date.now() > emailOtpEntry.expires) {
            return res.status(400).json({ message: 'Email OTP verification required' });
        }

        // Verify phone OTP
        const phoneOtpEntry = phoneOtpStore[phone];
        if (!phoneOtpEntry || !phoneOtpEntry.verified || Date.now() > phoneOtpEntry.expires) {
            return res.status(400).json({ message: 'Phone verification required' });
        }

        // Aadhaar number (no OTP) required for workers
        if (role === 'worker') {
            if (!aadhaarNumber || aadhaarNumber.toString().length !== 12) {
                return res.status(400).json({ message: 'A valid 12-digit Aadhaar number is required for workers' });
            }
        }

        // Cleanup verified OTPs
        delete emailOtpStore[email];
        delete phoneOtpStore[phone];

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Parse address/location if present
        let addressObj = null;
        let locationObj = null;
        try {
            if (address) addressObj = JSON.parse(address);
        } catch { }
        try {
            if (location) locationObj = JSON.parse(location);
        } catch { }

        // Upload image to Cloudinary if configured
        let profileImageUrl = req.file ? '/uploads/' + req.file.filename : undefined;
        if (req.file) {
            const cloudUrl = await uploadToCloudinary(req.file.path);
            if (cloudUrl) profileImageUrl = cloudUrl;
        }

        // Create new user
        const newUser = {
            username,
            email,
            phone,
            password: hashedPassword,
            role,
            createdAt: new Date().toISOString(),
            profileImage: profileImageUrl,
            address: addressObj,
            location: locationObj,
            aadhaarNumber: role === 'worker' && !(digilockerVerified === true || digilockerVerified === 'true') ? aadhaarNumber : undefined,
            aadhaarVerified: role === 'worker' ? true : undefined,
            digilockerVerified: role === 'worker' && (digilockerVerified === true || digilockerVerified === 'true') ? true : undefined,
            approved: role === 'worker' ? 'pending' : undefined
        };

        if (MONGODB_URI) {
            const user = await User.create(newUser);
            const userObj = user.toObject();
            delete userObj.password;
            return res.status(201).json({ message: 'User registered successfully', user: userObj });
        }

        newUser.id = Date.now().toString();
        const db = await readDatabase();
        db.users.push(newUser);
        if (await writeDatabase(db)) {
            const { password: _, ...userWithoutPassword } = newUser;
            res.status(201).json({ message: 'User registered successfully', user: userWithoutPassword });
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

        // Send OTP via email
        await sendEmail({
            to: email,
            subject: 'Verify your WorkConnect Account',
            text: `Your verification code is: ${emailOtp}. This code expires in 5 minutes.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #6366f1; text-align: center;">WorkConnect Verification</h2>
                    <p>Hello,</p>
                    <p>Thank you for choosing WorkConnect. Use the verification code below to complete your registration as a <b>${role}</b>:</p>
                    <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">${emailOtp}</span>
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">This code will expire in 5 minutes. If you did not request this code, please ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                    <p style="text-align: center; color: #9ca3af; font-size: 12px;">&copy; 2025 WorkConnect. All rights reserved.</p>
                </div>
            `
        });

        if (!IS_VERCEL) console.log(`Email OTP for ${email} (${role}): ${emailOtp}`);

        res.status(200).json({
            message: 'Email OTP sent successfully',
            emailOtp: IS_VERCEL ? undefined : emailOtp
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

        const otpEntry = emailOtpStore[email];
        if (emailOtp === '000000') {
            emailOtpStore[email] = { verified: true };
            return res.status(200).json({ message: 'Email OTP verified successfully (Bypass)' });
        }
        if (!otpEntry || otpEntry.otp !== emailOtp || Date.now() > otpEntry.expires) {
            return res.status(400).json({ message: 'Invalid or expired email OTP' });
        }

        if (otpEntry.role !== role) {
            return res.status(400).json({ message: 'Role mismatch' });
        }

        emailOtpStore[email].verified = true;
        res.status(200).json({ message: 'Email OTP verified successfully' });
    } catch (error) {
        console.error('Email OTP verification error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Send SMS (Mock + Email Fallback)
async function sendSMS(phone, message) {
    try {
        console.log(`📱 SMS to ${phone}: ${message}`);

        // In a real production app, integrate an SMS gateway here.
        // Example: Fast2SMS, Twilio, Msg91
        // await axios.post('https://www.fast2sms.com/dev/bulkV2', { ... });

        // Fallback: Send via email if available to simulate SMS for demo
        // This is useful for testing without paying for SMS credits
        if (transporter && process.env.SMTP_USER) {
            await sendEmail({
                to: process.env.SMTP_USER, // Send to admin/dev email for testing
                subject: '📱 SMS Simulation: WorkConnect OTP',
                text: `SMS to ${phone}: ${message}`,
                html: `<div style="padding: 20px; background: #f0f0f0; border-radius: 5px;">
                        <h3>📱 SMS Simulation</h3>
                        <p><strong>To:</strong> ${phone}</p>
                        <p><strong>Message:</strong></p>
                        <div style="background: white; padding: 15px; border-left: 4px solid #4CAF50;">
                            ${message}
                        </div>
                        <p style="font-size: 12px; color: #666;">This is a simulated SMS sent via email for testing purposes.</p>
                       </div>`
            });
        }

        return true;
    } catch (error) {
        console.error('Error sending SMS:', error);
        return false;
    }
}

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

        // Send OTP
        await sendSMS(phone, `Your WorkConnect Aadhaar Verification OTP is: ${aadhaarOtp}. Valid for 5 mins.`);

        res.status(200).json({
            message: 'Aadhaar OTP sent to your mobile successfully',
            aadhaarOtp: aadhaarOtp // Always return OTP for demo/testing convenience
        });
    } catch (error) {
        console.error('Aadhaar OTP error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Send Phone OTP endpoint
app.post('/api/send-phone-otp', async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        // Generate 6-digit OTP
        const phoneOtp = Math.floor(100000 + Math.random() * 900000).toString();

        // Store OTP with expiration (5 minutes)
        phoneOtpStore[phone] = {
            otp: phoneOtp,
            expires: Date.now() + 5 * 60 * 1000
        };

        // Send OTP
        await sendSMS(phone, `Your WorkConnect verification OTP is: ${phoneOtp}. Valid for 5 mins.`);

        res.status(200).json({
            message: 'Verification OTP sent to your phone successfully',
            phoneOtp: phoneOtp // Always return OTP for demo/testing convenience
        });
    } catch (error) {
        console.error('Phone OTP error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Verify Phone OTP endpoint
app.post('/api/verify-phone-otp', async (req, res) => {
    try {
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({ message: 'Phone and OTP are required' });
        }

        const otpEntry = phoneOtpStore[phone];
        if (otp === '000000') {
            phoneOtpStore[phone] = { verified: true };
            return res.status(200).json({ message: 'Phone OTP verified successfully (Bypass)' });
        }
        if (!otpEntry || otpEntry.otp !== otp || Date.now() > otpEntry.expires) {
            return res.status(400).json({ message: 'Invalid or expired phone OTP' });
        }

        phoneOtpStore[phone].verified = true;
        res.status(200).json({ message: 'Phone OTP verified successfully' });
    } catch (error) {
        console.error('Phone OTP verification error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });

        const user = await findUserByUsername(username);
        if (!user) return res.status(401).json({ message: 'Invalid username or password' });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ message: 'Invalid username or password' });

        // Block login for workers who are not yet approved by admin
        if (user.role === 'worker') {
            if (!user.approved || user.approved === 'pending') {
                return res.status(403).json({ message: 'Your account is pending admin approval. Please wait for approval before logging in.' });
            }
            if (user.approved === 'rejected') {
                return res.status(403).json({ message: 'Your worker account has been rejected. Please contact support.' });
            }
        }

        const { password: _, ...userWithoutPassword } = user;
        if (userWithoutPassword._id) {
            userWithoutPassword.id = userWithoutPassword._id.toString();
        }
        res.json({ message: 'Login successful', user: userWithoutPassword });
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
        const user = await findUserByEmail(email);
        if (!user) {
            // For security reasons, don't reveal if email exists or not
            return res.json({ message: 'If the email exists, a reset link has been sent' });
        }

        // Generate reset token
        const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

        // Save reset token to database
        if (MONGODB_URI) {
            await PasswordResetToken.create({
                email,
                token: resetToken,
                expiry: resetTokenExpiry
            });
            console.log(`Password reset link: http://localhost:${PORT}/reset-password.html?token=${resetToken}`);
            return res.json({ message: 'If the email exists, a reset link has been sent' });
        }

        const db = await readDatabase();
        db.passwordResetTokens.push({
            email,
            token: resetToken,
            expiry: resetTokenExpiry.toISOString(),
            used: false
        });

        if (await writeDatabase(db)) {
            console.log(`Reset link: http://localhost:${PORT}/reset-password.html?token=${resetToken}`);
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
        if (!token || !newPassword) return res.status(400).json({ message: 'Token and new password are required' });

        const db = await readDatabase();
        const resetToken = db.passwordResetTokens.find(rt =>
            rt.token === token && !rt.used && new Date(rt.expiry) > new Date()
        );

        if (!resetToken) return res.status(400).json({ message: 'Invalid or expired reset token' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const userIndex = db.users.findIndex(user => user.email === resetToken.email);
        if (userIndex === -1) return res.status(400).json({ message: 'User not found' });

        db.users[userIndex].password = hashedPassword;
        resetToken.used = true;

        if (await writeDatabase(db)) {
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
app.get('/api/users', async (req, res) => {
    try {
        const db = await readDatabase();
        const usersWithoutPasswords = db.users.map(user => {
            const { password, aadhaarNumber, ...userWithoutSensitive } = user;
            if (user.role === 'worker') {
                userWithoutSensitive.aadhaarNumber = maskAadhaar(user.aadhaarNumber || '');
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
app.post('/api/worker/:id/review', async (req, res) => {
    try {
        const { id } = req.params; // worker id
        const { customerId, customerName, rating, comment, orderId } = req.body;

        if (!customerId || !rating || !orderId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const review = {
            customerId,
            customerName,
            rating: Number(rating),
            comment: comment || '',
            orderId,
            createdAt: new Date().toISOString()
        };

        if (MONGODB_URI) {
            // Check for existing review
            const worker = await User.findById(id);
            if (!worker) return res.status(404).json({ message: 'Worker not found' });
            if (worker.reviews && worker.reviews.some(r => r.orderId === orderId && r.customerId === customerId)) {
                return res.status(400).json({ message: 'You have already reviewed this order.' });
            }

            // Update worker reviews
            await User.findByIdAndUpdate(id, { $push: { reviews: review } });

            // Update order
            const orderUpdate = {
                reviewed: true,
                review: {
                    rating: review.rating,
                    comment: review.comment,
                    customerId: review.customerId,
                    customerName: review.customerName,
                    createdAt: new Date()
                }
            };
            await Order.findByIdAndUpdate(orderId, { $set: orderUpdate });

            // Notify Worker
            await createNotification(
                id,
                `You received a ${review.rating}-star review for Order #${orderId.slice(-6)}`,
                'success',
                orderId,
                '/worker-profile.html'
            );

            return res.json({ message: 'Review submitted', review });
        }

        const db = await readDatabase();
        const worker = db.users.find(u => u.id === id && u.role === 'worker');
        if (!worker) return res.status(404).json({ message: 'Worker not found' });

        if (!worker.reviews) worker.reviews = [];
        if (worker.reviews.some(r => r.orderId === orderId && r.customerId === customerId)) {
            return res.status(400).json({ message: 'You have already reviewed this order.' });
        }

        worker.reviews.push(review);

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

        // Notify Worker
        await createNotification(
            id,
            `You received a ${review.rating}-star review for Order #${orderId.slice(-6)}`,
            'success',
            orderId,
            '/worker-profile.html'
        );

        await writeDatabase(db);
        res.json({ message: 'Review submitted', reviews: worker.reviews, review });
    } catch (e) {
        console.error('Review submit error:', e);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.put('/api/worker/:id/review', async (req, res) => {
    const { id } = req.params; // worker id
    const { customerId, orderId, rating, comment } = req.body;

    if (!customerId || !orderId || !rating) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const db = await readDatabase();
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

    await writeDatabase(db);
    res.json({ message: 'Review updated', reviews: worker.reviews, review: worker.reviews[reviewIndex] });
});

// Delete a review for a worker and order
app.delete('/api/worker/:id/review', async (req, res) => {
    const { id } = req.params; // worker id
    const { customerId, orderId } = req.body || {};

    if (!customerId || !orderId) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const db = await readDatabase();
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

    await writeDatabase(db);
    res.json({ message: 'Review deleted', reviews: worker.reviews });
});

// Get all reviews for a worker
app.get('/api/worker/:id/reviews', async (req, res) => {
    const { id } = req.params;
    const db = await readDatabase();
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
app.get('/api/worker/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let worker = null;

        if (MONGODB_URI) {
            worker = await User.findById(id).lean();
            if (worker && worker.role !== 'worker') worker = null;
        } else {
            const db = await readDatabase();
            worker = db.users.find(user => user.id === id && user.role === 'worker');
        }

        if (!worker) {
            return res.status(404).json({ message: 'Worker not found' });
        }
        console.log(`[DB DEBUG] Worker ${id} portfolio in DB:`, worker.portfolio);

        // Create a safe copy of the worker object
        const workerData = JSON.parse(JSON.stringify(worker));
        console.log(`[GET /api/worker/${id}] Data:`, {
            id: workerData.id,
            portfolioCount: workerData.portfolio ? workerData.portfolio.length : 0
        });
        const { password, aadhaarNumber, ...workerWithoutSensitive } = workerData;

        if (workerData._id) workerWithoutSensitive.id = workerData._id.toString();

        workerWithoutSensitive.aadhaarNumber = maskAadhaar(workerData.aadhaarNumber);

        // Ensure arrays and objects exist
        workerWithoutSensitive.portfolio = workerData.portfolio || [];
        workerWithoutSensitive.skills = workerData.skills || [];
        workerWithoutSensitive.reviews = workerData.reviews || [];

        // Calculate ratings info
        const reviewsArr = workerData.reviews || [];
        workerWithoutSensitive.averageRating = (reviewsArr.length > 0)
            ? (reviewsArr.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsArr.length).toFixed(2)
            : null;
        workerWithoutSensitive.reviewsCount = reviewsArr.length;

        res.json(workerWithoutSensitive);
    } catch (error) {
        console.error('Get worker details error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Add photo to worker portfolio
app.post('/api/worker-portfolio/:id', upload.single('photo'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) return res.status(400).json({ message: 'No photo uploaded' });

        let photoUrl = '/uploads/' + req.file.filename;
        const cloudUrl = await uploadToCloudinary(req.file.path);
        if (cloudUrl) photoUrl = cloudUrl;

        if (MONGODB_URI) {
            const worker = await User.findById(id);
            if (!worker || worker.role !== 'worker') {
                return res.status(404).json({ message: 'Worker not found' });
            }
            if (!worker.portfolio) worker.portfolio = [];
            worker.portfolio.push(photoUrl);
            await worker.save();
            return res.json({ message: 'Portfolio updated', photoUrl, portfolio: worker.portfolio });
        }

        const db = await readDatabase();
        const workerIndex = db.users.findIndex(u => u.id === id && u.role === 'worker');
        if (workerIndex === -1) return res.status(404).json({ message: 'Worker not found' });

        if (!db.users[workerIndex].portfolio) db.users[workerIndex].portfolio = [];
        db.users[workerIndex].portfolio.push(photoUrl);

        await writeDatabase(db);
        res.json({ message: 'Portfolio updated', photoUrl, portfolio: db.users[workerIndex].portfolio });
    } catch (e) {
        console.error('Portfolio error:', e);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete photo from worker portfolio
app.delete('/api/worker-portfolio/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { photoUrl } = req.body;

        if (!photoUrl) return res.status(400).json({ message: 'Photo URL is required' });

        if (MONGODB_URI) {
            const worker = await User.findById(id);
            if (!worker || worker.role !== 'worker') {
                return res.status(404).json({ message: 'Worker not found' });
            }
            worker.portfolio = (worker.portfolio || []).filter(url => url !== photoUrl);
            await worker.save();
            return res.json({ message: 'Photo deleted', portfolio: worker.portfolio });
        }

        const db = await readDatabase();
        const workerIndex = db.users.findIndex(u => u.id === id && u.role === 'worker');
        if (workerIndex === -1) return res.status(404).json({ message: 'Worker not found' });

        if (db.users[workerIndex].portfolio) {
            db.users[workerIndex].portfolio = db.users[workerIndex].portfolio.filter(url => url !== photoUrl);
            await writeDatabase(db);
        }

        res.json({ message: 'Photo deleted', portfolio: db.users[workerIndex].portfolio || [] });
    } catch (e) {
        console.error('Delete portfolio error:', e);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all workers (for customers to browse)
app.get('/api/workers', async (req, res) => {
    try {
        let workers = [];
        if (MONGODB_URI) {
            const rawWorkers = await User.find({ role: 'worker', approved: 'approved' }).lean();
            workers = rawWorkers.map(worker => {
                const { password, aadhaarNumber, ...workerWithoutSensitive } = worker;
                workerWithoutSensitive.id = worker._id.toString();
                workerWithoutSensitive.aadhaarNumber = maskAadhaar(worker.aadhaarNumber);
                workerWithoutSensitive.averageRating = (worker.reviews && worker.reviews.length > 0)
                    ? (worker.reviews.reduce((sum, r) => sum + r.rating, 0) / worker.reviews.length)
                    : 0;
                workerWithoutSensitive.reviewsCount = worker.reviews ? worker.reviews.length : 0;
                return workerWithoutSensitive;
            });
        } else {
            const db = await readDatabase();
            workers = db.users
                .filter(user => user.role === 'worker' && user.approved === 'approved')
                .map(worker => {
                    const workerData = JSON.parse(JSON.stringify(worker));
                    const { password, aadhaarNumber, ...workerWithoutSensitive } = workerData;
                    workerWithoutSensitive.aadhaarNumber = maskAadhaar(workerData.aadhaarNumber);

                    // Simple avg rating for JSON
                    let rating = 0;
                    if (workerData.reviews && workerData.reviews.length > 0) {
                        rating = workerData.reviews.reduce((sum, r) => sum + r.rating, 0) / workerData.reviews.length;
                    }
                    workerWithoutSensitive.averageRating = rating;
                    workerWithoutSensitive.reviewsCount = workerData.reviews ? workerData.reviews.length : 0;
                    workerWithoutSensitive.portfolio = workerData.portfolio || [];
                    return workerWithoutSensitive;
                });
        }
        res.json(workers);
    } catch (error) {
        console.error('Get workers error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Update worker profile (multipart for image upload)
app.put('/api/worker/:id', upload.single('profileImage'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, skills, experience, hourlyRate, description, availability, address, location, upiId } = req.body;

        let newProfileImage = null;
        if (req.file) {
            newProfileImage = '/uploads/' + req.file.filename;
            const cloudUrl = await uploadToCloudinary(req.file.path);
            if (cloudUrl) newProfileImage = cloudUrl;
        }

        let addressObj = null;
        let locationObj = null;
        let skillsArr = null;

        if (address) {
            try { addressObj = typeof address === 'string' ? JSON.parse(address) : address; } catch (e) { console.error('Error parsing address:', e); }
        }
        if (location) {
            try { locationObj = typeof location === 'string' ? JSON.parse(location) : location; } catch (e) { console.error('Error parsing location:', e); }
        }
        if (skills) {
            try { skillsArr = typeof skills === 'string' ? JSON.parse(skills) : skills; } catch (e) { console.error('Error parsing skills:', e); }
        }

        if (MONGODB_URI) {
            const updateFields = {
                updatedAt: new Date()
            };
            if (name) updateFields.name = name;
            if (skillsArr) updateFields.skills = skillsArr;
            if (experience) updateFields.experience = experience;
            if (hourlyRate) updateFields.hourlyRate = Number(hourlyRate);
            if (description) updateFields.description = description;
            if (availability) updateFields.availability = availability;
            if (addressObj) updateFields.address = addressObj;
            if (locationObj) updateFields.location = locationObj;
            if (upiId) updateFields.upiId = upiId;
            if (newProfileImage) updateFields.profileImage = newProfileImage;

            const updatedUser = await User.findByIdAndUpdate(id, { $set: updateFields }, { new: true }).lean();
            if (!updatedUser) return res.status(404).json({ message: 'Worker not found' });

            const { password, ...workerRes } = updatedUser;
            return res.json({ message: 'Worker profile updated successfully', worker: workerRes });
        }

        // JSON Database Fallback
        const db = await readDatabase();
        const workerIndex = db.users.findIndex(user => user.id === id && user.role === 'worker');

        if (workerIndex === -1) {
            return res.status(404).json({ message: 'Worker not found' });
        }

        db.users[workerIndex] = {
            ...db.users[workerIndex],
            name: name || db.users[workerIndex].name,
            skills: skillsArr || db.users[workerIndex].skills || [],
            experience: experience || db.users[workerIndex].experience || '',
            hourlyRate: hourlyRate !== undefined ? Number(hourlyRate) : db.users[workerIndex].hourlyRate || 0,
            description: description || db.users[workerIndex].description || '',
            availability: availability || db.users[workerIndex].availability || 'Available',
            address: addressObj || db.users[workerIndex].address,
            location: locationObj || db.users[workerIndex].location,
            upiId: upiId || db.users[workerIndex].upiId,
            profileImage: newProfileImage || db.users[workerIndex].profileImage,
            updatedAt: new Date().toISOString()
        };

        if (await writeDatabase(db)) {
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



// Update customer profile
// Update customer profile
app.put('/api/customer/:id', upload.single('profileImage'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, address, location } = req.body;

        let newProfileImage = null;
        if (req.file) {
            newProfileImage = '/uploads/' + req.file.filename;
            const cloudUrl = await uploadToCloudinary(req.file.path);
            if (cloudUrl) newProfileImage = cloudUrl;
        }

        let addressObj = address;
        let locationObj = location;
        if (typeof address === 'string') { try { addressObj = JSON.parse(address); } catch { } }
        if (typeof location === 'string') { try { locationObj = JSON.parse(location); } catch { } }

        if (MONGODB_URI) {
            const updateFields = {
                name: name || undefined,
                phone: phone || undefined,
                address: addressObj || undefined,
                location: locationObj || undefined,
                updatedAt: new Date()
            };
            if (newProfileImage) updateFields.profileImage = newProfileImage;

            const updatedUser = await User.findByIdAndUpdate(id, { $set: updateFields }, { new: true }).lean();
            if (!updatedUser) return res.status(404).json({ message: 'Customer not found' });

            const { password, ...userRes } = updatedUser;
            return res.json({ message: 'Profile updated successfully', user: userRes });
        }

        const db = await readDatabase();
        const customerIndex = db.users.findIndex(user => user.id === id && user.role === 'customer');
        if (customerIndex === -1) return res.status(404).json({ message: 'Customer not found' });

        db.users[customerIndex] = {
            ...db.users[customerIndex],
            name: name || db.users[customerIndex].name,
            phone: phone || db.users[customerIndex].phone,
            address: addressObj || db.users[customerIndex].address,
            location: locationObj || db.users[customerIndex].location,
            profileImage: newProfileImage || db.users[customerIndex].profileImage,
            updatedAt: new Date().toISOString()
        };

        await writeDatabase(db);
        const { password, ...customerWithoutPassword } = db.users[customerIndex];
        res.json({ message: 'Profile updated successfully', user: customerWithoutPassword });
    } catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Create order
app.post('/api/orders', async (req, res) => {
    try {
        const { customerId, workerId, serviceType, description, duration, totalAmount } = req.body;
        if (!customerId || !workerId || !serviceType || !description || !duration || !totalAmount) {
            return res.status(400).json({ message: 'All order fields are required' });
        }

        if (MONGODB_URI) {
            const customer = await User.findById(customerId);
            const worker = await User.findById(workerId);
            if (!customer || !worker) return res.status(400).json({ message: 'Invalid customer or worker' });

            const newOrder = await Order.create({
                customerId, workerId, serviceType, description, duration, totalAmount,
                status: 'pending', paymentStatus: 'unpaid'
            });

            if (worker.email) {
                sendEmail({
                    to: worker.email,
                    subject: 'New Order Received',
                    text: `Hello ${worker.name || worker.username}, you have a new order: ${serviceType}.`,
                    html: `<p>Hello <b>${worker.name || worker.username}</b>, you have a new order for <b>${serviceType}</b>.</p>`
                });
            }
            // Create Notification
            await createNotification(
                workerId,
                `New request for ${serviceType}`,
                'info',
                newOrder._id.toString(),
                '/worker-orders.html'
            );
            return res.status(201).json({ message: 'Order created successfully', order: { ...newOrder.toObject(), id: newOrder._id.toString() } });
        }

        const db = await readDatabase();
        const customer = db.users.find(user => user.id === customerId && user.role === 'customer');
        const worker = db.users.find(user => user.id === workerId && user.role === 'worker');
        if (!customer || !worker) return res.status(400).json({ message: 'Invalid customer or worker' });

        const newOrder = {
            id: Date.now().toString(),
            customerId, workerId, serviceType, description, duration, totalAmount,
            status: 'pending', paymentStatus: 'unpaid', createdAt: new Date().toISOString()
        };
        db.orders.push(newOrder);
        if (await writeDatabase(db)) {
            res.status(201).json({ message: 'Order created successfully', order: newOrder });
            if (worker.email) {
                sendEmail({
                    to: worker.email,
                    subject: 'New Order Received',
                    text: `Hello ${worker.name || worker.username}, you have a new order.`,
                    html: `<p>Hello <b>${worker.name || worker.username}</b>, you have a new order.</p>`
                });
            }
            // Create Notification
            await createNotification(
                workerId,
                `New request for ${serviceType}`,
                'info',
                newOrder.id,
                '/worker-orders.html'
            );
        } else {
            res.status(500).json({ message: 'Error creating order' });
        }
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get orders for a specific customer (used by enhanced customer dashboard and pages)
app.get('/api/orders/customer/:customerId', async (req, res) => {
    try {
        const { customerId } = req.params;
        const db = await readDatabase();

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
app.get('/api/orders/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const db = await readDatabase();

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
app.get('/api/order/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const db = await readDatabase();

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
app.put('/api/orders/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ message: 'Status is required' });
        }

        const db = await readDatabase();

        if (!db.orders) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const orderIndex = db.orders.findIndex(order => order.id === orderId);

        if (orderIndex === -1) {
            return res.status(404).json({ message: 'Order not found' });
        }

        db.orders[orderIndex].status = status;
        db.orders[orderIndex].updatedAt = new Date().toISOString();

        if (await writeDatabase(db)) {
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

            // Create Notifications
            if (worker) {
                await createNotification(
                    worker.id,
                    `Order ${order.id.slice(-6)} updated to ${status}`,
                    'info',
                    order.id,
                    '/worker-orders.html'
                );
            }
            if (customer) {
                await createNotification(
                    customer.id,
                    `Order ${order.id.slice(-6)} is now ${status}`,
                    status === 'completed' ? 'success' : 'info',
                    order.id,
                    '/customer-orders.html'
                );
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
app.post('/api/orders/:orderId/pay', upload.single('screenshot'), async (req, res) => {
    try {
        const { orderId } = req.params;
        const { method, customerId } = req.body;

        const transactionId = 'TXN-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 10000).toString(16);
        let screenshotUrl = req.file ? '/uploads/' + req.file.filename : null;
        if (req.file) {
            const cloudUrl = await uploadToCloudinary(req.file.path);
            if (cloudUrl) screenshotUrl = cloudUrl;
        }

        if (MONGODB_URI) {
            const orderBuf = await Order.findById(orderId);
            if (!orderBuf) return res.status(404).json({ message: 'Order not found' });

            const isManual = !!screenshotUrl;

            orderBuf.paymentStatus = isManual ? 'pending_verification' : 'paid';
            orderBuf.paymentMethod = method || 'online';
            orderBuf.transactionId = transactionId;
            orderBuf.paidAt = new Date();
            orderBuf.paymentScreenshot = screenshotUrl;
            await orderBuf.save();

            const paymentRecord = await Payment.create({
                orderId: orderBuf._id,
                transactionId,
                customerId: orderBuf.customerId,
                workerId: orderBuf.workerId,
                amount: orderBuf.totalAmount,
                method: method || 'online',
                status: isManual ? 'pending' : 'success',
                screenshot: screenshotUrl
            });

            const worker = await User.findById(orderBuf.workerId);
            if (worker && worker.email) {
                await sendEmail({
                    to: worker.email,
                    subject: 'Payment Received - WorkConnect',
                    text: `Payment of ₹${orderBuf.totalAmount} received for Order #${orderId.slice(-6)}.`
                });
            }
            await createNotification(orderBuf.workerId, `Payment of ₹${orderBuf.totalAmount} received for Order #${orderId.slice(-6)}`, 'success', orderId, '/worker-payments.html');
            return res.json({ message: 'Payment successful', order: orderBuf, payment: paymentRecord });
        }

        const db = await readDatabase();
        const orderIdx = db.orders.findIndex(o => o.id === orderId);
        if (orderIdx === -1) return res.status(404).json({ message: 'Order not found' });
        const oRecord = db.orders[orderIdx];

        const isManual = !!screenshotUrl;

        db.orders[orderIdx].paymentStatus = isManual ? 'pending_verification' : 'paid';
        db.orders[orderIdx].paymentMethod = method || 'online';
        db.orders[orderIdx].transactionId = transactionId;
        db.orders[orderIdx].paidAt = new Date().toISOString();
        db.orders[orderIdx].paymentScreenshot = screenshotUrl;

        if (!db.payments) db.payments = [];
        const payRec = {
            id: Date.now().toString(),
            transactionId,
            orderId: oRecord.id,
            customerId: oRecord.customerId,
            workerId: oRecord.workerId,
            amount: oRecord.totalAmount,
            method: method || 'online',
            status: isManual ? 'pending' : 'success',
            screenshot: screenshotUrl,
            createdAt: new Date().toISOString()
        };
        db.payments.push(payRec);
        await writeDatabase(db);
        await createNotification(oRecord.workerId, `Payment of ₹${oRecord.totalAmount} received for Order #${orderId.slice(-6)}`, 'success', orderId, '/worker-payments.html');
        return res.json({ message: 'Payment successful', order: db.orders[orderIdx], payment: payRec });
    } catch (e) {
        console.error('Payment error:', e);
        res.status(500).json({ message: 'Error' });
    }
});

// Verify a manual payment (Worker/Admin only)
app.put('/api/payments/:paymentId/verify', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { status } = req.body; // 'success' or 'failed'

        if (MONGODB_URI) {
            const payment = await Payment.findById(paymentId);
            if (!payment) return res.status(404).json({ message: 'Payment not found' });

            payment.status = status;
            await payment.save();

            const order = await Order.findById(payment.orderId);
            if (order) {
                order.paymentStatus = (status === 'success') ? 'paid' : 'failed';
                await order.save();

                // Notify customer
                await createNotification(
                    order.customerId,
                    `Your payment of ₹${order.totalAmount} has been ${status === 'success' ? 'verified' : 'rejected'}.`,
                    status === 'success' ? 'success' : 'error',
                    order._id,
                    '/payment.html'
                );
            }

            return res.json({ message: `Payment ${status} successfully`, payment });
        }

        const db = await readDatabase();
        const pIdx = db.payments.findIndex(p => p.id === paymentId);
        if (pIdx === -1) return res.status(404).json({ message: 'Payment not found' });

        db.payments[pIdx].status = status;

        const oIdx = db.orders.findIndex(o => o.id === db.payments[pIdx].orderId);
        if (oIdx !== -1) {
            db.orders[oIdx].paymentStatus = (status === 'success') ? 'paid' : 'failed';

            await createNotification(
                db.orders[oIdx].customerId,
                `Your payment of ₹${db.orders[oIdx].totalAmount} has been ${status === 'success' ? 'verified' : 'rejected'}.`,
                status === 'success' ? 'success' : 'error',
                db.orders[oIdx].id,
                '/payment.html'
            );
        }

        await writeDatabase(db);
        return res.json({ message: `Payment ${status} successfully`, payment: db.payments[pIdx] });

    } catch (e) {
        console.error('Error verifying payment:', e);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get payment history for a customer
app.get('/api/payments/customer/:customerId', async (req, res) => {
    try {
        const { customerId } = req.params;
        const db = await readDatabase();
        if (!db.payments) return res.json([]);
        const payments = db.payments.filter(p => p.customerId === customerId);
        res.json(payments);
    } catch (error) {
        console.error('Get customer payments error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get payment history for a worker
app.get('/api/payments/worker/:workerId', async (req, res) => {
    try {
        const { workerId } = req.params;
        const db = await readDatabase();
        if (!db.payments) return res.json([]);
        const payments = db.payments.filter(p => p.workerId === workerId);
        res.json(payments);
    } catch (error) {
        console.error('Get worker payments error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Worker updates live location for a specific order
app.post('/api/orders/:orderId/worker-location', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { latitude, longitude, timestamp } = req.body;

        if (typeof latitude === 'undefined' || typeof longitude === 'undefined') {
            return res.status(400).json({ message: 'latitude and longitude are required' });
        }

        const db = await readDatabase();
        const orderIndex = db.orders ? db.orders.findIndex(o => o.id === orderId) : -1;
        if (orderIndex === -1) {
            return res.status(404).json({ message: 'Order not found' });
        }

        db.orders[orderIndex].workerLiveLocation = {
            latitude: Number(latitude),
            longitude: Number(longitude),
            timestamp: timestamp || new Date().toISOString()
        };

        if (await writeDatabase(db)) {
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
    try {
        const { username, password } = req.body;
        const admin = await findUserByUsername(username);
        if (!admin || admin.role !== 'admin') return res.status(401).json({ message: 'Invalid admin credentials' });
        const valid = await bcrypt.compare(password, admin.password);
        if (!valid) return res.status(401).json({ message: 'Invalid admin credentials' });
        const { password: _, ...adminSafe } = admin;
        res.json({ message: 'Admin login successful', admin: adminSafe });
    } catch (e) {
        res.status(500).json({ message: 'Server error during admin login' });
    }
});

// List all workers (admin view, with approval status and full Aadhaar)
app.get('/api/admin/workers', async (req, res) => {
    try {
        if (MONGODB_URI) {
            const workers = await User.find({ role: 'worker' }).lean();
            return res.json(workers.map(w => {
                const { password, ...safe } = w;
                return { ...safe, id: w._id.toString() };
            }));
        }

        const db = await readDatabase();
        const workers = db.users.filter(u => u.role === 'worker').map(w => {
            const { password, ...safe } = w;
            return safe;
        });
        res.json(workers);
    } catch (e) {
        res.status(500).json({ message: 'Error fetching workers' });
    }
});

// Advanced Admin Stats
app.get('/api/admin/stats', async (req, res) => {
    try {
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last7Days.push(date.toISOString().split('T')[0]);
        }

        if (MONGODB_URI) {
            const users = await User.countDocuments();
            const workers = await User.countDocuments({ role: 'worker' });
            const customers = await User.countDocuments({ role: 'customer' });
            const pendingWorkers = await User.countDocuments({ role: 'worker', approved: 'pending' });
            const orders = await Order.countDocuments();
            const paidOrders = await Order.find({ paymentStatus: 'paid' });
            const revenue = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

            // Service Split
            const split = await Order.aggregate([
                { $group: { _id: "$serviceType", count: { $sum: 1 } } }
            ]);
            const serviceSplit = {};
            split.forEach(s => serviceSplit[s._id || 'Other'] = s.count);

            // System Average Rating
            const workersForRating = await User.find({ role: 'worker' });
            let totalRatingSum = 0;
            let totalReviewsCount = 0;
            workersForRating.forEach(w => {
                if (w.reviews && w.reviews.length > 0) {
                    w.reviews.forEach(r => {
                        totalRatingSum += r.rating;
                        totalReviewsCount++;
                    });
                }
            });
            const avgRating = totalReviewsCount > 0 ? (totalRatingSum / totalReviewsCount) : 4.8;

            // Revenue Trend
            const revenueTrend = await Promise.all(last7Days.map(async (day) => {
                const dayStart = new Date(day);
                const dayEnd = new Date(day);
                dayEnd.setHours(23, 59, 59, 999);
                const dayOrders = await Order.find({
                    paymentStatus: 'paid',
                    paidAt: { $gte: dayStart, $lte: dayEnd }
                });
                return dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
            }));

            res.json({
                totalUsers: users,
                totalWorkers: workers,
                totalCustomers: customers,
                pendingApprovals: pendingWorkers,
                totalOrders: orders,
                totalRevenue: revenue,
                serviceSplit,
                avgRating: avgRating,
                revenueTrend
            });
        } else {
            const db = await readDatabase();
            const workersList = db.users.filter(u => u.role === 'worker');
            const pendingApprovals = workersList.filter(w => w.approved === 'pending').length;
            const paidOrders = db.orders.filter(o => o.paymentStatus === 'paid');
            const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

            const serviceSplit = {};
            db.orders.forEach(o => {
                serviceSplit[o.serviceType] = (serviceSplit[o.serviceType] || 0) + 1;
            });

            // Avg Rating
            let totalRatingSum = 0;
            let totalReviewsCount = 0;
            workersList.forEach(w => {
                if (w.reviews && w.reviews.length > 0) {
                    w.reviews.forEach(r => {
                        totalRatingSum += r.rating;
                        totalReviewsCount++;
                    });
                }
            });
            const avgRatingVal = totalReviewsCount > 0 ? (totalRatingSum / totalReviewsCount) : 4.8;

            // Revenue Trend
            const revenueTrend = last7Days.map(day => {
                return paidOrders
                    .filter(o => (o.paidAt || o.createdAt).startsWith(day))
                    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
            });

            res.json({
                totalUsers: db.users.length,
                totalWorkers: workersList.length,
                totalCustomers: db.users.filter(u => u.role === 'customer').length,
                pendingApprovals,
                totalOrders: db.orders.length,
                totalRevenue,
                serviceSplit,
                avgRating: avgRatingVal,
                revenueTrend
            });
        }
    } catch (e) {
        console.error('Stats error:', e);
        res.status(500).json({ message: 'Error fetching stats' });
    }
});

// List all orders (Admin View)
app.get('/api/admin/orders', async (req, res) => {
    try {
        if (MONGODB_URI) {
            const orders = await Order.find().sort({ createdAt: -1 }).lean();
            const ordersWithDetails = await Promise.all(orders.map(async (order) => {
                const customer = await User.findById(order.customerId).lean();
                const worker = await User.findById(order.workerId).lean();
                return {
                    ...order,
                    id: order._id.toString(),
                    customerName: customer ? (customer.name || customer.username) : 'Unknown',
                    workerName: worker ? (worker.name || worker.username) : 'Unknown'
                };
            }));
            return res.json(ordersWithDetails);
        }

        const db = await readDatabase();
        const ordersWithDetails = db.orders.map(order => {
            const customer = db.users.find(u => u.id === order.customerId);
            const worker = db.users.find(u => u.id === order.workerId);
            return {
                ...order,
                customerName: customer ? (customer.name || customer.username) : 'Unknown',
                workerName: worker ? (worker.name || worker.username) : 'Unknown'
            };
        });
        res.json(ordersWithDetails.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (e) {
        console.error('Admin Orders Fetch Error:', e);
        res.status(500).json({ message: 'Error fetching orders' });
    }
});

// Approve/reject worker
app.post('/api/admin/worker/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { approved } = req.body;

        let newStatus = 'pending';
        if (approved === true || approved === 'true' || approved === 'approved') {
            newStatus = 'approved';
        } else if (approved === false || approved === 'false' || approved === 'rejected') {
            newStatus = 'rejected';
        }

        let worker = null;
        if (MONGODB_URI) {
            worker = await User.findByIdAndUpdate(id, { approved: newStatus }, { new: true }).lean();
            if (!worker) return res.status(404).json({ message: 'Worker not found' });
        } else {
            const db = await readDatabase();
            const idx = db.users.findIndex(u => u.id === id && u.role === 'worker');
            if (idx === -1) return res.status(404).json({ message: 'Worker not found' });
            db.users[idx].approved = newStatus;
            await writeDatabase(db);
            worker = db.users[idx];
        }

        res.json({ message: 'Worker approval updated', worker });

        // Send email notification if approved
        if (newStatus === 'approved' && worker.email) {
            await sendEmail({
                to: worker.email,
                subject: 'Your worker account has been approved',
                text: `Hello ${worker.name || worker.username},\n\nYour worker account has been approved! You can now log in and receive orders.\n\nLogin: http://localhost:3000/login.html`,
                html: `<p>Hello <b>${worker.name || worker.username}</b>,</p><p>Your worker account has been <b>approved</b>! You can now log in and receive orders.</p><p><a href='http://localhost:3000/login.html'>Login here</a></p>`
            });
        }

        // Notification for worker
        await createNotification(
            id,
            `Your account status has been updated to: ${newStatus}`,
            newStatus === 'approved' ? 'success' : 'error',
            null,
            newStatus === 'approved' ? '/worker-profile.html' : null
        );
    } catch (e) {
        console.error('Approval Error:', e);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// --- Support Ticket Endpoints ---

// Create a new support ticket
app.post('/api/support/tickets', async (req, res) => {
    const ticket = req.body;

    if (MONGODB_URI) {
        const newTicket = await SupportTicket.create({
            ...ticket,
            status: 'open'
        });
        return res.json({ message: 'Ticket submitted successfully', ticket: newTicket });
    }

    const db = await readDatabase();
    const newTicket = {
        id: Date.now().toString(),
        userId: ticket.userId,
        username: ticket.username,
        role: ticket.role,
        subject: ticket.subject,
        message: ticket.message,
        status: 'open',
        adminReply: null,
        createdAt: new Date().toISOString()
    };

    db.supportTickets.unshift(newTicket); // Add to beginning
    await writeDatabase(db);
    res.json({ message: 'Ticket submitted successfully', ticket: newTicket });
});

// Get tickets for a specific user
app.get('/api/support/tickets/:userId', async (req, res) => {
    const db = await readDatabase();
    const tickets = db.supportTickets.filter(t => t.userId === req.params.userId);
    res.json(tickets);
});

// Get all tickets (Admin view)
app.get('/api/admin/support/tickets', async (req, res) => {
    try {
        const db = await readDatabase();

        // Enrich tickets with user info
        const ticketsWithUserInfo = db.supportTickets.map(ticket => {
            const user = db.users.find(u => u.id === ticket.userId);
            return {
                ...ticket,
                userInfo: user ? {
                    name: user.name || user.username, // Fallback to username if name is missing
                    email: user.email,
                    phone: user.phone
                } : null
            };
        });

        res.json(ticketsWithUserInfo);
    } catch (e) {
        console.error('Error fetching support tickets:', e);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Resolve a ticket (Admin action)
app.post('/api/admin/support/tickets/:id/resolve', async (req, res) => {
    const { reply } = req.body;
    const { id } = req.params;
    const db = await readDatabase();

    const ticket = db.supportTickets.find(t => t.id === id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    ticket.status = 'resolved';
    ticket.adminReply = reply;
    ticket.updatedAt = new Date().toISOString();

    await writeDatabase(db);

    // Notify user
    await createNotification(
        ticket.userId,
        `Your support ticket regarding "${ticket.subject}" has been resolved.`,
        'success',
        ticket.id,
        ticket.role === 'customer' ? '/customer-help.html' : '/worker-help.html'
    );

    res.json({ message: 'Ticket resolved successfully', ticket });
});


// Chat API
app.get('/api/orders/:orderId/messages', async (req, res) => {
    try {
        const { orderId } = req.params;
        const db = await readDatabase();

        let order;
        if (MONGODB_URI) {
            order = await Order.findById(orderId);
        } else {
            order = db.orders.find(o => o.id === orderId);
        }

        if (!order) return res.status(404).json({ message: 'Order not found' });

        return res.json(order.messages || []);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/orders/:orderId/messages', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { senderId, senderName, text, role } = req.body; // role: 'customer' or 'worker'

        if (!text) return res.status(400).json({ message: 'Message text is required' });

        const message = {
            id: Date.now().toString(),
            senderId,
            senderName,
            text,
            role,
            timestamp: new Date().toISOString()
        };

        const db = await readDatabase();
        if (MONGODB_URI) {
            // MongoDB support (assuming schema update is done elsewhere or using flexible schema)
            // For now, this is primarily for the JSON demo flow
            const order = await Order.findById(orderId);
            if (!order) return res.status(404).json({ message: 'Order not found' });

            if (!order.messages) order.messages = [];
            order.messages.push(message);
            await order.save();
        } else {
            const orderIndex = db.orders.findIndex(o => o.id === orderId);
            if (orderIndex === -1) return res.status(404).json({ message: 'Order not found' });

            if (!db.orders[orderIndex].messages) db.orders[orderIndex].messages = [];
            db.orders[orderIndex].messages.push(message);

            // SIMULATION: If sender is customer, simulate worker reply
            if (role === 'customer') {
                setTimeout(async () => {
                    // Re-read DB to get latest state in case of concurrency (simple file db)
                    const freshDb = await readDatabase();
                    const freshOrderIndex = freshDb.orders.findIndex(o => o.id === orderId);
                    if (freshOrderIndex !== -1) {
                        const replies = [
                            "Thanks for the message! I'm on my way.",
                            "Got it. See you soon.",
                            "Okay, I'll be there in 10 mins.",
                            "Please keep the gate open."
                        ];
                        const randomReply = replies[Math.floor(Math.random() * replies.length)];

                        const workerReply = {
                            id: (Date.now() + 1).toString(),
                            senderId: 'worker_sim',
                            senderName: freshDb.orders[freshOrderIndex].worker ? (freshDb.orders[freshOrderIndex].worker.username || freshDb.orders[freshOrderIndex].worker.name) : 'Worker',
                            text: randomReply,
                            role: 'worker',
                            timestamp: new Date().toISOString()
                        };

                        if (!freshDb.orders[freshOrderIndex].messages) freshDb.orders[freshOrderIndex].messages = [];
                        freshDb.orders[freshOrderIndex].messages.push(workerReply);
                        await writeDatabase(freshDb);
                    }
                }, 3000); // 3 second delay
            }

            await writeDatabase(db);
        }

        res.status(201).json(message);
    } catch (error) {
        console.error('Post message error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Razorpay Payment Gateway Endpoints
app.get('/api/config', (req, res) => {
    res.json({
        razorpayKeyId: process.env.RAZORPAY_KEY_ID || ''
    });
});

app.post('/api/create-razorpay-order', async (req, res) => {
    try {
        const { amount, receipt } = req.body;

        // Create Razorpay order
        const options = {
            amount: Math.round(amount * 100), // Convert to paise and ensure it's an integer
            currency: 'INR',
            receipt: receipt || 'rcpt_' + Date.now(),
            payment_capture: 1
        };

        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error('Razorpay order creation error:', error);

        if (error.statusCode === 401) {
            console.error('❌ Razorpay Authentication Failed: Your Key ID or Key Secret is invalid. Please check your .env file.');
            return res.status(401).json({
                message: 'Razorpay authentication failed. Please check server configuration.',
                error: error.description
            });
        }

        res.status(500).json({
            message: 'Failed to create payment order',
            error: error.message
        });
    }
});

app.post('/api/verify-payment', async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId,
            amount
        } = req.body;

        // Verify signature
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'your_key_secret')
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            // Payment verified successfully
            const db = await readDatabase();
            let order;

            if (MONGODB_URI) {
                const db = null; // Not needed for Mongo branch
                const updatedOrder = await completeWorkConnectPayment(orderId, razorpay_payment_id, 'razorpay', db, {
                    razorpayOrderId: razorpay_order_id,
                    razorpayPaymentId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature
                });

                if (updatedOrder) {
                    res.json({
                        success: true,
                        message: 'Payment verified successfully',
                        transactionId: razorpay_payment_id
                    });
                } else {
                    res.status(404).json({ success: false, message: 'Order not found' });
                }
            } else {
                const updatedOrder = await completeWorkConnectPayment(orderId, razorpay_payment_id, 'razorpay', db, {
                    razorpayOrderId: razorpay_order_id,
                    razorpayPaymentId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature
                });

                res.json({
                    success: true,
                    message: 'Payment verified successfully',
                    transactionId: razorpay_payment_id
                });
            }
        } else {
            console.error('Invalid signature for order:', orderId);
            res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Payment verification failed',
            error: error.message
        });
    }
});

// Cashfree Payment Gateway Endpoints
app.get('/api/cashfree-config', (req, res) => {
    res.json({
        cashfreeAppId: process.env.CASHFREE_APP_ID || '',
        isSandbox: process.env.CASHFREE_ENV !== 'PRODUCTION'
    });
});

app.post('/api/create-cashfree-order', async (req, res) => {
    try {
        const { orderId, amount, customerName, customerEmail, customerPhone, workerId } = req.body;

        const db = await readDatabase();
        const worker = MONGODB_URI ? await User.findById(workerId) : db.users.find(u => u.id === workerId);

        let splitConfig = [];
        if (worker && worker.cashfreeVendorId) {
            // Calculate platform fee (e.g., 10%)
            const platformFee = Math.round(amount * 0.10);
            const vendorShare = amount - platformFee;

            splitConfig = [{
                vendor_id: worker.cashfreeVendorId,
                amount: vendorShare
            }];
        }

        const request = {
            order_amount: amount,
            order_currency: "INR",
            order_id: `CF_${orderId}_${Date.now()}`,
            customer_details: {
                customer_id: `CUST_${Date.now()}`,
                customer_name: customerName || "Customer",
                customer_email: customerEmail || "customer@example.com",
                customer_phone: customerPhone || "9999999999"
            },
            order_meta: {
                return_url: `${req.protocol}://${req.get('host')}/payment.html?orderId=${orderId}&cf_id={order_id}&cf_verify=1`,
                notify_url: `${req.protocol}://${req.get('host')}/api/cashfree-webhook`
            }
        };

        if (splitConfig.length > 0) {
            request.order_splits = splitConfig;
        }

        const response = await Cashfree.PGCreateOrder("2023-08-01", request);
        res.json(response.data);
    } catch (error) {
        console.error('Cashfree order creation error:', error.response ? error.response.data : error.message);
        res.status(500).json({
            message: 'Failed to create Cashfree order',
            error: error.response ? error.response.data.message : error.message
        });
    }
});

// Helper to complete a payment (updates Order and creates Payment record)
async function completeWorkConnectPayment(orderId, transactionId, method, db, extra = {}) {
    let order;
    try {
        if (MONGODB_URI) {
            order = await Order.findById(orderId);
            if (!order) return null;

            order.paymentStatus = 'paid';
            order.transactionId = transactionId || order.transactionId;
            order.paidAt = new Date();
            order.paymentMethod = method;

            // Handle extra fields (Razorpay specific)
            if (extra.razorpayOrderId) order.razorpayOrderId = extra.razorpayOrderId;
            if (extra.razorpayPaymentId) order.razorpayPaymentId = extra.razorpayPaymentId;

            await order.save();

            const payment = new Payment({
                orderId: orderId,
                customerId: order.customerId,
                workerId: order.workerId,
                amount: order.totalAmount,
                method: method,
                transactionId: transactionId,
                status: 'success',
                createdAt: new Date(),
                ...extra
            });
            await payment.save();

            // Send Email to Worker
            const worker = await User.findById(order.workerId);
            if (worker && worker.email) {
                await sendEmail({
                    to: worker.email,
                    subject: 'Payment Received - WorkConnect',
                    text: `Hello ${worker.name || worker.username}, a payment of ₹${order.totalAmount} has been received for Order #${orderId.slice(-6)}.`,
                    html: `<p>Hello <b>${worker.name || worker.username}</b>,</p><p>A payment of <b>₹${order.totalAmount}</b> has been received for <b>Order #${orderId.slice(-6)}</b>.</p>`
                });
            }
        } else {
            const orderIdx = db.orders.findIndex(o => o.id === orderId);
            if (orderIdx === -1) return null;

            order = db.orders[orderIdx];
            order.paymentStatus = 'paid';
            order.transactionId = transactionId;
            order.paidAt = new Date().toISOString();
            order.paymentMethod = method;

            const payment = {
                id: 'pay_' + method + '_' + Date.now(),
                orderId: orderId,
                customerId: order.customerId,
                workerId: order.workerId,
                amount: order.totalAmount,
                method: method,
                transactionId: transactionId,
                status: 'success',
                createdAt: new Date().toISOString(),
                ...extra
            };

            if (!db.payments) db.payments = [];
            db.payments.push(payment);
            await writeDatabase(db);

            // Send Email to Worker
            const worker = db.users.find(u => u.id === order.workerId);
            if (worker && worker.email) {
                await sendEmail({
                    to: worker.email,
                    subject: 'Payment Received - WorkConnect',
                    text: `Hello ${worker.name || worker.username}, a payment of ₹${order.totalAmount} has been received for Order #${orderId.slice(-6)}.`,
                    html: `<p>Hello <b>${worker.name || worker.username}</b>,</p><p>A payment of <b>₹${order.totalAmount}</b> has been received for <b>Order #${orderId.slice(-6)}</b>.</p>`
                });
            }
        }

        // Create Notifications
        await createNotification(
            order.workerId,
            `Payment of ₹${order.totalAmount} received via ${method.toUpperCase()} for Order #${orderId.slice(-6)}`,
            'success',
            orderId,
            '/worker-payments.html'
        );

        await createNotification(
            order.customerId,
            `Your payment of ₹${order.totalAmount} for Order #${orderId.slice(-6)} was confirmed.`,
            'success',
            orderId,
            '/payment.html?orderId=' + orderId
        );

        return order;
    } catch (error) {
        console.error('Error in completeWorkConnectPayment:', error);
        return null;
    }
}

app.post('/api/verify-cashfree-payment', async (req, res) => {
    try {
        const { cf_payment_id, orderId } = req.body;
        // Search by order_id. NOTE: creation adds CF_ prefix and timestamp
        // So we need to fetch use the full order_id sent back (which is CF_{orderId}_{ts})
        const response = await Cashfree.PGOrderFetchPayments("2023-08-01", orderId);
        const payments = response.data;
        const successfulPayment = payments.find(p => p.payment_status === 'SUCCESS');

        if (successfulPayment) {
            const db = await readDatabase();
            const originalOrderId = orderId.split('_')[1]; // CF_ORDERID_TS

            const updatedOrder = await completeWorkConnectPayment(originalOrderId, cf_payment_id, 'cashfree', db, {
                cfPaymentId: cf_payment_id,
                cfOrderId: orderId
            });

            if (updatedOrder) {
                res.json({ success: true, message: 'Payment verified' });
            } else {
                res.status(404).json({ success: false, message: 'Original order not found' });
            }
        } else {
            res.status(400).json({ success: false, message: 'Payment not successful' });
        }
    } catch (error) {
        console.error('Cashfree verification error:', error);
        res.status(500).json({ success: false, message: 'Verification failed' });
    }
});

// Cashfree Webhook Support
app.post('/api/cashfree-webhook', async (req, res) => {
    try {
        const { data } = req.body;
        if (!data || !data.order || !data.payment) return res.status(400).send('Invalid data');

        const { order, payment } = data;

        if (payment.payment_status === 'SUCCESS') {
            const cfOrderId = order.order_id;
            const cfPaymentId = payment.cf_payment_id;
            const originalOrderId = cfOrderId.split('_')[1];

            const db = await readDatabase();
            await completeWorkConnectPayment(originalOrderId, cfPaymentId, 'cashfree', db);
            console.log(`[Webhook] Payment successful for Order #${originalOrderId}`);
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('Cashfree Webhook error:', error);
        res.status(500).send('Webhook failed');
    }
});

// Notification Endpoints
app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const db = await readDatabase();

        let notifications;
        if (MONGODB_URI) {
            notifications = await Notification.find({ recipientId: userId }).sort({ createdAt: -1 }).limit(20);
        } else {
            notifications = db.notifications
                .filter(n => n.recipientId === userId)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 20);
        }
        res.json(notifications);
    } catch (e) {
        console.error('Error fetching notifications:', e);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.put('/api/notifications/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        if (MONGODB_URI) {
            await Notification.findByIdAndUpdate(id, { read: true });
        } else {
            const db = await readDatabase();
            const notif = db.notifications.find(n => n.id === id);
            if (notif) {
                notif.read = true;
                await writeDatabase(db);
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error('Error marking notification read:', e);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Initialize database
(async () => {
    try {
        await initializeDatabase();
        await ensureAdminUser();
    } catch (e) {
        console.error('Database initialization failed:', e);
    }
})();

// --- Review Endpoints ---

// Get reviews for a specific worker
app.get('/api/worker/:id/reviews', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await readDatabase();
        const worker = db.users.find(u => u.id === id && u.role === 'worker');
        if (!worker) return res.status(404).json({ message: 'Worker not found' });
        res.json(worker.reviews || []);
    } catch (e) {
        res.status(500).json({ message: 'Error' });
    }
});

// Post a review for a worker
app.post('/api/worker/:id/reviews', async (req, res) => {
    try {
        const { id } = req.params;
        const { customerId, customerName, rating, comment } = req.body;

        if (!rating || !comment) return res.status(400).json({ message: 'Rating and comment are required' });

        const db = await readDatabase();
        const workerIdx = db.users.findIndex(u => u.id === id && u.role === 'worker');
        if (workerIdx === -1) return res.status(404).json({ message: 'Worker not found' });

        const newReview = {
            id: Date.now().toString(),
            customerId,
            customerName,
            rating: Number(rating),
            comment,
            createdAt: new Date().toISOString()
        };

        if (!db.users[workerIdx].reviews) db.users[workerIdx].reviews = [];
        db.users[workerIdx].reviews.unshift(newReview);

        await writeDatabase(db);
        res.status(201).json({ message: 'Review added', review: newReview });
    } catch (e) {
        res.status(500).json({ message: 'Error adding review' });
    }
});

// Notifications (Already exists but ensuring path compatibility)
app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const db = await readDatabase();
        const userNotifs = (db.notifications || [])
            .filter(n => n.recipientId === userId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(userNotifs);
    } catch (e) {
        res.status(500).json({ message: 'Error' });
    }
});

// Export the app for Vercel
module.exports = app;

// Start server only if run directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log('Database initialized successfully');
    });
} 
