let currentStep = 1;
const totalSteps = 6;
let phoneVerified = false;

// Initialize the form
document.addEventListener('DOMContentLoaded', function () {
    updateProgress();
    setupPasswordStrength();
    setupFormValidation();
});

// Update progress bar
function updateProgress() {
    const progress = (currentStep / totalSteps) * 100;
    document.getElementById('progress').style.width = progress + '%';
}

// Show specific step
function showStep(step) {
    // Hide all steps, including dynamically created ones
    document.querySelectorAll('.form-step').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });

    // Show current step
    const target = document.getElementById(`step${step}`) ||
        (step === 7 ? document.getElementById('step7-email') : null) ||
        (step === 8 ? document.getElementById('step8-aadhaar') : null) ||
        (step === 3.5 ? document.getElementById('step3-phone-otp') : null);

    if (target) {
        target.classList.add('active');
        target.style.display = 'block';
    }
    currentStep = step;
    updateProgress();
}

// Next step function
function nextStep(step) {
    if (validateStep(step)) {
        if (step === 3 && !phoneVerified) {
            sendPhoneOTP();
            return;
        }
        if (step < totalSteps) {
            showStep(step + 1);
        }
    }
}

// Previous step function
function prevStep(step) {
    if (step === 3.5) {
        showStep(3);
        return;
    }
    if (step > 1) {
        showStep(Math.floor(step) - (step % 1 === 0 ? 1 : 0));
    }
}

// Validate each step
function validateStep(step) {
    clearErrors();

    switch (step) {
        case 1:
            return validateUsername();
        case 2:
            return validateEmail();
        case 3:
            return validatePhone();
        case 4:
            return validatePassword();
        case 5:
            return validateConfirmPassword();
        case 6:
            return validateRole();
        default:
            return true;
    }
}

// Clear all error messages
function clearErrors() {
    const errors = document.querySelectorAll('.error');
    errors.forEach(error => {
        error.textContent = '';
    });
}

// Username validation
function validateUsername() {
    const username = document.getElementById('username').value.trim();
    const errorElement = document.getElementById('username-error');

    if (!username) {
        errorElement.textContent = 'Username is required';
        return false;
    }

    if (username.length < 3) {
        errorElement.textContent = 'Username must be at least 3 characters long';
        return false;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        errorElement.textContent = 'Username can only contain letters, numbers, and underscores';
        return false;
    }

    return true;
}

// Email validation
function validateEmail() {
    const email = document.getElementById('email').value.trim();
    const errorElement = document.getElementById('email-error');

    if (!email) {
        errorElement.textContent = 'Email is required';
        return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errorElement.textContent = 'Please enter a valid email address';
        return false;
    }

    return true;
}

// Phone validation
function validatePhone() {
    const phone = document.getElementById('phone').value.trim();
    const errorElement = document.getElementById('phone-error');

    if (!phone) {
        errorElement.textContent = 'Phone number is required';
        return false;
    }

    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        errorElement.textContent = 'Please enter a valid phone number';
        return false;
    }

    return true;
}

// Password validation
function validatePassword() {
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('password-error');

    if (!password) {
        errorElement.textContent = 'Password is required';
        return false;
    }

    if (password.length < 8) {
        errorElement.textContent = 'Password must be at least 8 characters long';
        return false;
    }

    // Check password strength
    const strength = checkPasswordStrength(password);
    if (strength === 'weak') {
        errorElement.textContent = 'Password is too weak. Please use a stronger password';
        return false;
    }

    return true;
}

// Confirm password validation
function validateConfirmPassword() {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorElement = document.getElementById('confirmPassword-error');

    if (!confirmPassword) {
        errorElement.textContent = 'Please confirm your password';
        return false;
    }

    if (password !== confirmPassword) {
        errorElement.textContent = 'Passwords do not match';
        return false;
    }

    return true;
}

// Role validation
function validateRole() {
    const role = document.querySelector('input[name="role"]:checked');
    const errorElement = document.getElementById('role-error');

    if (!role) {
        errorElement.textContent = 'Please select a role';
        return false;
    }

    return true;
}

// Setup password strength checker
function setupPasswordStrength() {
    const passwordInput = document.getElementById('password');
    passwordInput.addEventListener('input', function () {
        const password = this.value;
        const strength = checkPasswordStrength(password);
        updatePasswordStrengthUI(strength);
    });
}

// Check password strength
function checkPasswordStrength(password) {
    let score = 0;

    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score < 2) return 'weak';
    if (score < 3) return 'fair';
    if (score < 4) return 'good';
    return 'strong';
}

