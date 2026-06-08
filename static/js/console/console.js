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
            appendConsoleLine(consoleEl, event.data);
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


// ========== ANSI COLOR / EMOJI RENDERING ==========

const ANSI_COLORS = {
    30: '#0f172a',
    31: '#ef4444',
    32: '#22c55e',
    33: '#eab308',
    34: '#3b82f6',
    35: '#d946ef',
    36: '#06b6d4',
    37: '#e5e7eb',
    90: '#64748b',
    91: '#f87171',
    92: '#4ade80',
    93: '#facc15',
    94: '#60a5fa',
    95: '#e879f9',
    96: '#22d3ee',
    97: '#f8fafc'
};

const ANSI_BACKGROUND_COLORS = {
    40: '#0f172a',
    41: '#7f1d1d',
    42: '#14532d',
    43: '#713f12',
    44: '#1e3a8a',
    45: '#701a75',
    46: '#164e63',
    47: '#f1f5f9',
    100: '#334155',
    101: '#991b1b',
    102: '#166534',
    103: '#854d0e',
    104: '#1d4ed8',
    105: '#86198f',
    106: '#0e7490',
    107: '#ffffff'
};

const ANSI_256_COLORS = [
    '#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0',
    '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff'
];

const MINECRAFT_COLORS = {
    '0': '#000000',
    '1': '#0000aa',
    '2': '#00aa00',
    '3': '#00aaaa',
    '4': '#aa0000',
    '5': '#aa00aa',
    '6': '#ffaa00',
    '7': '#aaaaaa',
    '8': '#555555',
    '9': '#5555ff',
    'a': '#55ff55',
    'b': '#55ffff',
    'c': '#ff5555',
    'd': '#ff55ff',
    'e': '#ffff55',
    'f': '#ffffff'
};

