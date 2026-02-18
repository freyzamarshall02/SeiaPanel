/* ========================================
   MAIN.JS - Main JavaScript Coordinator
   ======================================== */

document.addEventListener('DOMContentLoaded', function() {

    // Auto-hide server-rendered alerts
    autoHideAlerts();

    // Initialize logout confirmation
    initLogoutConfirmation();

    // Initialize keyboard shortcuts
    initKeyboardShortcuts();

    // Initialize visual enhancements
    initVisualEnhancements();

    // Initialize mobile navigation
    initMobileNav();

    // PAGE-SPECIFIC INITIALIZATIONS
    const currentPath = window.location.pathname;

    // Login Page
    if (currentPath === '/' || currentPath === '/login') {
        initLoginForm();
    }

    // Register Page
    if (currentPath === '/register') {
        initRegisterForm();
    }

    // Account Page
    if (currentPath === '/account') {
        initUsernameForm();
        initPasswordForm();
    }

    // Settings Page
    if (currentPath === '/settings') {
        initSettingsForm();
    }

    // Server Console Page
    if (currentPath.includes('/server/') && !currentPath.includes('/startup') && !currentPath.includes('/files')) {
        initConsolePage();
    }

    // Startup Page
    if (currentPath.includes('/startup')) {
        const serverName = extractServerName(currentPath);
        if (serverName) {
            initStartupForm(serverName);
        }
    }

    // Dashboard Page
    if (currentPath === '/dashboard') {
        initDashboard();
    }
});

// ========================================
//   MOBILE NAV
// ========================================

/**
 * Inject floating home + menu buttons and slide-up drawer
 * Reads existing sidebar links so it works on every page automatically
 */
function initMobileNav() {
    // Only on pages that have a sidebar
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // Grab all sidebar menu links
    const sidebarLinks = sidebar.querySelectorAll('.menu-item');
    if (!sidebarLinks.length) return;

    // ---- FAB Container ----
    const fabContainer = document.createElement('div');
    fabContainer.className = 'mobile-fab-container';

    // Home FAB
    const homeFab = document.createElement('a');
    homeFab.className = 'mobile-fab mobile-fab-home';
    homeFab.href = '/dashboard';
    homeFab.setAttribute('aria-label', 'Home');
    homeFab.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
    `;

    // Menu FAB
    const menuFab = document.createElement('button');
    menuFab.className = 'mobile-fab mobile-fab-menu';
    menuFab.setAttribute('aria-label', 'Open navigation');
    menuFab.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6"  x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
    `;

    fabContainer.appendChild(homeFab);
    fabContainer.appendChild(menuFab);

    // ---- Overlay ----
    const overlay = document.createElement('div');
    overlay.className = 'mobile-nav-overlay';

    // ---- Drawer ----
    const drawer = document.createElement('div');
    drawer.className = 'mobile-nav-drawer';

    // Drag handle
    const handle = document.createElement('div');
    handle.className = 'mobile-nav-drawer-handle';
    drawer.appendChild(handle);

    // Clone sidebar links into drawer
    sidebarLinks.forEach(function(link) {
        const item = document.createElement('a');
        item.className = 'mobile-nav-item';
        item.href = link.href || '#';
        item.innerHTML = link.innerHTML;

        // Preserve active state
        if (link.classList.contains('active')) {
            item.classList.add('active');
        }

        // Close drawer after navigating
        item.addEventListener('click', function() {
            closeMobileDrawer(overlay, drawer);
        });

        drawer.appendChild(item);
    });

    // ---- Inject into DOM ----
    document.body.appendChild(fabContainer);
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    // ---- Events ----
    menuFab.addEventListener('click', function() {
        openMobileDrawer(overlay, drawer);
    });

    overlay.addEventListener('click', function() {
        closeMobileDrawer(overlay, drawer);
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeMobileDrawer(overlay, drawer);
        }
    });
}

function openMobileDrawer(overlay, drawer) {
    overlay.classList.add('open');
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeMobileDrawer(overlay, drawer) {
    overlay.classList.remove('open');
    drawer.classList.remove('open');
    document.body.style.overflow = '';
}

// ========================================
//   GLOBAL FUNCTIONS
// ========================================

function initLogoutConfirmation() {
    const logoutLinks = document.querySelectorAll('a[href="/logout"]');
    logoutLinks.forEach(function(link) {
        link.addEventListener('click', function(e) {
            if (!confirm('Are you sure you want to logout?')) {
                e.preventDefault();
            }
        });
    });
}

function initKeyboardShortcuts() {
    const commandInput = document.getElementById('commandInput');
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k' && commandInput) {
            e.preventDefault();
            commandInput.focus();
        }
    });
}