// Update password strength UI
function updatePasswordStrengthUI(strength) {
    const strengthFill = document.getElementById('strength-fill');
    const strengthText = document.getElementById('strength-text');

    // Remove all classes
    strengthFill.className = 'strength-fill';

    // Add appropriate class and text
    switch (strength) {
        case 'weak':
            strengthFill.classList.add('weak');
            strengthText.textContent = 'Weak password';
            break;
        case 'fair':
            strengthFill.classList.add('fair');
            strengthText.textContent = 'Fair password';
            break;
        case 'good':
            strengthFill.classList.add('good');
            strengthText.textContent = 'Good password';
            break;
        case 'strong':
            strengthFill.classList.add('strong');
            strengthText.textContent = 'Strong password';
            break;
    }
}

// Setup form validation
function setupFormValidation() {
    const form = document.getElementById('registrationForm');
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Validate all steps
        for (let i = 1; i <= totalSteps; i++) {
            if (!validateStep(i)) {
                showStep(i);
                return;
            }
        }

        // If all validations pass, submit the form
        submitRegistration();
    });
}

// Show/hide worker/customer fields based on role
function onRoleChange() {
    const role = document.querySelector('input[name="role"]:checked');
    const workerFields = document.getElementById('workerFields');
    const customerFields = document.getElementById('customerFields');

    if (role && role.value === 'worker') {
        workerFields.style.display = '';
        customerFields.style.display = 'none';
    } else if (role && role.value === 'customer') {
        workerFields.style.display = 'none';
        customerFields.style.display = '';
    } else {
        workerFields.style.display = 'none';
        customerFields.style.display = 'none';
    }
}

// Intercept register button click
async function onRegisterClick() {
    clearErrors();
    // Validate all steps up to 6
    for (let i = 1; i <= totalSteps; i++) {
        if (!validateStep(i)) {
            showStep(i);
            return;
        }
    }
    const role = document.querySelector('input[name="role"]:checked').value;

    // For both workers and customers, send email OTP first
    await sendEmailOTP(role);
}

// Send Email OTP for both workers and customers
async function sendEmailOTP(role) {
    const email = document.getElementById('email').value.trim();

    try {
        const response = await fetch(getApiUrl('/api/send-email-otp'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                role: role
            })
        });

        const result = await response.json();
        if (response.ok) {
            // Show email OTP step
            showEmailOTPStep(result.emailOtp);
        } else {
            showMessage(result.message || 'Failed to send email OTP', 'error');
        }
    } catch (error) {
        showMessage('Error sending email OTP', 'error');
    }
}

// Show Email OTP verification step
function showEmailOTPStep(emailOtp) {
    if (!document.getElementById('step7-email')) createEmailOTPStep();
    showStep(7);

    if (emailOtp) showMessage(`Demo Mode: Email OTP is ${emailOtp}`, 'success');
    else showMessage('Verification code sent to your email address.', 'success');
}

// Create Email OTP step dynamically
function createEmailOTPStep() {
    const step7Email = document.createElement('div');
    step7Email.id = 'step7-email';
    step7Email.className = 'form-step';
    step7Email.style.display = 'none';
    step7Email.innerHTML = `
        <h2>Step 7: Email Verification</h2>
        <div class="form-group">
            <label for="emailOtp">Enter OTP sent to your email</label>
            <input type="text" id="emailOtp" maxlength="6" placeholder="Enter 6-digit OTP">
            <span class="error" id="emailOtp-error"></span>
        </div>
        <div class="button-group">
            <button type="button" class="btn btn-secondary" onclick="prevStep(7)">Previous</button>
            <button type="button" class="btn btn-primary" onclick="verifyEmailOTP()">Verify Email</button>
        </div>
    `;

    // Insert after step 6
    const step6 = document.getElementById('step6');
    step6.parentNode.insertBefore(step7Email, step6.nextSibling);
}

