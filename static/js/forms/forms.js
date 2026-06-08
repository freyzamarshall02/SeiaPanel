/* ========================================
   FORMS.JS - Form Handling & AJAX Submissions
   ======================================== */

// ========== LOGIN FORM ==========

/**
 * Initialize login form with AJAX submission
 */
function initLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const alertContainer = document.getElementById('alertContainer');

    if (!loginForm || !loginBtn) return;

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Disable button and show loading state
        loginBtn.disabled = true;
        const originalText = loginBtn.textContent;
        loginBtn.textContent = 'LOADING...';

        // Get form data
        const formData = new FormData(loginForm);

        try {
            // Send AJAX request
            const response = await fetch('/login', {
                method: 'POST',
                body: new URLSearchParams(formData)
            });

            const data = await response.json();

            if (data.success) {
                // Show success message
                showAlert(data.message, 'success', 'alertContainer');
                
                // Redirect after short delay
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 500);
            } else {
                // Show error message
                showAlert(data.error, 'error', 'alertContainer');
                
                // Re-enable button
                loginBtn.disabled = false;
                loginBtn.textContent = originalText;
            }
        } catch (error) {
            // Show error message
            showAlert('An error occurred. Please try again.', 'error', 'alertContainer');
            
            // Re-enable button
            loginBtn.disabled = false;
            loginBtn.textContent = originalText;
            
            console.error('Login error:', error);
        }
    });
}

// ========== REGISTER FORM ==========

/**
 * Initialize register form with AJAX submission and validation
 */
function initRegisterForm() {
    const registerForm = document.getElementById('registerForm');
    const registerBtn = document.getElementById('registerBtn');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm_password');

    if (!registerForm || !registerBtn) return;

    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Client-side validation
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (password !== confirmPassword) {
            showAlert('Passwords do not match!', 'error', 'alertContainer');
            confirmPasswordInput.focus();
            return;
        }

        if (password.length < 8) {
            showAlert('Password must be at least 8 characters long!', 'error', 'alertContainer');
            passwordInput.focus();
            return;
        }

        // Disable button and show loading state
        registerBtn.disabled = true;
        const originalText = registerBtn.textContent;
        registerBtn.textContent = 'CREATING...';

        // Get form data
        const formData = new FormData(registerForm);

        try {
            // Send AJAX request
            const response = await fetch('/register', {
                method: 'POST',
                body: new URLSearchParams(formData)
            });

            const data = await response.json();

            if (data.success) {
                // Show success message
                showAlert(data.message, 'success', 'alertContainer');
                
                // Redirect to login after short delay
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 1500);
            } else {
                // Show error message
                showAlert(data.error, 'error', 'alertContainer');
                
                // Re-enable button
                registerBtn.disabled = false;
                registerBtn.textContent = originalText;
            }
        } catch (error) {
            // Show error message
            showAlert('An error occurred. Please try again.', 'error', 'alertContainer');
            
            // Re-enable button
            registerBtn.disabled = false;
            registerBtn.textContent = originalText;
            
            console.error('Registration error:', error);
        }
    });
}

// ========== ACCOUNT FORMS ==========

/**
 * Initialize username update form
 */
function initUsernameForm() {
    const usernameForm = document.getElementById('usernameForm');
    const usernameBtn = document.getElementById('usernameBtn');
    const usernameInput = document.getElementById('username');
    const sidebarUsername = document.getElementById('sidebarUsername');

    if (!usernameForm || !usernameBtn) return;

    usernameForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Disable button and show loading state
        usernameBtn.disabled = true;
        const originalText = usernameBtn.textContent;
        usernameBtn.textContent = 'Updating...';

        // Get form data
        const formData = new FormData(usernameForm);

        try {
            // Send AJAX request
            const response = await fetch('/account/update-username', {
                method: 'POST',
                body: new URLSearchParams(formData)
            });

            const data = await response.json();

            if (data.success) {
                // Show success message
                showAlert(data.message, 'success', 'usernameAlertContainer');
                
                // Update sidebar username
                if (sidebarUsername && data.username) {
                    sidebarUsername.textContent = data.username;
                }
            } else {
                // Show error message
                showAlert(data.error, 'error', 'usernameAlertContainer');
            }
        } catch (error) {
            // Show error message
            showAlert('An error occurred. Please try again.', 'error', 'usernameAlertContainer');
            console.error('Username update error:', error);
        } finally {
            // Re-enable button
            usernameBtn.disabled = false;
            usernameBtn.textContent = originalText;
        }
    });
}

/**
 * Initialize password update form
 */
