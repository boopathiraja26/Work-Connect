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

    // Open modal
    link.addEventListener('click', function (e) {
        e.preventDefault();
        modal.style.display = 'block';
    });

    // Close modal
    closeBtn.addEventListener('click', function () {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', function (e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Handle forgot password form submission
    forgotForm.addEventListener('submit', function (e) {
        e.preventDefault();
        handleForgotPassword();
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

// Handle forgot password
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
            showMessage('Password reset link sent to your email!', 'success');
            // Close modal after successful request
            setTimeout(() => {
                document.getElementById('forgotPasswordModal').style.display = 'none';
            }, 2000);
        } else {
            showError('resetEmail-error', result.message || 'Failed to send reset link. Please try again.');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('resetEmail-error', 'An error occurred. Please try again.');
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