// Verify Email OTP
async function verifyEmailOTP() {
    clearErrors();
    const emailOtp = document.getElementById('emailOtp').value.trim();
    if (!emailOtp || emailOtp.length !== 6) {
        document.getElementById('emailOtp-error').textContent = 'Enter the 6-digit OTP';
        return;
    }

    const role = document.querySelector('input[name="role"]:checked').value;

    try {
        const response = await fetch(getApiUrl('/api/verify-email-otp'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: document.getElementById('email').value.trim(),
                emailOtp: emailOtp,
                role: role
            })
        });

        const result = await response.json();
        if (response.ok) {
            if (role === 'worker') {
                // For workers, now send Aadhaar OTP to mobile
                await sendAadhaarOTP();
            } else {
                // For customers, proceed with final registration
                await finalizeCustomerRegistration();
            }
        } else {
            showMessage(result.message || 'Invalid email OTP', 'error');
        }
    } catch (error) {
        showMessage('Error verifying email OTP', 'error');
    }
}

let digilockerVerified = false;

function startDigiLockerFlow() {
    // NOTE: This is a demo stub. In production, redirect to your backend endpoint
    // which starts the official DigiLocker OAuth2 flow.
    // Example real flow:
    // window.location.href = '/api/digilocker/auth';

    digilockerVerified = true;
    document.getElementById('aadhaar-error').textContent = '';
    showMessage('DigiLocker verification marked as completed (demo mode). Integrate real DigiLocker OAuth on the server for production.', 'success');
}

// Send Aadhaar OTP to mobile for workers (fallback when DigiLocker is not used)
async function sendAadhaarOTP() {
    if (digilockerVerified) {
        // If DigiLocker is already completed, skip Aadhaar OTP flow.
        await verifyAadhaarOTPAndRegister(true);
        return;
    }
    const aadhaar = document.getElementById('aadhaarNumber').value.trim();
    const phone = document.getElementById('phone').value.trim();

    if (!aadhaar || !/^\d{12}$/.test(aadhaar)) {
        document.getElementById('aadhaar-error').textContent = 'Valid 12-digit Aadhaar number required';
        return;
    }

    try {
        const response = await fetch(getApiUrl('/api/send-aadhaar-otp'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                aadhaarNumber: aadhaar,
                phone: phone
            })
        });

        const result = await response.json();
        if (response.ok) {
            // Show Aadhaar OTP step
            showAadhaarOTPStep(result.aadhaarOtp);
        } else {
            showMessage(result.message || 'Failed to send Aadhaar OTP', 'error');
        }
    } catch (error) {
        showMessage('Error sending Aadhaar OTP', 'error');
    }
}

// Show Aadhaar OTP verification step
function showAadhaarOTPStep(aadhaarOtp) {
    if (!document.getElementById('step8-aadhaar')) createAadhaarOTPStep();
    showStep(8);

    // Show simulated SMS notification if OTP is returned (Demo Mode)
    if (aadhaarOtp) {
        showMessage(`📱 SMS Simulation: Your verification code is ${aadhaarOtp}`, 'success');
        // Also log to console for developers
        console.log(`%c[SMS] OTP sent to ${document.getElementById('phone').value}: ${aadhaarOtp}`, 'color: green; font-weight: bold; font-size: 14px;');
    } else {
        showMessage('Verification code sent to your Aadhaar-linked mobile.', 'success');
    }
}

// Create Aadhaar OTP step dynamically
function createAadhaarOTPStep() {
    const step8Aadhaar = document.createElement('div');
    step8Aadhaar.id = 'step8-aadhaar';
    step8Aadhaar.className = 'form-step';
    step8Aadhaar.style.display = 'none';
    step8Aadhaar.innerHTML = `
        <h2>Step 8: Aadhaar Verification</h2>
        <div class="form-group">
            <label for="aadhaarOtp">Enter OTP sent to your Aadhaar-linked mobile</label>
            <input type="text" id="aadhaarOtp" maxlength="6" placeholder="Enter 6-digit OTP">
            <span class="error" id="aadhaarOtp-error"></span>
        </div>
        <div class="button-group">
            <button type="button" class="btn btn-secondary" onclick="prevStep(8)">Previous</button>
            <button type="button" class="btn btn-success" onclick="verifyAadhaarOTPAndRegister()">Verify & Register</button>
        </div>
    `;

    // Insert after email OTP step
    const step7Email = document.getElementById('step7-email');
    step7Email.parentNode.insertBefore(step8Aadhaar, step7Email.nextSibling);
}