function initPasswordForm() {
    const passwordForm = document.getElementById('passwordForm');
    const passwordBtn = document.getElementById('passwordBtn');
    const newPasswordInput = document.getElementById('new_password');
    const confirmPasswordInput = document.getElementById('confirm_password');

    if (!passwordForm || !passwordBtn) return;

    passwordForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Client-side validation
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (newPassword !== confirmPassword) {
            showAlert('New passwords do not match!', 'error', 'passwordAlertContainer');
            confirmPasswordInput.focus();
            return;
        }

        if (newPassword.length < 8) {
            showAlert('New password must be at least 8 characters long!', 'error', 'passwordAlertContainer');
            newPasswordInput.focus();
            return;
        }

        // Disable button and show loading state
        passwordBtn.disabled = true;
        const originalText = passwordBtn.textContent;
        passwordBtn.textContent = 'Updating...';

        // Get form data
        const formData = new FormData(passwordForm);

        try {
            // Send AJAX request
            const response = await fetch('/account/update-password', {
                method: 'POST',
                body: new URLSearchParams(formData)
            });

            const data = await response.json();

            if (data.success) {
                // Show success message
                showAlert(data.message, 'success', 'passwordAlertContainer');
                
                // Clear form
                passwordForm.reset();
            } else {
                // Show error message
                showAlert(data.error, 'error', 'passwordAlertContainer');
            }
        } catch (error) {
            // Show error message
            showAlert('An error occurred. Please try again.', 'error', 'passwordAlertContainer');
            console.error('Password update error:', error);
        } finally {
            // Re-enable button
            passwordBtn.disabled = false;
            passwordBtn.textContent = originalText;
        }
    });
}

// ========== SETTINGS FORM ==========

/**
 * Initialize settings form (server path)
 */
function initSettingsForm() {
    const settingsForm = document.getElementById('settingsForm');
    const settingsBtn = document.getElementById('settingsBtn');
    const pathInput = document.getElementById('path');
    const currentPathDisplay = document.getElementById('currentPathDisplay');

    if (!settingsForm || !settingsBtn) return;

    // Path validation helper
    if (pathInput) {
        pathInput.addEventListener('blur', function() {
            const path = this.value.trim();
            if (path && !path.startsWith('/')) {
                // Relative paths might be intentional, but warn user
                if (!confirm('This appears to be a relative path. Are you sure this is correct?')) {
                    this.focus();
                }
            }
        });
    }

    settingsForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Disable button and show loading state
        settingsBtn.disabled = true;
        const originalText = settingsBtn.textContent;
        settingsBtn.textContent = 'Updating...';

        // Get form data
        const formData = new FormData(settingsForm);

        try {
            // Send AJAX request
            const response = await fetch('/settings/update-path', {
                method: 'POST',
                body: new URLSearchParams(formData)
            });

            const data = await response.json();

            if (data.success) {
                // Show success message
                showAlert(data.message, 'success', 'settingsAlertContainer');
                
                // Update current path display if it exists
                if (currentPathDisplay && data.path) {
                    currentPathDisplay.textContent = data.path;
                }
                
                // Optionally refresh dashboard to show new servers
                setTimeout(() => {
                    showAlert('Please visit the dashboard to see scanned servers.', 'success', 'settingsAlertContainer');
                }, 2000);
            } else {
                // Show error message
                showAlert(data.error, 'error', 'settingsAlertContainer');
            }
        } catch (error) {
            // Show error message
            showAlert('An error occurred. Please try again.', 'error', 'settingsAlertContainer');
            console.error('Settings update error:', error);
        } finally {
            // Re-enable button
            settingsBtn.disabled = false;
            settingsBtn.textContent = originalText;
        }
    });
}

// ========== STARTUP FORM ==========

/**
 * Initialize startup command form
 * @param {string} serverName - Server name for the update endpoint
 */
function initStartupForm(serverName) {
    const startupForm = document.getElementById('startupForm');
    const startupBtn = document.getElementById('startupBtn');
    const commandTextarea = document.getElementById('command');

    if (!startupForm || !startupBtn) return;

    // Textarea auto-resize
    if (commandTextarea) {
        commandTextarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
        // Trigger on load
        commandTextarea.dispatchEvent(new Event('input'));
    }

    startupForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Disable button and show loading state
        startupBtn.disabled = true;
        const originalText = startupBtn.textContent;
        startupBtn.textContent = 'Updating...';

        // Get form data
        const formData = new FormData(startupForm);

        try {
            // Send AJAX request
            const response = await fetch(`/server/${serverName}/startup/update`, {
                method: 'POST',
                body: new URLSearchParams(formData)
            });

            const data = await response.json();

            if (data.success) {
                // Show success message
                showAlert(data.message, 'success', 'startupAlertContainer');
            } else {
                // Show error message
                showAlert(data.error, 'error', 'startupAlertContainer');
            }
        } catch (error) {
            // Show error message
            showAlert('An error occurred. Please try again.', 'error', 'startupAlertContainer');
            console.error('Startup update error:', error);
        } finally {
            // Re-enable button
            startupBtn.disabled = false;
            startupBtn.textContent = originalText;
        }
    });
}

// ========== EXPORTS (if using modules) ==========
// Uncomment if using ES6 modules
/*
export {
    initLoginForm,
    initRegisterForm,
    initUsernameForm,
    initPasswordForm,
    initSettingsForm,
    initStartupForm
};
*/