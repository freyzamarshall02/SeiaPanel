/* ========================================
   CONSOLE.JS - Console Page Functionality
   ======================================== */

// ========== CONSOLE WEBSOCKET ==========

/**
 * Initialize WebSocket connection for console output
 * @param {string} serverName - Server name for WebSocket endpoint
 * @param {Function} onOnline - Callback when server comes online
 * @param {Function} onOffline - Callback when server goes offline
 */
function initConsoleWebSocket(serverName, onOnline, onOffline) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(protocol + '//' + window.location.host + '/server/' + serverName + '/ws');
    let pingInterval = null;

    ws.onopen = function() {
        console.log('WebSocket connected');
        if (onOnline) onOnline();
        
        // Start keepalive ping every 30 seconds
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(function() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send('ping');
            }
        }, 30000);
    };

    ws.onmessage = function(event) {
        // Ignore pong responses
        if (event.data === 'pong') return;
        
        const consoleEl = document.getElementById('console');
        if (consoleEl) {
            const line = document.createElement('div');
            line.textContent = event.data;
            consoleEl.appendChild(line);
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }
    };

    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
    };

    ws.onclose = function() {
        console.log('WebSocket closed - server stopped');
        
        // Stop keepalive
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }
        
        if (onOffline) onOffline();
    };

    return ws;
}

// ========== COMMAND HISTORY ==========

/**
 * Initialize command history for console input
 * @param {HTMLInputElement} inputElement - Command input element
 */
function initCommandHistory(inputElement) {
    if (!inputElement) return;

    let commandHistory = [];
    let historyIndex = -1;

    inputElement.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
                historyIndex++;
                inputElement.value = commandHistory[commandHistory.length - 1 - historyIndex];
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                historyIndex--;
                inputElement.value = commandHistory[commandHistory.length - 1 - historyIndex];
            } else if (historyIndex === 0) {
                historyIndex = -1;
                inputElement.value = '';
            }
        } else if (e.key === 'Enter' && inputElement.value.trim() !== '') {
            // Add to history
            commandHistory.push(inputElement.value.trim());
            if (commandHistory.length > 50) {
                commandHistory.shift(); // Keep only last 50 commands
            }
            historyIndex = -1;
        }
    });
}

// ========== CONSOLE AUTO-SCROLL ==========

/**
 * Auto-scroll console to bottom when new content arrives
 */
function initConsoleAutoScroll() {
    const consoleOutput = document.getElementById('console');
    if (!consoleOutput) return;

    // Keep console scrolled to bottom
    const observer = new MutationObserver(function() {
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    });
    
    observer.observe(consoleOutput, {
        childList: true,
        subtree: true
    });
}

// ========== UPTIME TRACKER ==========

/**
 * Initialize uptime tracking and display
 * @param {number} initialSeconds - Initial uptime in seconds (optional)
 */
function initUptimeTracker(initialSeconds = null) {
    const uptimeElement = document.getElementById('uptime');
    if (!uptimeElement) return;

    let startTime;
    let uptimeInterval;

    // Calculate start time from initial uptime string or use current time
    if (initialSeconds !== null) {
        startTime = Date.now() - (initialSeconds * 1000);
    } else {
        const initialUptime = uptimeElement.textContent.trim();
        if (initialUptime !== 'Offline') {
            startTime = calculateStartTimeFromString(initialUptime);
        } else {
            startTime = Date.now();
        }
    }

    function updateUptime() {
        if (!startTime) return;
        
        const now = Date.now();
        const diff = now - startTime;
        const seconds = Math.floor(diff / 1000);
        
        uptimeElement.textContent = formatUptime(seconds);
    }

    // Start interval
    uptimeInterval = setInterval(updateUptime, 1000);
    updateUptime(); // Update immediately

    return {
        start: function(newStartTime = null) {
            startTime = newStartTime || Date.now();
            updateUptime();
        },
        stop: function() {
            if (uptimeInterval) {
                clearInterval(uptimeInterval);
                uptimeInterval = null;
            }
            startTime = null;
            uptimeElement.textContent = 'Offline';
        }
    };
}

/**
 * Calculate start time from uptime string
 * @param {string} uptimeStr - Uptime string (e.g., "2d 3h 45m 10s")
 * @returns {number} - Start timestamp in milliseconds
 */
function calculateStartTimeFromString(uptimeStr) {
    const now = Date.now();
    let totalSeconds = 0;
    
    const days = uptimeStr.match(/(\d+)d/);
    const hours = uptimeStr.match(/(\d+)h/);
    const minutes = uptimeStr.match(/(\d+)m/);
    const seconds = uptimeStr.match(/(\d+)s/);
    
    if (days) totalSeconds += parseInt(days[1]) * 86400;
    if (hours) totalSeconds += parseInt(hours[1]) * 3600;
    if (minutes) totalSeconds += parseInt(minutes[1]) * 60;
    if (seconds) totalSeconds += parseInt(seconds[1]);
    
    return now - (totalSeconds * 1000);
}

