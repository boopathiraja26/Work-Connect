# 🚀 WorkConnect Deployment Guide (Vercel + MongoDB Atlas)

This guide summarizes the final steps to deploy the **WorkConnect** platform to production using Vercel.

## 🔑 1. Environment Variables (Vercel Dashboard)

Navigate to **Project Settings > Environment Variables** and add the following:

| Variable | Recommended Value / Source |
| :--- | :--- |
| `MONGODB_URI` | Your MongoDB Atlas Connection String (**Essential for data persistence**) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary Console Dashboard |
| `CLOUDINARY_API_KEY` | Cloudinary Console Dashboard |
| `CLOUDINARY_API_SECRET` | Cloudinary Console Dashboard |
| `RAZORPAY_KEY_ID` | Razorpay Dashboard (Test/Live) |
| `RAZORPAY_KEY_SECRET` | Razorpay Dashboard (Test/Live) |
| `SMTP_HOST` | e.g., `smtp.gmail.com` |
| `SMTP_PORT` | `465` (SSL) or `587` (TLS) |
| `SMTP_USER` | Your business/system email |
| `SMTP_PASS` | **App Password** (not your regular login password) |
| `VERCEL` | `1` (Automatically set by Vercel) |

---

## 🛠️ 2. Database Setup (MongoDB Atlas)

1. **IP Whitelisting**: Go to **Network Access** in MongoDB Atlas and add `0.0.0.0/0`. Vercel's serverless functions rotate IPs, so this is required for the connection to remain stable.
2. **Database User**: Ensure your user has `readWriteAnyDatabase` or equivalent permissions.

---

## 🏗️ 3. Deployment Steps

1. **GitHub Push**:
   ```bash
   git add .
   git commit -m "Final production hardening and admin polish"
   git push origin main
   ```
2. **Vercel Import**:
   - Link your GitHub repository.
   - Vercel will auto-detect the `vercel.json` configuration.
   - It will use the `server.js` as the entry point for API and static routing.

---

## ✅ 4. Pre-Flight Checklist

- [ ] **Admin Account**: On first boot, the platform will create an admin account (`admin` / `admin123`). Log in immediately and change these credentials.
- [ ] **Email Testing**: Verify that worker approval notifications arrive in the inbox.
- [ ] **Payment Mode**: Ensure Razorpay is in "Test Mode" for initial verification and switched to "Live Mode" only after testing.
- [ ] **Image Storage**: Upload a profile picture to verify the Cloudinary handshake.

---

## 📦 5. Tech Stack Summary
- **Backend**: Node.js (Express)
- **Database**: MongoDB Atlas (Primary) / JSON (Local Fallback)
- **Frontend**: Vanilla JS + HTML5 + CSS3 (Glassmorphism & Oceanic Theme)
- **Integrations**: Cloudinary (Media), Razorpay (Payments), Nodemailer (Notifications).

---
*Created by Antigravity for WorkConnect Production Launch.*