const ANSI_OR_MINECRAFT_COLOR_PATTERN = /\x1b\[[0-9;]*m|§[0-9A-FK-ORa-fk-or]/;
const LOG_LEVEL_PATTERN = /(?:^|\[|[\s/])(INFO|WARN|WARNING|ERROR|SEVERE|FATAL|DEBUG|TRACE)(?=\]|\s|:)/i;
const LOG_LEVEL_CLASS_MAP = {
    info: 'console-line-info',
    warn: 'console-line-warn',
    warning: 'console-line-warn',
    error: 'console-line-error',
    severe: 'console-line-error',
    fatal: 'console-line-error',
    debug: 'console-line-debug',
    trace: 'console-line-debug'
};

/**
 * Append a console line while preserving ANSI colors/styles and Unicode emoji.
 * Text is always added with text nodes so server output cannot inject HTML.
 * @param {HTMLElement} consoleEl - Console output container
 * @param {string} text - Raw console text, possibly containing ANSI SGR escapes
 */
function appendConsoleLine(consoleEl, text) {
    const line = document.createElement('div');
    line.className = 'console-line';

    const fallbackClass = getPlainLogLevelClass(text);
    if (fallbackClass) {
        line.classList.add(fallbackClass);
    }

    renderAnsiText(line, text);
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

/**
 * @param {string} text - Raw console text
 * @returns {string} CSS class name for the detected log level, or an empty string
 */
function getPlainLogLevelClass(text) {
    if (ANSI_OR_MINECRAFT_COLOR_PATTERN.test(text)) return '';

    const match = text.match(LOG_LEVEL_PATTERN);
    if (!match) return '';

    return LOG_LEVEL_CLASS_MAP[match[1].toLowerCase()] || '';
}

/**
 * Render ANSI SGR- and Minecraft legacy-formatted text into an element.
 * Supports standard, bright, 256-color, and 24-bit truecolor foreground/background codes.
 * @param {HTMLElement} target - Target element
 * @param {string} text - Raw text
 */
function renderAnsiText(target, text) {
    const colorPattern = /\x1b\[([0-9;]*)m|§([0-9A-FK-ORa-fk-or])/g;
    let lastIndex = 0;
    let style = createDefaultAnsiStyle();
    let match;

    while ((match = colorPattern.exec(text)) !== null) {
        appendStyledText(target, text.slice(lastIndex, match.index), style);
        if (match[1] !== undefined) {
            style = applyAnsiCodes(style, match[1]);
        } else {
            style = applyMinecraftCode(style, match[2]);
        }
        lastIndex = colorPattern.lastIndex;
    }

    appendStyledText(target, text.slice(lastIndex), style);
}

function createDefaultAnsiStyle() {
    return {
        color: '',
        backgroundColor: '',
        bold: false,
        dim: false,
        italic: false,
        underline: false,
        textDecoration: ''
    };
}

function appendStyledText(target, text, style) {
    if (!text) return;

    const span = document.createElement('span');
    span.textContent = text;

    if (style.color) span.style.color = style.color;
    if (style.backgroundColor) span.style.backgroundColor = style.backgroundColor;
    if (style.bold) span.style.fontWeight = '700';
    if (style.dim) span.style.opacity = '0.7';
    if (style.italic) span.style.fontStyle = 'italic';
    if (style.underline) span.style.textDecoration = 'underline';
    if (style.textDecoration) span.style.textDecoration = style.textDecoration;

    target.appendChild(span);
}

function applyMinecraftCode(currentStyle, rawCode) {
    const code = rawCode.toLowerCase();
    const style = Object.assign({}, currentStyle);

    if (MINECRAFT_COLORS[code]) {
        Object.assign(style, createDefaultAnsiStyle());
        style.color = MINECRAFT_COLORS[code];
    } else if (code === 'l') {
        style.bold = true;
    } else if (code === 'm') {
        style.textDecoration = 'line-through';
    } else if (code === 'n') {
        style.underline = true;
    } else if (code === 'o') {
        style.italic = true;
    } else if (code === 'r') {
        Object.assign(style, createDefaultAnsiStyle());
    }

    return style;
}

function applyAnsiCodes(currentStyle, codeString) {
    const codes = codeString === '' ? [0] : codeString.split(';').map(function(code) {
        const parsed = parseInt(code, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    });
    const style = Object.assign({}, currentStyle);

    for (let i = 0; i < codes.length; i++) {
        const code = codes[i];

        if (code === 0) {
            Object.assign(style, createDefaultAnsiStyle());
        } else if (code === 1) {
            style.bold = true;
        } else if (code === 2) {
            style.dim = true;
        } else if (code === 3) {
            style.italic = true;
        } else if (code === 4) {
            style.underline = true;
        } else if (code === 22) {
            style.bold = false;
            style.dim = false;
        } else if (code === 23) {
            style.italic = false;
        } else if (code === 24) {
            style.underline = false;
        } else if (code === 39) {
            style.color = '';
        } else if (code === 49) {
            style.backgroundColor = '';
        } else if (ANSI_COLORS[code]) {
            style.color = ANSI_COLORS[code];
        } else if (ANSI_BACKGROUND_COLORS[code]) {
            style.backgroundColor = ANSI_BACKGROUND_COLORS[code];
        } else if (code === 38 || code === 48) {
            const isForeground = code === 38;
            const parsedColor = parseExtendedAnsiColor(codes, i + 1);
            if (parsedColor.color) {
                if (isForeground) {
                    style.color = parsedColor.color;
                } else {
                    style.backgroundColor = parsedColor.color;
                }
                i = parsedColor.nextIndex - 1;
            }
        }
    }

    return style;
}

function parseExtendedAnsiColor(codes, startIndex) {
    const mode = codes[startIndex];

    if (mode === 2 && codes.length >= startIndex + 4) {
        return {
            color: 'rgb(' + clampColor(codes[startIndex + 1]) + ', ' + clampColor(codes[startIndex + 2]) + ', ' + clampColor(codes[startIndex + 3]) + ')',
            nextIndex: startIndex + 4
        };
    }

    if (mode === 5 && codes.length >= startIndex + 2) {
        return {
            color: ansi256ToHex(codes[startIndex + 1]),
            nextIndex: startIndex + 2
        };
    }

    return { color: '', nextIndex: startIndex };
}

function clampColor(value) {
    return Math.max(0, Math.min(255, value || 0));
}

function ansi256ToHex(index) {
    index = Math.max(0, Math.min(255, index || 0));

    if (ANSI_256_COLORS[index]) return ANSI_256_COLORS[index];

    if (index >= 16 && index <= 231) {
        const colorIndex = index - 16;
        const r = Math.floor(colorIndex / 36);
        const g = Math.floor((colorIndex % 36) / 6);
        const b = colorIndex % 6;
        const toChannel = value => value === 0 ? 0 : 55 + value * 40;
        return 'rgb(' + toChannel(r) + ', ' + toChannel(g) + ', ' + toChannel(b) + ')';
    }

    const gray = 8 + (index - 232) * 10;
    return 'rgb(' + gray + ', ' + gray + ', ' + gray + ')';
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