function initVisualEnhancements() {
    const serverCards = document.querySelectorAll('.server-card');
    serverCards.forEach(function(card) {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-4px) scale(1.02)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
}

// ========================================
//   PAGE-SPECIFIC INITIALIZATIONS
// ========================================

function initConsolePage() {
    const serverName = extractServerName(window.location.pathname);
    if (!serverName) return;

    const serverStatus = getServerStatus();
    let ws = null;
    let uptimeTracker = null;
    let statsPoller = null;

    initConsoleAutoScroll();

    const commandInput = document.getElementById('commandInput');
    if (commandInput) {
        initCommandHistory(commandInput);
        commandInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && this.value.trim() !== '') {
                sendServerCommand(serverName, this.value.trim())
                    .then(() => { this.value = ''; })
                    .catch(err => console.error('Command failed:', err));
            }
        });
    }

    if (serverStatus === 'online') {
        ws = initConsoleWebSocket(
            serverName,
            function onOnline() {
                setServerOnline();
                if (!uptimeTracker) uptimeTracker = initUptimeTracker();
                if (!statsPoller)   statsPoller   = startStatsPolling(serverName);
            },
            function onOffline() {
                setServerOffline();
                if (uptimeTracker) { uptimeTracker.stop(); uptimeTracker = null; }
                if (statsPoller)   { statsPoller.stop();   statsPoller   = null; }
            }
        );
        uptimeTracker = initUptimeTracker();
        statsPoller   = startStatsPolling(serverName);
    }

    const startBtn   = document.getElementById('startBtn');
    const restartBtn = document.getElementById('restartBtn');
    const stopBtn    = document.getElementById('stopBtn');

    if (startBtn)   startBtn.addEventListener('click',   () => handleServerControl(serverName, 'start'));
    if (restartBtn) restartBtn.addEventListener('click', () => handleServerControl(serverName, 'restart'));
    if (stopBtn)    stopBtn.addEventListener('click',    () => handleServerControl(serverName, 'stop'));
}

function handleServerControl(serverName, action) {
    const btn = document.getElementById(action + 'Btn');
    if (!btn) return;

    const originalDisabled = btn.disabled;
    btn.disabled = true;

    controlServer(serverName, action)
        .then(data => {
            if (data.status) {
                if (action === 'start') {
                    setTimeout(() => location.reload(), 2000);
                } else if (action === 'restart') {
                    const consoleEl = document.getElementById('console');
                    if (consoleEl) {
                        const line = document.createElement('div');
                        line.textContent = '\n=== Server is restarting... ===\n';
                        line.style.color = '#60a5fa';
                        consoleEl.appendChild(line);
                    }
                    setTimeout(() => location.reload(), 3000);
                }
            } else if (data.error) {
                alert('Error: ' + data.error);
                btn.disabled = originalDisabled;
            }
        })
        .catch(err => {
            console.error('Control failed:', err);
            btn.disabled = originalDisabled;
        });
}

function initDashboard() {
    // Optional: auto-refresh
    // setInterval(() => location.reload(), 30000);
}

// ========================================
//   HELPER FUNCTIONS
// ========================================

function extractServerName(path) {
    const match = path.match(/\/server\/([^\/]+)/);
    return match ? match[1] : null;
}

function getServerStatus() {
    const statusDot = document.querySelector('.status-dot');
    if (statusDot && statusDot.classList.contains('status-online')) return 'online';
    return 'offline';
}

// ========================================
//   CONSOLE BRANDING
// ========================================
console.log('%c🎮 SeiaPanel',             'color: #60a5fa; font-size: 20px; font-weight: bold;');
console.log('%cWelcome to the console!',  'color: #94a3b8; font-size: 14px;');
console.log('%cAJAX Architecture Active ✅', 'color: #10b981; font-size: 12px;');
console.log('%cModular JavaScript Loaded ✅', 'color: #10b981; font-size: 12px;');