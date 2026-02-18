/* ========================================
   FILE-EDITOR.JS - File Editor
   ======================================== */

const FileEditor = {
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
        }

        window.addEventListener('beforeunload', (e) => this.handleBeforeUnload(e));
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

        const fileManager = document.getElementById('fileManagerContainer');
        const fileEditor = document.getElementById('fileEditorContainer');
        
        if (fileManager) fileManager.style.display = 'none';
        if (fileEditor) fileEditor.classList.add('active');

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
            textarea.value = 'Loading file content...';
            textarea.disabled = true;
        }

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
                    textarea.value = data.content;
                    textarea.disabled = false;
                    textarea.focus();
                }

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
     * Close file editor
     */
    close() {
        if (FileEditorState.hasChanges) {
            if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
                return;
            }
        }

        FileEditorState.isEditing = false;
        FileEditorState.currentFile = null;
        FileEditorState.originalContent = '';
        FileEditorState.hasChanges = false;

        const fileManager = document.getElementById('fileManagerContainer');
        const fileEditor = document.getElementById('fileEditorContainer');
        
        if (fileEditor) fileEditor.classList.remove('active');
        if (fileManager) fileManager.style.display = 'flex';

        const textarea = document.getElementById('fileEditorTextarea');
        if (textarea) {
            textarea.value = '';
        }
    },

    /**
     * Save file content
     */
    async save() {
        if (!FileEditorState.currentFile) return;

        const textarea = document.getElementById('fileEditorTextarea');
        const saveBtn = document.getElementById('editorSaveBtn');

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
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData
                }
            );

            const data = await response.json();

            if (data.success) {
                FileEditorState.originalContent = content;
                FileEditorState.hasChanges = false;

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
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    },

    /**
     * Update editor info
     */
    updateEditorInfo(content, size) {
        const sizeEl = document.getElementById('editorFileSize');
        const lineCountEl = document.getElementById('editorLineCount');

        if (sizeEl) {
            sizeEl.textContent = FileUtils.formatFileSize(size);
        }

        if (lineCountEl) {
            const lines = content.split('\n').length;
            lineCountEl.textContent = `${lines} line${lines !== 1 ? 's' : ''}`;
        }
    },

    /**
     * Handle textarea input
     */
    handleTextareaInput() {
        const textarea = document.getElementById('fileEditorTextarea');
        if (!textarea) return;

        const currentContent = textarea.value;
        FileEditorState.hasChanges = (currentContent !== FileEditorState.originalContent);

        const lines = currentContent.split('\n').length;
        const lineCountEl = document.getElementById('editorLineCount');
        if (lineCountEl) {
            lineCountEl.textContent = `${lines} line${lines !== 1 ? 's' : ''}`;
        }
    },

    /**
     * Handle keydown events
     */
    handleKeydown(e) {
        // Ctrl+S or Cmd+S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.save();
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