// Verify Aadhaar OTP and complete worker registration
// If isFromDigiLocker is true, Aadhaar OTP and number are not required/stored.
async function verifyAadhaarOTPAndRegister(isFromDigiLocker = false) {
    clearErrors();
    let aadhaarOtp = null;
    if (!isFromDigiLocker) {
        aadhaarOtp = document.getElementById('aadhaarOtp').value.trim();
        if (!aadhaarOtp || aadhaarOtp.length !== 6) {
            document.getElementById('aadhaarOtp-error').textContent = 'Enter the 6-digit OTP';
            return;
        }
    }

    // Prepare FormData for final worker registration
    const formData = new FormData();
    formData.append('username', document.getElementById('username').value.trim());
    formData.append('email', document.getElementById('email').value.trim());
    formData.append('phone', document.getElementById('phone').value.trim());
    formData.append('password', document.getElementById('password').value);
    formData.append('role', 'worker');
    if (!isFromDigiLocker) {
        formData.append('aadhaarNumber', document.getElementById('aadhaarNumber').value.trim());
        formData.append('aadhaarOtp', aadhaarOtp);
    } else {
        formData.append('digilockerVerified', 'true');
    }

    // Add address/location as JSON
    const address = {
        street: document.getElementById('street').value,
        city: document.getElementById('city').value,
        state: document.getElementById('state').value,
        pincode: document.getElementById('pincode').value
    };
    formData.append('address', JSON.stringify(address));

    // Handle location link and extract coordinates if possible
    const locationLink = document.getElementById('locationLink').value;
    let locationData = { link: locationLink };
    if (locationLink) {
        const googleMapsRegex = /[?&]q=([^&]+)/;
        const match = locationLink.match(googleMapsRegex);
        if (match) {
            const coords = match[1].split(',');
            if (coords.length === 2) {
                const lat = parseFloat(coords[0]);
                const lng = parseFloat(coords[1]);
                if (!isNaN(lat) && !isNaN(lng)) {
                    locationData.latitude = lat;
                    locationData.longitude = lng;
                }
            }
        }
    }
    formData.append('location', JSON.stringify(locationData));

    // Add image if selected
    const imgInput = document.getElementById('profileImage');
    if (imgInput.files.length > 0) {
        formData.append('profileImage', imgInput.files[0]);
    }

    try {
        const response = await fetch(getApiUrl('/api/register'), {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (response.ok) {
            showMessage('✅ Registration successful! Your account is pending admin approval. You will be able to login once approved.', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 4000);
        } else {
            showMessage(result.message || 'Registration failed. Please try again.', 'error');
        }
    } catch (error) {
        showMessage('Error during registration', 'error');
    }
}

// Finalize customer registration after email OTP verification
async function finalizeCustomerRegistration() {
    // Prepare FormData for customer registration
    const formData = new FormData();
    formData.append('username', document.getElementById('username').value.trim());
    formData.append('email', document.getElementById('email').value.trim());
    formData.append('phone', document.getElementById('phone').value.trim());
    formData.append('password', document.getElementById('password').value);
    formData.append('role', 'customer');

    // Add customer address/location as JSON
    const address = {
        street: document.getElementById('customerStreet').value,
        city: document.getElementById('customerCity').value,
        state: document.getElementById('customerState').value,
        pincode: document.getElementById('customerPincode').value
    };
    formData.append('address', JSON.stringify(address));

    // Handle customer location link and extract coordinates if possible
    const locationLink = document.getElementById('customerLocationLink').value;
    let locationData = { link: locationLink };
    if (locationLink) {
        const googleMapsRegex = /[?&]q=([^&]+)/;
        const match = locationLink.match(googleMapsRegex);
        if (match) {
            const coords = match[1].split(',');
            if (coords.length === 2) {
                const lat = parseFloat(coords[0]);
                const lng = parseFloat(coords[1]);
                if (!isNaN(lat) && !isNaN(lng)) {
                    locationData.latitude = lat;
                    locationData.longitude = lng;
                }
            }
        }
    }
    formData.append('location', JSON.stringify(locationData));

    // Add customer image if selected
    const imgInput = document.getElementById('customerProfileImage');
    if (imgInput.files.length > 0) {
        formData.append('profileImage', imgInput.files[0]);
    }

    try {
        const response = await fetch(getApiUrl('/api/register'), {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (response.ok) {
            showMessage('Registration successful! Please login.', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showMessage(result.message || 'Registration failed. Please try again.', 'error');
        }
    } catch (error) {
        showMessage('An error occurred. Please try again.', 'error');
    }
}

// Patch: override submitRegistration to handle customer only
async function submitRegistration() {
    const role = document.querySelector('input[name="role"]:checked').value;
    if (role === 'worker') return; // handled by onRegisterClick/verifyOtpAndRegister

    // Prepare FormData for customer registration with location
    const formData = new FormData();
    formData.append('username', document.getElementById('username').value.trim());
    formData.append('email', document.getElementById('email').value.trim());
    formData.append('phone', document.getElementById('phone').value.trim());
    formData.append('password', document.getElementById('password').value);
    formData.append('role', 'customer');

    // Add customer address/location as JSON
    const address = {
        street: document.getElementById('customerStreet').value,
        city: document.getElementById('customerCity').value,
        state: document.getElementById('customerState').value,
        pincode: document.getElementById('customerPincode').value
    };
    formData.append('address', JSON.stringify(address));

    // Handle customer location link and extract coordinates if possible
    const locationLink = document.getElementById('customerLocationLink').value;
    let locationData = { link: locationLink };
    if (locationLink) {
        const googleMapsRegex = /[?&]q=([^&]+)/;
        const match = locationLink.match(googleMapsRegex);
        if (match) {
            const coords = match[1].split(',');
            if (coords.length === 2) {
                const lat = parseFloat(coords[0]);
                const lng = parseFloat(coords[1]);
                if (!isNaN(lat) && !isNaN(lng)) {
                    locationData.latitude = lat;
                    locationData.longitude = lng;
                }
            }
        }
    }
    formData.append('location', JSON.stringify(locationData));

    // Add customer image if selected
    const imgInput = document.getElementById('customerProfileImage');
    if (imgInput.files.length > 0) {
        formData.append('profileImage', imgInput.files[0]);
    }

    try {
        const response = await fetch(getApiUrl('/api/register'), {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (response.ok) {
            showMessage('Registration successful! Please login.', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showMessage(result.message || 'Registration failed. Please try again.', 'error');
        }
    } catch (error) {
        showMessage('An error occurred. Please try again.', 'error');
    }
}

// --- Phone OTP Flow ---
async function sendPhoneOTP() {
    const phone = document.getElementById('phone').value.trim();
    try {
        const response = await fetch(getApiUrl('/api/send-phone-otp'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        const result = await response.json();
        if (response.ok) {
            showPhoneOTPStep(result.phoneOtp);
        } else {
            showMessage(result.message || 'Failed to send OTP', 'error');
        }
    } catch (error) {
        showMessage('Error sending phone OTP', 'error');
    }
}

function showPhoneOTPStep(otp) {
    if (!document.getElementById('step3-phone-otp')) createPhoneOTPStep();
    showStep(3.5);
    if (otp) {
        showMessage(`📱 SMS Simulation: Your verification code is ${otp}`, 'success');
        console.log(`%c[SMS] Phone OTP: ${otp}`, 'color: blue; font-weight: bold;');
    } else {
        showMessage('Verification code sent to your phone.', 'success');
    }
}

function createPhoneOTPStep() {
    const step = document.createElement('div');
    step.id = 'step3-phone-otp';
    step.className = 'form-step';
    step.style.display = 'none';
    step.innerHTML = `
        <h2>Phone Verification</h2>
        <div class="form-group">
            <label for="phoneOtp">Enter 6-digit OTP</label>
            <input type="text" id="phoneOtp" maxlength="6" placeholder="Enter OTP">
            <span class="error" id="phoneOtp-error"></span>
        </div>
        <div class="button-group">
            <button type="button" class="btn btn-secondary" onclick="prevStep(3.5)">Back</button>
            <button type="button" class="btn btn-primary" onclick="verifyPhoneOTP()">Verify & Continue</button>
        </div>
    `;
    const step3 = document.getElementById('step3');
    step3.parentNode.insertBefore(step, step3.nextSibling);
}

async function verifyPhoneOTP() {
    const phone = document.getElementById('phone').value.trim();
    const otp = document.getElementById('phoneOtp').value.trim();
    if (!otp || otp.length !== 6) {
        document.getElementById('phoneOtp-error').textContent = 'Enter 6-digit OTP';
        return;
    }
    try {
        const response = await fetch(getApiUrl('/api/verify-phone-otp'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, otp })
        });
        if (response.ok) {
            phoneVerified = true;
            showMessage('Phone verified successfully!', 'success');
            showStep(4);
        } else {
            const result = await response.json();
            showMessage(result.message || 'Invalid OTP', 'error');
        }
    } catch (error) {
        showMessage('Error verifying phone OTP', 'error');
    }
}

// Show message
function showMessage(message, type) {
    // Remove existing messages
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;

    // Insert at the top of the form
    const formCard = document.querySelector('.form-card');
    formCard.insertBefore(messageDiv, formCard.firstChild);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
} 