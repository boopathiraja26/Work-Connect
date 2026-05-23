document.addEventListener('DOMContentLoaded', function () {
    setupLoginForm();
    setupForgotPasswordModal();
});

// Setup login form
function setupLoginForm() {
    const form = document.getElementById('loginForm');
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        handleLogin();
    });
}

// Setup forgot password modal
function setupForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    const link = document.getElementById('forgotPasswordLink');
    const closeBtn = document.querySelector('.close');
    const forgotForm = document.getElementById('forgotPasswordForm');
    const resetForm = document.getElementById('resetPasswordForm'); // Added for reset form
    const descText = document.getElementById('forgotPasswordDesc');

    // Open modal
    link.addEventListener('click', function (e) {
        e.preventDefault();
        modal.style.display = 'flex';
        // Reset forms when opening
        forgotForm.style.display = 'block';
        resetForm.style.display = 'none';
        descText.textContent = 'Enter your email address to receive an OTP';
        document.getElementById('resetEmail').value = '';
        document.getElementById('resetOtp').value = '';
        document.getElementById('newPassword').value = '';
        clearErrors();
    });

    // Close modal
    closeBtn.addEventListener('click', function () {
        modal.style.display = 'none';
    });

    // Handle forgot password form submission
    forgotForm.addEventListener('submit', function (e) {
        e.preventDefault();
        handleForgotPassword();
    });

    // Handle reset password form submission
    resetForm.addEventListener('submit', function (e) {
        e.preventDefault();
        handleResetPassword();
    });
}

// Handle login
async function handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    // Clear previous errors
    clearErrors();

    // Validate inputs
    if (!username) {
        showError('username-error', 'Username is required');
        return;
    }

    if (!password) {
        showError('password-error', 'Password is required');
        return;
    }

    try {
        const response = await fetch(getApiUrl('/api/login'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (response.ok) {
            // Check if worker is pending approval
            if (result.user.role === 'worker' && result.user.approved === false) {
                showMessage('Your account is pending admin approval. Please wait for approval before logging in.', 'error');
                return;
            }

            showMessage('Login successful!', 'success');
            // Store user info in localStorage
            localStorage.setItem('user', JSON.stringify(result.user));

            // Trigger login animation overlay
            const overlay = document.getElementById('loginAnimationOverlay');
            const subtext = document.getElementById('loaderSubtext');
            if (overlay) {
                overlay.style.display = 'flex';
                setTimeout(() => { if (subtext) subtext.textContent = 'Preparing your personalized dashboard...'; }, 1000);
                setTimeout(() => { if (subtext) subtext.textContent = 'Welcome back, ' + (result.user.name || result.user.username) + '!'; }, 2000);
            }

            setTimeout(() => {
                // Redirect based on user role
                if (result.user.role === 'admin') {
                    window.location.href = 'admin.html';
                } else if (result.user.role === 'worker') {
                    window.location.href = 'worker-profile.html';
                } else if (result.user.role === 'customer') {
                    window.location.href = 'customer-dashboard.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            }, 3500); // Increased delay for animation playback
        } else {
            showMessage(result.message || 'Login failed. Please check your credentials.', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('An error occurred. Please try again.', 'error');
    }
}

// Handle forgot password (Send OTP)
async function handleForgotPassword() {
    const email = document.getElementById('resetEmail').value.trim();

    // Clear previous errors
    clearErrors();

    // Validate email
    if (!email) {
        showError('resetEmail-error', 'Email is required');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('resetEmail-error', 'Please enter a valid email address');
        return;
    }

    const btn = document.getElementById('btnSendOtp');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
        const response = await fetch(getApiUrl('/api/forgot-password'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email })
        });

        const result = await response.json();

        if (response.ok) {
            showMessage(result.message || 'OTP sent to your email!', 'success');
            
            // Show reset password form
            document.getElementById('forgotPasswordForm').style.display = 'none';
            document.getElementById('resetPasswordForm').style.display = 'block';
            document.getElementById('forgotPasswordDesc').textContent = `OTP sent to ${email}. Please enter the OTP and your new password.`;
        } else {
            showError('resetEmail-error', result.message || 'Failed to send OTP. Please try again.');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('resetEmail-error', 'An error occurred. Please try again.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Send OTP';
    }
}

// Handle Reset Password (Verify OTP & Change Password)
async function handleResetPassword() {
    const email = document.getElementById('resetEmail').value.trim();
    const token = document.getElementById('resetOtp').value.trim();
    const newPassword = document.getElementById('newPassword').value;

    clearErrors();

    if (!token) {
        showError('resetOtp-error', 'OTP is required');
        return;
    }

    if (!newPassword || newPassword.length < 6) {
        showError('newPassword-error', 'Password must be at least 6 characters');
        return;
    }

    const btn = document.getElementById('btnResetPassword');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';

    try {
        const response = await fetch(getApiUrl('/api/reset-password'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, token, newPassword })
        });

        const result = await response.json();

        if (response.ok) {
            showMessage('Password reset successfully! You can now login.', 'success');
            setTimeout(() => {
                document.getElementById('forgotPasswordModal').style.display = 'none';
                
                // Reset standard login form password input
                document.getElementById('username').value = '';
                document.getElementById('password').value = '';
            }, 2500);
        } else {
            showError('resetOtp-error', result.message || 'Failed to reset password. Please check your OTP.');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('newPassword-error', 'An error occurred. Please try again.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Reset Password';
    }
}

// Show error message
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
    }
}

// Clear all error messages
function clearErrors() {
    const errors = document.querySelectorAll('.error');
    errors.forEach(error => {
        error.textContent = '';
    });
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