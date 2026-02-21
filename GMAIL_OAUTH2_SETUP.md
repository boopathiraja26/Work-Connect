# Gmail OAuth2 Setup Guide for WorkConnect

## 📧 Why OAuth2?

OAuth2 is more secure than App Passwords and doesn't require 2-Step Verification. It allows WorkConnect to send emails on your behalf without storing your password.

---

## 🚀 Step-by-Step Setup

### Step 1: Create Google Cloud Project (5 minutes)

1. **Open Google Cloud Console**: https://console.cloud.google.com/
2. **Click** the project dropdown (top left, next to "Google Cloud")
3. **Click** "New Project"
4. **Enter**:
   - Project name: `WorkConnect`
   - Leave organization as default
5. **Click** "Create"
6. **Wait** for the project to be created (notification will appear)
7. **Select** your new "WorkConnect" project from the dropdown

---

### Step 2: Enable Gmail API (2 minutes)

1. **In your WorkConnect project**, click the hamburger menu (☰)
2. **Navigate to**: APIs & Services → Library
   - Or visit: https://console.cloud.google.com/apis/library
3. **Search for**: "Gmail API"
4. **Click** on "Gmail API" in the results
5. **Click** the blue "Enable" button
6. **Wait** for it to enable (takes a few seconds)

---

### Step 3: Configure OAuth Consent Screen (3 minutes)

1. **Go to**: APIs & Services → OAuth consent screen
   - Or visit: https://console.cloud.google.com/apis/credentials/consent
2. **Select** User Type: **External**
3. **Click** "Create"
4. **Fill in** the required fields:
   - App name: `WorkConnect`
   - User support email: `s.udhayakumar144@gmail.com`
   - App logo: (optional, skip for now)
   - App domain: (leave blank)
   - Authorized domains: (leave blank)
   - Developer contact: `s.udhayakumar144@gmail.com`
5. **Click** "Save and Continue"
6. **Scopes page**: Click "Add or Remove Scopes"
   - Search for: `https://mail.google.com/`
   - **Check** the box next to it
   - **Click** "Update"
   - **Click** "Save and Continue"
7. **Test users page**: Click "Add Users"
   - Enter: `s.udhayakumar144@gmail.com`
   - **Click** "Add"
   - **Click** "Save and Continue"
8. **Summary page**: Click "Back to Dashboard"

---

### Step 4: Create OAuth2 Credentials (3 minutes)

1. **Go to**: APIs & Services → Credentials
   - Or visit: https://console.cloud.google.com/apis/credentials
2. **Click** "Create Credentials" → "OAuth client ID"
3. **Select** Application type: **Web application**
4. **Enter**:
   - Name: `WorkConnect Email Service`
   - Authorized JavaScript origins: (leave blank)
   - Authorized redirect URIs: 
     - Click "Add URI"
     - Enter: `https://developers.google.com/oauthplayground`
5. **Click** "Create"
6. **A popup appears** with your credentials:
   - **Copy** the "Client ID" (looks like: `xxxxx.apps.googleusercontent.com`)
   - **Copy** the "Client Secret" (looks like: `GOCSPX-xxxxx`)
   - **Click** "OK"

---

### Step 5: Generate Refresh Token (5 minutes)

1. **Open**: https://developers.google.com/oauthplayground
2. **Click** the gear icon (⚙️) in the top-right corner
3. **Check** the box: "Use your own OAuth credentials"
4. **Enter**:
   - OAuth Client ID: (paste from Step 4)
   - OAuth Client Secret: (paste from Step 4)
5. **Click** "Close"
6. **In the left panel** (Step 1):
   - Scroll down to find "Gmail API v1"
   - **Expand** it
   - **Check** the box next to: `https://mail.google.com/`
7. **Click** the blue "Authorize APIs" button
8. **Sign in** with your Google account (`s.udhayakumar144@gmail.com`)
9. **Click** "Continue" when warned about unverified app
10. **Click** "Allow" to grant permissions
11. **You'll be redirected back** to OAuth Playground
12. **Click** "Exchange authorization code for tokens" (Step 2)
13. **Copy** the `refresh_token` value (looks like: `1//xxxxx`)

---

## ✅ Final Step: Provide Credentials

Once you have all three values, share them here:

```
CLIENT_ID=your-client-id.apps.googleusercontent.com
CLIENT_SECRET=GOCSPX-your-client-secret
REFRESH_TOKEN=1//your-refresh-token
```

---

## 🔐 Security Notes

- ✅ OAuth2 is more secure than passwords
- ✅ You can revoke access anytime from Google Account settings
- ✅ The refresh token never expires (unless revoked)
- ✅ Your password is never stored or transmitted

---

## ❓ Troubleshooting

### "Access blocked: This app's request is invalid"
- Make sure you added your email as a test user in Step 3
- Verify the redirect URI is exactly: `https://developers.google.com/oauthplayground`

### "Error 400: redirect_uri_mismatch"
- Double-check the redirect URI in OAuth credentials matches the playground URL

### "Invalid grant"
- The refresh token may have expired or been revoked
- Generate a new refresh token from Step 5

---

## 📞 Need Help?

If you get stuck at any step, let me know which step number and what error you're seeing!
