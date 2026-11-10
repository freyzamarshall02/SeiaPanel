/* ========================================
   FILE-EDITOR.JS - VS Code-Style File Editor
   ======================================== */

/* ---------- Syntax Highlighter ---------- */
const SyntaxHighlighter = {
    /**
     * Detect language from filename extension
     */
    detectLanguage(filename) {
        if (!filename) return 'plain';
        const ext = filename.split('.').pop().toLowerCase();
        const map = {
            yml: 'yaml', yaml: 'yaml',
            json: 'json',
            js: 'javascript', mjs: 'javascript', cjs: 'javascript',
            ts: 'javascript',
            sh: 'shell', bash: 'shell', zsh: 'shell',
            py: 'python',
            toml: 'toml',
            ini: 'ini', cfg: 'ini', conf: 'ini', properties: 'properties',
            xml: 'xml', html: 'xml', htm: 'xml',
            md: 'markdown',
            java: 'java',
            kt: 'java',
        };
        return map[ext] || 'plain';
    },

    /**
     * Get human-readable language label
     */
    getLabel(lang) {
        const labels = {
            yaml: 'YAML', json: 'JSON', javascript: 'JavaScript',
            shell: 'Shell', python: 'Python', toml: 'TOML',
            ini: 'INI / Config', properties: 'Properties',
            xml: 'XML / HTML', markdown: 'Markdown', java: 'Java', plain: 'Plain Text'
        };
        return labels[lang] || 'Plain Text';
    },

    /**
     * Escape HTML special characters
     */
    escape(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    /**
     * Highlight a full document
     */
    highlight(code, lang) {
        switch (lang) {
            case 'yaml':   return this.highlightYaml(code);
            case 'json':   return this.highlightJson(code);
            case 'javascript': return this.highlightJs(code);
            case 'shell':  return this.highlightShell(code);
            case 'python': return this.highlightPython(code);
            case 'toml':   return this.highlightToml(code);
            case 'ini':
            case 'properties': return this.highlightIni(code);
            case 'xml':    return this.highlightXml(code);
            default:       return this.escape(code);
        }
    },

    /* ---- YAML ---- */
    highlightYaml(code) {
        return code.split('\n').map(line => {
            // Comment lines
            if (/^\s*#/.test(line)) {
                return `<span class="hl-comment">${this.escape(line)}</span>`;
            }
            // Key: value  or  - item
            return line.replace(
                /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:true|false|null|yes|no|on|off)\b)|(^[ \t]*-[ \t]+|^[ \t]*(?:- )?)([\w.\-\/]+)(:)|(#.*)|([-+]?\b\d+(?:\.\d+)?\b)|(:\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^#\n]+)/g,
                (m, dq, bool, dash, key, colon, comment, num, sep, val) => {
                    if (comment) return `<span class="hl-comment">${this.escape(m)}</span>`;
                    if (bool)    return `<span class="hl-boolean">${this.escape(m)}</span>`;
                    if (dq)      return `<span class="hl-string">${this.escape(m)}</span>`;
                    if (num)     return `<span class="hl-number">${this.escape(m)}</span>`;
                    if (key && colon) {
                        const result = (dash ? this.escape(dash) : '') +
                            `<span class="hl-key">${this.escape(key)}</span>` +
                            `<span class="hl-punctuation">${this.escape(colon)}</span>`;
                        if (val) {
                            const valTrimmed = val.trimStart();
                            if (/^".*"$/.test(valTrimmed.trim()) || /^'.*'$/.test(valTrimmed.trim())) {
                                return result + sep + `<span class="hl-string">${this.escape(val)}</span>`;
                            }
                            if (/^[-+]?\d+(?:\.\d+)?$/.test(valTrimmed.trim())) {
                                return result + sep + `<span class="hl-number">${this.escape(val)}</span>`;
                            }
                            if (/^(?:true|false|null|yes|no|on|off)$/.test(valTrimmed.trim())) {
                                return result + sep + `<span class="hl-boolean">${this.escape(val)}</span>`;
                            }
                            return result + (sep ? this.escape(sep) : '') + this.escape(val);
                        }
                        return result;
                    }
                    return this.escape(m);
                }
            );
        }).join('\n');
    },

    /* ---- JSON ---- */
    highlightJson(code) {
        // Simple token-based JSON highlight
        return this.escape(code).replace(
            /(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)?|(\btrue\b|\bfalse\b|\bnull\b)|([-+]?\b\d+(?:\.\d*)?(?:[eE][+-]?\d+)?\b)/g,
            (m, str, colon, bool, num) => {
                if (str && colon) return `<span class="hl-json-key">${str}</span><span class="hl-punctuation">${colon}</span>`;
                if (str)          return `<span class="hl-string">${str}</span>`;
                if (bool)         return `<span class="hl-boolean">${bool}</span>`;
                if (num)          return `<span class="hl-number">${num}</span>`;
                return m;
            }
        );
    },

    /* ---- JavaScript ---- */
    highlightJs(code) {
        const keywords = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|in|of|class|extends|import|export|default|try|catch|finally|throw|async|await|this|super|null|undefined|true|false)\b/g;
        const result = this.escape(code)
            .replace(/(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)/g,
                (m) => `<span class="hl-comment">${m}</span>`)
            .replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;|&#39;(?:[^&]|&(?!#39;))*?&#39;|`[^`]*`)/g,
                (m) => `<span class="hl-string">${m}</span>`)
            .replace(/(?<!class="hl-[^"]*")(?<=^|[^a-zA-Z_$])\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|in|of|class|extends|import|export|default|try|catch|finally|throw|async|await|this|super|null|undefined|true|false)\b(?=[^"]*(?:"[^"]*"[^"]*)*$)/gm,
                (m) => `<span class="hl-keyword">${m}</span>`)
            .replace(/(?<![a-zA-Z_$])(\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g,
                (m) => `<span class="hl-number">${m}</span>`);
        return result;
    },

    /* ---- Shell ---- */
    highlightShell(code) {
        return code.split('\n').map(line => {
            if (/^\s*#/.test(line)) {
                return `<span class="hl-comment">${this.escape(line)}</span>`;
            }
            return this.escape(line)
                .replace(/\b(echo|export|cd|ls|mkdir|rm|cp|mv|cat|grep|sed|awk|if|then|else|fi|for|do|done|while|case|esac|function|return|exit|source|\.|alias|unset|set|read|printf|chmod|chown|sudo|apt|yum|curl|wget|git|java|python3?|pip3?|npm|yarn)\b/g,
                    (m) => `<span class="hl-keyword">${m}</span>`)
                .replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;|&#39;(?:[^&]|&(?!#39;))*?&#39;)/g,
                    (m) => `<span class="hl-string">${m}</span>`)
                .replace(/\$\{?[a-zA-Z_][a-zA-Z0-9_]*\}?/g,
                    (m) => `<span class="hl-variable">${this.escape(m)}</span>`)
                .replace(/(?<![a-zA-Z_])(\d+)\b/g,
                    (m) => `<span class="hl-number">${m}</span>`);
        }).join('\n');
    },

    /* ---- Python ---- */
    highlightPython(code) {
        return code.split('\n').map(line => {
            if (/^\s*#/.test(line)) {
                return `<span class="hl-comment">${this.escape(line)}</span>`;
            }
            return this.escape(line)
                .replace(/\b(def|class|import|from|return|if|elif|else|for|while|try|except|finally|with|as|pass|break|continue|lambda|yield|raise|del|and|or|not|in|is|None|True|False|self|super|print|len|range|type|str|int|float|list|dict|tuple|set)\b/g,
                    (m) => `<span class="hl-keyword">${m}</span>`)
                .replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;|&#39;(?:[^&]|&(?!#39;))*?&#39;)/g,
                    (m) => `<span class="hl-string">${m}</span>`)
                .replace(/(?<![a-zA-Z_])(\d+\.?\d*)\b/g,
                    (m) => `<span class="hl-number">${m}</span>`);
        }).join('\n');
    },

    /* ---- TOML ---- */
    highlightToml(code) {
        return code.split('\n').map(line => {
            if (/^\s*#/.test(line)) {
                return `<span class="hl-comment">${this.escape(line)}</span>`;
            }
            if (/^\s*\[/.test(line)) {
                return `<span class="hl-tag">${this.escape(line)}</span>`;
            }
            return this.escape(line)
                .replace(/^(\s*[\w.\-]+)(\s*=)/,
                    (m, key, eq) => `<span class="hl-key">${key}</span><span class="hl-punctuation">${eq}</span>`)
                .replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;|&#39;(?:[^&]|&(?!#39;))*?&#39;)/g,
                    (m) => `<span class="hl-string">${m}</span>`)
                .replace(/\b(true|false)\b/g,
                    (m) => `<span class="hl-boolean">${m}</span>`)
                .replace(/(?<![a-zA-Z_])(\d+\.?\d*)\b/g,
                    (m) => `<span class="hl-number">${m}</span>`);
        }).join('\n');
    },

    /* ---- INI / Properties ---- */
    highlightIni(code) {
        return code.split('\n').map(line => {
            if (/^\s*[#;]/.test(line)) {
                return `<span class="hl-comment">${this.escape(line)}</span>`;
            }
            if (/^\s*\[/.test(line)) {
                return `<span class="hl-tag">${this.escape(line)}</span>`;
            }
            const m = line.match(/^(\s*[\w.\-]+)(\s*[=:]\s*)(.*)/);
            if (m) {
                return `<span class="hl-key">${this.escape(m[1])}</span>` +
                    `<span class="hl-punctuation">${this.escape(m[2])}</span>` +
                    `<span class="hl-string">${this.escape(m[3])}</span>`;
            }
            return this.escape(line);
        }).join('\n');
    },

    /* ---- XML / HTML ---- */
    highlightXml(code) {
        return this.escape(code)
            .replace(/(&lt;!--[\s\S]*?--&gt;)/g,
                (m) => `<span class="hl-comment">${m}</span>`)
            .replace(/(&lt;\/?)([\w:-]+)/g,
                (m, bracket, tag) => `<span class="hl-punctuation">${bracket}</span><span class="hl-tag">${tag}</span>`)
            .replace(/([\w:-]+)(=)(&quot;[^&]*(?:&(?!quot;)[^&]*)*&quot;|&#39;[^&]*(?:&(?!#39;)[^&]*)*&#39;)/g,
                (m, attr, eq, val) => `<span class="hl-key">${attr}</span>${eq}<span class="hl-string">${val}</span>`);
    }
};

/* ---------- File Editor ---------- */
const FileEditor = {
    _lang: 'plain',
    _syncScrolling: false,

    /**
     * Initialize file editor
     */
    init() {
        this.initEventListeners();
    },

    /**
     * Initialize event listeners
     */
    initEventListeners() {
        const cancelBtn = document.getElementById('editorCancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.close());
        }

        const saveBtn = document.getElementById('editorSaveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.save());
        }

        const textarea = document.getElementById('fileEditorTextarea');
        if (textarea) {
            textarea.addEventListener('input', () => this.handleTextareaInput());
            textarea.addEventListener('keydown', (e) => this.handleKeydown(e));
            // Sync scroll: textarea scroll -> gutter + highlight layer
            textarea.addEventListener('scroll', () => this.syncScroll());
        }

        window.addEventListener('beforeunload', (e) => this.handleBeforeUnload(e));
    },

    /**
     * Sync scroll positions
     */
    syncScroll() {
        const textarea = document.getElementById('fileEditorTextarea');
        const lnums    = document.getElementById('codeLineNumbers');
        const highlight = document.getElementById('codeEditorHighlight');
        if (!textarea) return;

        // Sync the highlight pre to match textarea scroll
        if (highlight) {
            highlight.style.transform =
                `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
        }

        // Sync gutter vertical scroll via transform
        if (lnums) {
            lnums.style.transform = `translateY(${-textarea.scrollTop}px)`;
        }
    },

    /**
     * Open file in editor
     */
    async open(file) {
        const fileType = FileUtils.getFileType(file);
        if (fileType !== 'editable') {
            FileUtils.showError('This file type cannot be edited in the browser');
            return;
        }

        FileEditorState.isEditing = true;
        FileEditorState.currentFile = file;
        FileEditorState.hasChanges = false;

        // Detect language from filename
        this._lang = SyntaxHighlighter.detectLanguage(file.name);

        // Update language label
        const langEl = document.getElementById('editorLanguage');
        if (langEl) langEl.textContent = SyntaxHighlighter.getLabel(this._lang);

        const fileManager = document.getElementById('fileManagerContainer');
        const fileEditor  = document.getElementById('fileEditorContainer');

        if (fileManager) fileManager.style.display = 'none';
        if (fileEditor)  fileEditor.classList.add('active');

        const editorFileName = document.getElementById('editorFileName');
        const editorFilePath = document.getElementById('editorFilePath');

        if (editorFileName) editorFileName.textContent = file.name;
        if (editorFilePath) {
            const fullPath = FileManagerState.currentPath === '/'
                ? `/${file.name}`
                : `${FileManagerState.currentPath}/${file.name}`;
            editorFilePath.textContent = fullPath;
        }

        const textarea = document.getElementById('fileEditorTextarea');
        if (textarea) {
            textarea.value    = 'Loading file content...';
            textarea.disabled = true;
            // Reset scroll to TOP
            textarea.scrollTop  = 0;
            textarea.scrollLeft = 0;
        }

        // Reset content area scroll too
        const content = document.getElementById('codeEditorContent');
        if (content) {
            content.scrollTop  = 0;
            content.scrollLeft = 0;
        }

        // Reset gutter
        const lnums = document.getElementById('codeLineNumbers');
        if (lnums) {
            lnums.style.transform = '';
        }

        this.updateHighlight('Loading file content...');
        this.updateLineNumbers(1);

        try {
            const response = await fetch(
                `/server/${FileManagerState.serverName}/files/read?` +
                `path=${encodeURIComponent(FileManagerState.currentPath)}&` +
                `file=${encodeURIComponent(file.name)}`
            );

            const data = await response.json();

            if (data.success) {
                FileEditorState.originalContent = data.content;

                if (textarea) {
                    textarea.value    = data.content;
                    textarea.disabled = false;
                    // Set cursor to line 1 col 1 BEFORE focus
                    textarea.setSelectionRange(0, 0);
                    textarea.focus();
                    // rAF overrides the browser's auto-scroll-to-cursor after focus()
                    requestAnimationFrame(() => {
                        textarea.scrollTop  = 0;
                        textarea.scrollLeft = 0;
                        this.syncScroll();
                    });
                }

                this.updateHighlight(data.content);
                this.updateLineNumbers(data.content.split('\n').length);
                this.updateEditorInfo(data.content, data.size);
            } else {
                FileUtils.showError(data.error || 'Failed to load file');
                this.close();
            }
        } catch (error) {
            console.error('Failed to load file:', error);
            FileUtils.showError('Failed to load file content');
            this.close();
        }
    },

    /**
     * Update the syntax highlight layer
     */
    updateHighlight(code) {
        const highlight = document.getElementById('codeHighlightCode');
        if (!highlight) return;
        const highlighted = SyntaxHighlighter.highlight(code, this._lang);
        // Add a trailing newline so last line has correct height
        highlight.innerHTML = highlighted + '\n';
    },

    /**
     * Update the line numbers gutter
     */
    updateLineNumbers(count) {
        const lnums = document.getElementById('codeLineNumbers');
        if (!lnums) return;
        let html = '';
        for (let i = 1; i <= count; i++) {
            html += i + '\n';
        }
        lnums.textContent = html;
    },

    /**
     * Close file editor
     */
    close() {
        if (FileEditorState.hasChanges) {
            if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
                return;
            }
        }

        FileEditorState.isEditing    = false;
        FileEditorState.currentFile  = null;
        FileEditorState.originalContent = '';
        FileEditorState.hasChanges   = false;

        const fileManager = document.getElementById('fileManagerContainer');
        const fileEditor  = document.getElementById('fileEditorContainer');

        if (fileEditor)  fileEditor.classList.remove('active');
        if (fileManager) fileManager.style.display = 'flex';

        const textarea = document.getElementById('fileEditorTextarea');
        if (textarea) textarea.value = '';

        const highlight = document.getElementById('codeHighlightCode');
        if (highlight) highlight.innerHTML = '';

        const lnums = document.getElementById('codeLineNumbers');
        if (lnums) lnums.textContent = '';

        const langEl = document.getElementById('editorLanguage');
        if (langEl) langEl.textContent = 'Plain Text';
    },

    /**
     * Save file content
     */
    async save() {
        if (!FileEditorState.currentFile) return;

        const textarea = document.getElementById('fileEditorTextarea');
        const saveBtn  = document.getElementById('editorSaveBtn');

        if (!textarea || !saveBtn) return;

        const content = textarea.value;

        saveBtn.disabled = true;
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"></path>
            </svg>
            Saving...
        `;

        try {
            const formData = new URLSearchParams();
            formData.append('path', FileManagerState.currentPath);
            formData.append('file', FileEditorState.currentFile.name);
            formData.append('content', content);

            const response = await fetch(
                `/server/${FileManagerState.serverName}/files/write`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData
                }
            );

            const data = await response.json();

            if (data.success) {
                FileEditorState.originalContent = content;
                FileEditorState.hasChanges      = false;
                console.log('File saved successfully');
                this.close();
                FileManagerCore.loadDirectory(FileManagerState.currentPath);
            } else {
                FileUtils.showError(data.error || 'Failed to save file');
            }
        } catch (error) {
            console.error('Failed to save file:', error);
            FileUtils.showError('Failed to save file');
        } finally {
            saveBtn.disabled  = false;
            saveBtn.innerHTML = originalText;
        }
    },

    /**
     * Update editor info bar (file size, line count)
     */
    updateEditorInfo(content, size) {
        const sizeEl      = document.getElementById('editorFileSize');
        const lineCountEl = document.getElementById('editorLineCount');

        if (sizeEl)      sizeEl.textContent = FileUtils.formatFileSize(size);
        if (lineCountEl) {
            const lines = content.split('\n').length;
            lineCountEl.textContent = `${lines} line${lines !== 1 ? 's' : ''}`;
        }
    },

    /**
     * Handle textarea input (live update highlight + line numbers)
     */
    handleTextareaInput() {
        const textarea = document.getElementById('fileEditorTextarea');
        if (!textarea) return;

        const currentContent = textarea.value;
        FileEditorState.hasChanges = (currentContent !== FileEditorState.originalContent);

        const lines = currentContent.split('\n').length;

        // Update line count in info bar
        const lineCountEl = document.getElementById('editorLineCount');
        if (lineCountEl) {
            lineCountEl.textContent = `${lines} line${lines !== 1 ? 's' : ''}`;
        }

        // Live-update highlight layer and line numbers
        this.updateHighlight(currentContent);
        this.updateLineNumbers(lines);
    },

    /**
     * Handle keydown events
     */
    handleKeydown(e) {
        // Ctrl+S / Cmd+S → save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.save();
            return;
        }

        // Tab → insert spaces instead of changing focus
        if (e.key === 'Tab') {
            e.preventDefault();
            const textarea = e.target;
            const start = textarea.selectionStart;
            const end   = textarea.selectionEnd;
            const TAB   = '    '; // 4 spaces

            if (e.shiftKey) {
                // Shift+Tab: remove up to 4 spaces before cursor on current line
                const beforeCursor = textarea.value.substring(0, start);
                const lineStart    = beforeCursor.lastIndexOf('\n') + 1;
                const linePrefix   = beforeCursor.substring(lineStart);
                const spacesMatch  = linePrefix.match(/^( {1,4})/);
                if (spacesMatch) {
                    const remove = spacesMatch[1].length;
                    textarea.value =
                        textarea.value.substring(0, lineStart) +
                        textarea.value.substring(lineStart + remove);
                    textarea.selectionStart = textarea.selectionEnd = start - remove;
                }
            } else {
                // Tab: insert 4 spaces
                textarea.value =
                    textarea.value.substring(0, start) + TAB + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + TAB.length;
            }

            // Trigger input handler
            this.handleTextareaInput();
        }
    },

    /**
     * Handle before unload
     */
    handleBeforeUnload(e) {
        if (FileEditorState.isEditing && FileEditorState.hasChanges) {
            e.preventDefault();
            e.returnValue = '';
            return '';
        }
    }
};

// Export for global access
window.FileEditor = FileEditor;
window.SyntaxHighlighter = SyntaxHighlighter;
