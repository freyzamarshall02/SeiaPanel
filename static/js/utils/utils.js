/* ========================================
   UTILS.JS - AJAX Utilities & Helpers
   ======================================== */

// ========== AJAX UTILITY FUNCTIONS ==========

/**
 * Show alert message in a specific container
 * @param {string} message - The message to display
 * @param {string} type - Alert type: 'success' or 'error'
 * @param {string} containerId - ID of the container element
 */
function showAlert(message, type, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Alert container '${containerId}' not found`);
        return;
    }

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    // Clear previous alerts in this container
    container.innerHTML = '';
    container.appendChild(alertDiv);

    // Auto-hide after 5 seconds
    setTimeout(() => {
        alertDiv.style.opacity = '0';
        alertDiv.style.transition = 'opacity 0.5s';
        setTimeout(() => alertDiv.remove(), 500);
    }, 5000);
}

/**
 * Make an AJAX call with automatic error handling
 * @param {string} url - The URL to send the request to
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {FormData|URLSearchParams|null} data - Data to send
 * @returns {Promise<Object>} - The JSON response
 */
async function apiCall(url, method = 'POST', data = null) {
    const options = {
        method: method,
        headers: {}
    };
    
    if (data && method !== 'GET') {
        if (data instanceof FormData) {
            options.body = new URLSearchParams(data);
        } else {
            options.body = data;
        }
    }
    
    try {
        const response = await fetch(url, options);
        
        // Try to parse JSON response
        const responseData = await response.json();
        
        return responseData;
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Network error occurred. Please try again.');
    }
}

/**
 * Handle form submission with AJAX
 * @param {HTMLFormElement} form - The form element
 * @param {string} url - The URL to submit to
 * @param {Function} onSuccess - Callback on success
 * @param {Function} onError - Callback on error
 * @param {string} buttonId - ID of the submit button
 */
async function handleFormSubmit(form, url, onSuccess, onError, buttonId) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    // Disable button and show loading state
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Loading...';

    try {
        const formData = new FormData(form);
        const data = await apiCall(url, 'POST', formData);

        if (data.success) {
            if (onSuccess) onSuccess(data);
        } else {
            if (onError) onError(data);
        }
    } catch (error) {
        if (onError) onError({ error: error.message });
    } finally {
        // Re-enable button
        button.disabled = false;
        button.textContent = originalText;
    }
}

// ========== VALIDATION HELPERS ==========

/**
 * Validate password match
 * @param {string} password - The password
 * @param {string} confirmPassword - The confirmation password
 * @returns {Object} - { valid: boolean, error: string }
 */
function validatePasswordMatch(password, confirmPassword) {
    if (password !== confirmPassword) {
        return { valid: false, error: 'Passwords do not match' };
    }
    if (password.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters' };
    }
    return { valid: true, error: null };
}

/**
 * Validate path (warn on relative paths)
 * @param {string} path - The path to validate
 * @returns {boolean} - True if valid or user confirms
 */
function validatePath(path) {
    if (path && !path.startsWith('/')) {
        return confirm('This appears to be a relative path. Are you sure this is correct?');
    }
    return true;
}

/**
 * Debounce function - delays execution until after wait time
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Format bytes to human readable format
 * @param {number} bytes - Bytes to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} - Formatted string (e.g., "1.5 GB")
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format uptime duration
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted string (e.g., "2d 3h 45m")
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m ${secs}s`;
    } else {
        return `${hours}h ${minutes}m ${secs}s`;
    }
}

// ========== DOM HELPERS ==========

/**
 * Auto-hide server-rendered alerts after delay
 */
function autoHideAlerts() {
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(function(alert) {
        setTimeout(function() {
            alert.style.opacity = '0';
            alert.style.transition = 'opacity 0.5s';
            setTimeout(function() {
                alert.remove();
            }, 500);
        }, 5000);
    });
}

/**
 * Confirm action with custom message
 * @param {string} message - Confirmation message
 * @returns {boolean} - True if confirmed
 */
function confirmAction(message) {
    return confirm(message);
}

// ========== EXPORTS (if using modules) ==========
// Uncomment if using ES6 modules
/*
export {
    showAlert,
    apiCall,
    handleFormSubmit,
    validatePasswordMatch,
    validatePath,
    debounce,
    formatBytes,
    formatUptime,
    autoHideAlerts,
    confirmAction
};
*/