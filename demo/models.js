const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    phone: String,
    password: { type: String, required: true },
    role: { type: String, enum: ['customer', 'worker', 'admin'], required: true },
    name: String,
    profileImage: String,
    address: {
        street: String,
        city: String,
        state: String,
        pincode: String
    },
    location: {
        link: String,
        latitude: Number,
        longitude: Number
    },
    // Worker specific
    skills: [String],
    experience: String,
    hourlyRate: Number,
    description: String,
    availability: { type: String, default: 'Available' },
    upiId: String,
    cashfreeVendorId: String, // Added for Cashfree Connect (Split Payments)
    aadhaarNumber: String,
    aadhaarVerified: Boolean,
    digilockerVerified: Boolean,
    approved: { type: String, default: 'pending' },
    portfolio: [String],
    reviews: [{
        customerId: String,
        customerName: String,
        rating: Number,
        comment: String,
        orderId: String,
        createdAt: { type: Date, default: Date.now },
        updatedAt: Date
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date
});

const orderSchema = new mongoose.Schema({
    customerId: { type: String, required: true },
    workerId: { type: String, required: true },
    serviceType: String,
    description: String,
    duration: String,
    totalAmount: Number,
    scheduledDate: Date, // New field for scheduled bookings
    status: { type: String, default: 'pending' },
    paymentStatus: { type: String, default: 'unpaid' },
    paymentMethod: String,
    transactionId: String,
    paidAt: Date,
    reviewed: { type: Boolean, default: false },
    review: {
        rating: Number,
        comment: String,
        customerId: String,
        customerName: String,
        createdAt: Date,
        updatedAt: Date
    },
    workerLiveLocation: {
        latitude: Number,
        longitude: Number,
        timestamp: Date
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date
});

const paymentSchema = new mongoose.Schema({
    transactionId: String,
    orderId: String,
    customerId: String,
    workerId: String,
    amount: Number,
    method: String,
    status: String,
    screenshot: String,
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    createdAt: { type: Date, default: Date.now }
});

const supportTicketSchema = new mongoose.Schema({
    userId: String,
    username: String,
    role: String,
    subject: String,
    message: String,
    status: { type: String, default: 'open' },
    adminReply: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date
});

const passwordResetTokenSchema = new mongoose.Schema({
    email: String,
    token: String,
    expiry: Date,
    used: { type: Boolean, default: false }
});

const notificationSchema = new mongoose.Schema({
    recipientId: { type: String, required: true },
    type: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    relatedId: String, // e.g., orderId
    link: String,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
const Notification = mongoose.model('Notification', notificationSchema);

module.exports = { User, Order, Payment, SupportTicket, PasswordResetToken, Notification };
