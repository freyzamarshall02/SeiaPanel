/* ========================================
   FILE-MANAGER.JS - Core File Manager
   ======================================== */

const FileManagerCore = {
    /**
     * Initialize file manager
     */
    init() {
        // Load initial directory
        this.loadDirectory('/');
        
        // Initialize event listeners
        this.initEventListeners();

        // Load saved view preference
        const savedView = localStorage.getItem('fileManagerView');
        if (savedView) {
            FileManagerState.currentView = savedView;
            this.updateViewToggle();
        }
    },

    /**
     * Initialize event listeners
     */
    initEventListeners() {
        // Select all checkbox
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', this.handleSelectAll.bind(this));
        }
        
        // View toggle buttons
        const listViewBtn = document.getElementById('listViewBtn');
        const gridViewBtn = document.getElementById('gridViewBtn');
        
        if (listViewBtn) {
            listViewBtn.addEventListener('click', () => this.switchView('list'));
        }
        
        if (gridViewBtn) {
            gridViewBtn.addEventListener('click', () => this.switchView('grid'));
        }
        
        // Breadcrumb home click
        const breadcrumbHome = document.getElementById('breadcrumbHome');
        if (breadcrumbHome) {
            breadcrumbHome.addEventListener('click', () => this.navigateToPath('/'));
        }

        // Paste and Cancel buttons
        const pasteBtn = document.getElementById('pasteBtn');
        const cancelClipboardBtn = document.getElementById('cancelClipboardBtn');
        
        if (pasteBtn) {
            pasteBtn.addEventListener('click', () => this.handlePaste());
        }
        
        if (cancelClipboardBtn) {
            cancelClipboardBtn.addEventListener('click', () => this.clearClipboard());
        }
    },

    /**
     * Load directory contents
     * @param {string} path - Path to load
     */
    async loadDirectory(path) {
        FileManagerState.isLoading = true;
        FileManagerState.currentPath = path;
        FileManagerState.selectedFiles.clear();
        
        // Show loading state
        this.showLoadingState();
        
        // Clear selection
        this.updateSelectAllCheckbox();
        this.updateFloatingActions();
        
        try {
            const response = await fetch(
                `/server/${FileManagerState.serverName}/files/list?path=${encodeURIComponent(path)}`
            );
            
            const data = await response.json();
            
            if (data.error) {
                FileUtils.showError(data.error);
                FileManagerState.files = [];
            } else {
                FileManagerState.files = data.files || [];
                FileManagerState.currentPath = data.current_path || path;
            }
            
            // Update UI
            this.updateBreadcrumb();
            this.renderFiles();
            
        } catch (error) {
            console.error('Failed to load directory:', error);
            FileUtils.showError('Failed to load directory');
            FileManagerState.files = [];
            this.renderFiles();
        } finally {
            FileManagerState.isLoading = false;
        }
    },

    /**
     * Navigate to a specific folder
     * @param {string} folderName - Name of the folder
     */
    async navigateToFolder(folderName) {
        try {
            const response = await fetch(
                `/server/${FileManagerState.serverName}/files/navigate?` +
                `current_path=${encodeURIComponent(FileManagerState.currentPath)}&` +
                `folder=${encodeURIComponent(folderName)}`
            );
            
            const data = await response.json();
            
            if (data.error) {
                FileUtils.showError(data.error);
            } else {
                this.loadDirectory(data.new_path);
            }
            
        } catch (error) {
            console.error('Failed to navigate:', error);
            FileUtils.showError('Failed to navigate to folder');
        }
    },

    /**
     * Navigate to a specific path (from breadcrumb)
     * @param {string} path - Path to navigate to
     */
    navigateToPath(path) {
        this.loadDirectory(path);
    },

    /**
     * Render files in current view
     */
    renderFiles() {
        const container = document.getElementById('fileListContainer');
        if (!container) return;
        
        if (FileManagerState.files.length === 0) {
            this.showEmptyState();
            return;
        }
        
        if (FileManagerState.currentView === 'list') {
            this.renderListView();
        } else {
            this.renderGridView();
        }
    },

    /**
     * Render files in list view
     */
    renderListView() {
        const container = document.getElementById('fileListContainer');
        container.innerHTML = '';
        
        const fileList = document.createElement('div');
        fileList.className = 'file-list';
        
        FileManagerState.files.forEach(file => {
            const fileItem = this.createListFileItem(file);
            fileList.appendChild(fileItem);
        });
        
        container.appendChild(fileList);
    },

    /**
     * Render files in grid view
     */
    renderGridView() {
        const container = document.getElementById('fileListContainer');
        container.innerHTML = '';
        
        const fileGrid = document.createElement('div');
        fileGrid.className = 'file-grid';
        
        FileManagerState.files.forEach(file => {
            const fileItem = this.createGridFileItem(file);
            fileGrid.appendChild(fileItem);
        });
        
        container.appendChild(fileGrid);
    },

    /**
     * Create list view file item
     * @param {Object} file - File information
     * @returns {HTMLElement} - File item element
     */
    createListFileItem(file) {
        const item = document.createElement('div');
        item.className = 'file-item';
        if (FileManagerState.selectedFiles.has(file.name)) {
            item.classList.add('selected');
        }
        
        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'file-item-checkbox';
        checkbox.checked = FileManagerState.selectedFiles.has(file.name);
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            this.handleFileSelect(file.name, checkbox.checked);
        });
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Icon
        const icon = document.createElement('div');
        icon.className = `file-item-icon ${file.is_dir ? 'folder' : 'file'}`;
        icon.innerHTML = file.is_dir ? Icons.getFolderIcon() : Icons.getFileIcon(file.extension);
        
        // Name
        const name = document.createElement('div');
        name.className = 'file-item-name';
        name.textContent = file.name;
        
        // Size
        const size = document.createElement('div');
        size.className = 'file-item-size';
        size.textContent = file.is_dir ? '-' : FileUtils.formatFileSize(file.size);
        
        // Modified date
        const modified = document.createElement('div');
        modified.className = 'file-item-modified';
        modified.textContent = FileUtils.formatDate(file.mod_time);
        
        // Menu button
        const menuBtn = document.createElement('button');
        menuBtn.className = 'file-item-menu-btn';
        menuBtn.innerHTML = Icons.getMenuIcon();
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            ContextMenu.open(file, menuBtn);
        });
        
        // Actions container
        const actions = document.createElement('div');
        actions.className = 'file-item-actions';
        actions.appendChild(menuBtn);
        
        // Assemble item
        item.appendChild(checkbox);
        item.appendChild(icon);
        item.appendChild(name);
        item.appendChild(size);
        item.appendChild(modified);
        item.appendChild(actions);
        
        // Click to open folder or file
        item.addEventListener('click', (e) => {
            if (file.is_dir) {
                this.navigateToFolder(file.name);
            } else {
                const fileType = FileUtils.getFileType(file);
                if (fileType === 'editable') {
                    FileEditor.open(file);
                }
            }
        });
        
        return item;
    },

    /**
     * Create grid view file item
     * @param {Object} file - File information
     * @returns {HTMLElement} - File item element
     */
    createGridFileItem(file) {
        const item = document.createElement('div');
        item.className = 'file-grid-item';
        if (FileManagerState.selectedFiles.has(file.name)) {
            item.classList.add('selected');
        }
        
        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'file-grid-item-checkbox';
        checkbox.checked = FileManagerState.selectedFiles.has(file.name);
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            this.handleFileSelect(file.name, checkbox.checked);
        });
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Menu button
        const menuBtn = document.createElement('button');
        menuBtn.className = 'file-grid-item-menu-btn';
        menuBtn.innerHTML = Icons.getMenuIcon();
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            ContextMenu.open(file, menuBtn);
        });
        
        // Icon
        const icon = document.createElement('div');
        icon.className = `file-grid-item-icon ${file.is_dir ? 'folder' : 'file'}`;
        icon.innerHTML = file.is_dir ? Icons.getFolderIcon() : Icons.getFileIcon(file.extension);
        
        // Name
        const name = document.createElement('div');
        name.className = 'file-grid-item-name';
        name.textContent = file.name;
        name.title = file.name;
        
        // Size
        const size = document.createElement('div');
        size.className = 'file-grid-item-size';
        size.textContent = file.is_dir ? 'Folder' : FileUtils.formatFileSize(file.size);
        
        // Assemble item
        item.appendChild(checkbox);
        item.appendChild(menuBtn);
        item.appendChild(icon);
        item.appendChild(name);
        item.appendChild(size);
        
        // Click to open folder or file
        item.addEventListener('click', (e) => {
            if (file.is_dir) {
                this.navigateToFolder(file.name);
            } else {
                const fileType = FileUtils.getFileType(file);
                if (fileType === 'editable') {
                    FileEditor.open(file);
                }
            }
        });
        
        return item;
    },

    /**
     * Handle select all checkbox
     * @param {Event} e - Change event
     */
    handleSelectAll(e) {
        const checked = e.target.checked;
        
        if (checked) {
            FileManagerState.files.forEach(file => {
                FileManagerState.selectedFiles.add(file.name);
            });
        } else {
            FileManagerState.selectedFiles.clear();
        }
        
        this.renderFiles();
        this.updateFloatingActions();
    },

    /**
     * Handle individual file selection
     * @param {string} fileName - Name of the file
     * @param {boolean} selected - Whether file is selected
     */
    handleFileSelect(fileName, selected) {
        if (selected) {
            FileManagerState.selectedFiles.add(fileName);
        } else {
            FileManagerState.selectedFiles.delete(fileName);
        }
        
        this.updateSelectAllCheckbox();
        this.updateFloatingActions();
        
        // Update the item's selected class
        const items = document.querySelectorAll('.file-item, .file-grid-item');
        items.forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.checked === selected) {
                const nameEl = item.querySelector('.file-item-name, .file-grid-item-name');
                if (nameEl && nameEl.textContent === fileName) {
                    if (selected) {
                        item.classList.add('selected');
                    } else {
                        item.classList.remove('selected');
                    }
                }
            }
        });
    },

    /**
     * Update select all checkbox state
     */
    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (!selectAllCheckbox) return;
        
        const totalFiles = FileManagerState.files.length;
        const selectedCount = FileManagerState.selectedFiles.size;
        
        if (selectedCount === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedCount === totalFiles) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    },

    /**
     * Switch between list and grid view
     * @param {string} view - 'list' or 'grid'
     */
    switchView(view) {
        FileManagerState.currentView = view;
        localStorage.setItem('fileManagerView', view);
        
        this.updateViewToggle();
        this.renderFiles();
    },

    /**
     * Update view toggle buttons
     */
    updateViewToggle() {
        const listViewBtn = document.getElementById('listViewBtn');
        const gridViewBtn = document.getElementById('gridViewBtn');
        
        if (listViewBtn && gridViewBtn) {
            if (FileManagerState.currentView === 'list') {
                listViewBtn.classList.add('active');
                gridViewBtn.classList.remove('active');
            } else {
                listViewBtn.classList.remove('active');
                gridViewBtn.classList.add('active');
            }
        }
    },

    /**
     * Update breadcrumb navigation
     */
    updateBreadcrumb() {
        const breadcrumbPath = document.getElementById('breadcrumbPath');
        if (!breadcrumbPath) return;
        
        breadcrumbPath.innerHTML = '';
        
        const pathSegments = FileManagerState.currentPath.split('/').filter(s => s);
        
        pathSegments.forEach((segment, index) => {
            // Add separator
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = '/';
            breadcrumbPath.appendChild(separator);
            
            // Add segment
            const item = document.createElement('span');
            item.className = 'breadcrumb-item';
            item.textContent = segment;
            
            if (index < pathSegments.length - 1) {
                const segmentPath = '/' + pathSegments.slice(0, index + 1).join('/');
                item.addEventListener('click', () => this.navigateToPath(segmentPath));
            } else {
                item.classList.add('active');
            }
            
            breadcrumbPath.appendChild(item);
        });
    },

    /**
     * Update floating action buttons visibility
     */
    updateFloatingActions() {
        const floatingActions = document.getElementById('floatingActions');
        if (!floatingActions) return;
        
        if (FileManagerState.selectedFiles.size > 0) {
            floatingActions.classList.add('show');
        } else {
            floatingActions.classList.remove('show');
        }
    },

    /**
     * Copy files/folders to clipboard
     * @param {string} action - 'move' or 'duplicate'
     */
    copyToClipboard(action) {
        if (FileManagerState.selectedFiles.size === 0) {
            FileUtils.showError('No files selected');
            return;
        }

        // Get full file objects for selected files
        const selectedItems = FileManagerState.files.filter(file => 
            FileManagerState.selectedFiles.has(file.name)
        );

        FileManagerState.clipboard.action = action;
        FileManagerState.clipboard.items = selectedItems;
        FileManagerState.clipboard.sourcePath = FileManagerState.currentPath;

        // Show paste/cancel buttons
        this.showClipboardButtons();

        // Clear selection and hide floating actions
        FileManagerState.selectedFiles.clear();
        this.updateSelectAllCheckbox();
        this.updateFloatingActions();
        this.renderFiles();

        console.log(`${action} - ${selectedItems.length} item(s) copied to clipboard`);
    },

    /**
     * Show clipboard buttons (Paste & Cancel)
     */
    showClipboardButtons() {
        const clipboardButtons = document.getElementById('clipboardButtons');
        const pasteBtn = document.getElementById('pasteBtn');
        
        if (clipboardButtons && pasteBtn) {
            clipboardButtons.style.display = 'flex';
            
            // Update button text based on action
            const action = FileManagerState.clipboard.action;
            const count = FileManagerState.clipboard.items.length;
            pasteBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>Paste (${action === 'move' ? 'Move' : 'Duplicate'} ${count} item${count > 1 ? 's' : ''})</span>
            `;
        }
    },

    /**
     * Hide clipboard buttons
     */
    hideClipboardButtons() {
        const clipboardButtons = document.getElementById('clipboardButtons');
        if (clipboardButtons) {
            clipboardButtons.style.display = 'none';
        }
    },

    /**
     * Handle paste action
     */
    async handlePaste() {
        if (!FileManagerState.clipboard.action || FileManagerState.clipboard.items.length === 0) {
            FileUtils.showError('Nothing to paste');
            return;
        }

        const action = FileManagerState.clipboard.action;
        const items = FileManagerState.clipboard.items;
        const sourcePath = FileManagerState.clipboard.sourcePath;
        const targetPath = FileManagerState.currentPath;

        // Check if pasting in the same directory
        if (action === 'move' && sourcePath === targetPath) {
            FileUtils.showError('Cannot move files to the same directory');
            return;
        }

        // Prepare file names
        const fileNames = items.map(item => item.name);

        // Disable paste button
        const pasteBtn = document.getElementById('pasteBtn');
        if (pasteBtn) {
            pasteBtn.disabled = true;
            const originalHTML = pasteBtn.innerHTML;
            pasteBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"></circle>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"></path>
                </svg>
                <span>Processing...</span>
            `;

            try {
                const endpoint = action === 'move' ? 'move' : 'copy';
                const formData = new URLSearchParams();
                formData.append('source_path', sourcePath);
                formData.append('target_path', targetPath);
                formData.append('files', JSON.stringify(fileNames));

                const response = await fetch(
                    `/server/${FileManagerState.serverName}/files/${endpoint}`,
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
                    console.log(`${action} completed successfully`);
                    
                    // Re-enable button before clearing
                    pasteBtn.disabled = false;
                    
                    // Clear clipboard (this will hide the buttons)
                    this.clearClipboard();
                    
                    // Reload directory
                    this.loadDirectory(targetPath);
                } else {
                    FileUtils.showError(data.error || `Failed to ${action} files`);
                    pasteBtn.disabled = false;
                    pasteBtn.innerHTML = originalHTML;
                }
            } catch (error) {
                console.error(`Failed to ${action} files:`, error);
                FileUtils.showError(`Failed to ${action} files`);
                pasteBtn.disabled = false;
                pasteBtn.innerHTML = originalHTML;
            }
        }
    },

    /**
     * Clear clipboard and hide buttons
     */
    clearClipboard() {
        FileManagerState.clipboard.action = null;
        FileManagerState.clipboard.items = [];
        FileManagerState.clipboard.sourcePath = '';
        
        this.hideClipboardButtons();
        
        console.log('Clipboard cleared');
    },

    /**
     * Show loading state
     */
    showLoadingState() {
        const container = document.getElementById('fileListContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="file-list-loading">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"></circle>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"></path>
                </svg>
            </div>
        `;
    },

    /**
     * Show empty state
     */
    showEmptyState() {
        const container = document.getElementById('fileListContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="file-list-empty">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <div class="file-list-empty-title">This folder is empty</div>
                <div class="file-list-empty-description">Upload files or create new folders to get started</div>
            </div>
        `;
    }
};

// Export for global access
window.FileManagerCore = FileManagerCore;