// ========== STATS POLLING ==========

/**
 * Start polling server stats (memory usage)
 * @param {string} serverName - Server name
 * @param {number} interval - Polling interval in milliseconds (default 3000)
 */
function startStatsPolling(serverName, interval = 3000) {
    function fetchStats() {
        fetch('/server/' + serverName + '/stats')
            .then(response => response.json())
            .then(data => {
                if (data.is_running) {
                    updateMemoryDisplay(data.memory_mb, data.memory_gb);
                } else {
                    const memoryEl = document.getElementById('memory');
                    if (memoryEl) {
                        memoryEl.textContent = '-';
                    }
                }
            })
            .catch(err => {
                console.error('Failed to fetch stats:', err);
            });
    }

    // Fetch immediately
    fetchStats();
    
    // Then fetch at interval
    const statsInterval = setInterval(fetchStats, interval);
    
    return {
        stop: function() {
            clearInterval(statsInterval);
        }
    };
}

/**
 * Update memory display
 * @param {number} memoryMB - Memory in MB
 * @param {number} memoryGB - Memory in GB
 */
function updateMemoryDisplay(memoryMB, memoryGB) {
    const memoryEl = document.getElementById('memory');
    if (!memoryEl) return;
    
    if (memoryGB >= 1) {
        // Show in GB if >= 1 GB
        memoryEl.textContent = memoryGB.toFixed(2) + ' GB';
    } else {
        // Show in MB if < 1 GB
        memoryEl.textContent = memoryMB.toFixed(0) + ' MB';
    }
}

// ========== SERVER CONTROLS ==========

/**
 * Send command to server
 * @param {string} serverName - Server name
 * @param {string} command - Command to send
 */
function sendServerCommand(serverName, command) {
    return fetch('/server/' + serverName + '/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'command=' + encodeURIComponent(command)
    })
    .then(response => response.json())
    .catch(err => {
        console.error('Command failed:', err);
        throw err;
    });
}

/**
 * Control server (start/stop/restart)
 * @param {string} serverName - Server name
 * @param {string} action - Action: 'start', 'stop', or 'restart'
 */
function controlServer(serverName, action) {
    return fetch('/server/' + serverName + '/' + action, {
        method: 'POST'
    })
    .then(response => response.json())
    .catch(err => {
        console.error('Control failed:', err);
        throw err;
    });
}

/**
 * Set server UI to online state
 * @param {Array<string>} buttonIds - IDs of buttons to enable/disable
 */
function setServerOnline(buttonIds = {}) {
    const { start = 'startBtn', restart = 'restartBtn', stop = 'stopBtn', input = 'commandInput' } = buttonIds;
    
    const startBtn = document.getElementById(start);
    const restartBtn = document.getElementById(restart);
    const stopBtn = document.getElementById(stop);
    const commandInput = document.getElementById(input);
    
    if (startBtn) startBtn.disabled = true;
    if (restartBtn) restartBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = false;
    if (commandInput) commandInput.disabled = false;
    
    // Update status dot
    const statusDot = document.querySelector('.status-dot');
    if (statusDot) {
        statusDot.classList.remove('status-offline');
        statusDot.classList.add('status-online');
    }
}

/**
 * Set server UI to offline state
 * @param {Array<string>} buttonIds - IDs of buttons to enable/disable
 */
function setServerOffline(buttonIds = {}) {
    const { start = 'startBtn', restart = 'restartBtn', stop = 'stopBtn', input = 'commandInput' } = buttonIds;
    
    const startBtn = document.getElementById(start);
    const restartBtn = document.getElementById(restart);
    const stopBtn = document.getElementById(stop);
    const commandInput = document.getElementById(input);
    
    if (startBtn) startBtn.disabled = false;
    if (restartBtn) restartBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = true;
    if (commandInput) commandInput.disabled = true;
    
    // Update status dot
    const statusDot = document.querySelector('.status-dot');
    if (statusDot) {
        statusDot.classList.remove('status-online');
        statusDot.classList.add('status-offline');
    }
}

// ========== EXPORTS (if using modules) ==========
// Uncomment if using ES6 modules
/*
export {
    initConsoleWebSocket,
    initCommandHistory,
    initConsoleAutoScroll,
    initUptimeTracker,
    startStatsPolling,
    sendServerCommand,
    controlServer,
    setServerOnline,
    setServerOffline
};
*/