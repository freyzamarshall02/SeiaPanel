/* ========================================
   CONTEXT-MENU.JS - Context Menu System
   ======================================== */

const ContextMenu = {
    state: {
        currentMenu: null,
        currentFile: null,
        backdrop: null
    },

    /**
     * Initialize context menu
     */
    init() {
        // Global click listener for closing menu
        setTimeout(() => {
            document.addEventListener('click', (e) => this.handleOutsideClick(e));
        }, 10);
    },

    /**
     * Open context menu
     */
    open(file, triggerElement) {
        this.close();
        
        const isMobile = window.innerWidth <= 640;
        
        // Create backdrop for mobile
        if (isMobile) {
            const backdrop = document.createElement('div');
            backdrop.className = 'context-menu-backdrop';
            backdrop.addEventListener('click', () => this.close());
            document.body.appendChild(backdrop);
            this.state.backdrop = backdrop;
            
            setTimeout(() => backdrop.classList.add('show'), 10);
        }
        
        // Create menu element
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = this.getMenuHTML(file);
        
        document.body.appendChild(menu);
        this.state.currentMenu = menu;
        this.state.currentFile = file;
        
        // Add event listeners to menu items
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = item.dataset.action;
                this.handleAction(action, file);
                this.close();
            });
        });
        
        // Position menu
        if (!isMobile) {
            this.positionMenu(menu, triggerElement);
        }
        
        // Show menu with animation
        setTimeout(() => menu.classList.add('show'), 10);
    },

    /**
     * Get context menu HTML based on file type
     */
    getMenuHTML(file) {
        const fileType = FileUtils.getFileType(file);
        const isArchive = FileUtils.isArchiveFile(file);
        let items = [];
        
        if (fileType === 'folder') {
            items = [
                { action: 'rename', label: 'Rename', icon: Icons.getPencilIcon() },
                { action: 'move', label: 'Move', icon: Icons.getArrowsIcon() },
                { action: 'duplicate', label: 'Duplicate', icon: Icons.getCopyIcon() },
                { divider: true },
                { action: 'archive', label: 'Archive', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="5"></rect><path d="M4 9v9a2 2 0 002 2h12a2 2 0 002-2V9"></path><path d="M10 13h4"></path></svg>' },
                { action: 'delete', label: 'Delete', icon: Icons.getTrashIcon(), danger: true }
            ];
        } else if (fileType === 'editable') {
            items = [
                { action: 'edit', label: 'Edit', icon: Icons.getEditIcon() },
                { action: 'rename', label: 'Rename', icon: Icons.getPencilIcon() },
                { action: 'move', label: 'Move', icon: Icons.getArrowsIcon() },
                { action: 'duplicate', label: 'Duplicate', icon: Icons.getCopyIcon() },
                { divider: true },
                isArchive 
                    ? { action: 'unarchive', label: 'Unarchive', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="5"></rect><path d="M4 9v9a2 2 0 002 2h12a2 2 0 002-2V9"></path><path d="M12 13v-4m0 0l-2 2m2-2l2 2"></path></svg>' }
                    : { action: 'archive', label: 'Archive', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="5"></rect><path d="M4 9v9a2 2 0 002 2h12a2 2 0 002-2V9"></path><path d="M10 13h4"></path></svg>' },
                { action: 'download', label: 'Download', icon: Icons.getDownloadIcon() },
                { action: 'delete', label: 'Delete', icon: Icons.getTrashIcon(), danger: true }
            ];
        } else if (fileType === 'archive') {
            items = [
                { action: 'rename', label: 'Rename', icon: Icons.getPencilIcon() },
                { action: 'move', label: 'Move', icon: Icons.getArrowsIcon() },
                { action: 'duplicate', label: 'Duplicate', icon: Icons.getCopyIcon() },
                { divider: true },
                { action: 'unarchive', label: 'Unarchive', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="5"></rect><path d="M4 9v9a2 2 0 002 2h12a2 2 0 002-2V9"></path><path d="M12 13v-4m0 0l-2 2m2-2l2 2"></path></svg>' },
                { action: 'download', label: 'Download', icon: Icons.getDownloadIcon() },
                { action: 'delete', label: 'Delete', icon: Icons.getTrashIcon(), danger: true }
            ];
        } else {
            items = [
                { action: 'rename', label: 'Rename', icon: Icons.getPencilIcon() },
                { action: 'move', label: 'Move', icon: Icons.getArrowsIcon() },
                { action: 'duplicate', label: 'Duplicate', icon: Icons.getCopyIcon() },
                { divider: true },
                { action: 'archive', label: 'Archive', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="5"></rect><path d="M4 9v9a2 2 0 002 2h12a2 2 0 002-2V9"></path><path d="M10 13h4"></path></svg>' },
                { action: 'download', label: 'Download', icon: Icons.getDownloadIcon() },
                { action: 'delete', label: 'Delete', icon: Icons.getTrashIcon(), danger: true }
            ];
        }
        
        return items.map(item => {
            if (item.divider) {
                return '<div class="context-menu-divider"></div>';
            }
            return `
                <div class="context-menu-item ${item.danger ? 'danger' : ''}" data-action="${item.action}">
                    ${item.icon}
                    <span>${item.label}</span>
                </div>
            `;
        }).join('');
    },

    /**
     * Position context menu with smart positioning
     */
    positionMenu(menu, triggerElement) {
        const triggerRect = triggerElement.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let top, left;
        
        top = triggerRect.bottom + 4;
        left = triggerRect.left;
        
        if (left + menuRect.width > viewportWidth - 20) {
            left = triggerRect.right - menuRect.width;
        }
        
        if (top + menuRect.height > viewportHeight - 20) {
            top = triggerRect.top - menuRect.height - 4;
        }
        
        if (left < 20) {
            left = 20;
        }
        
        if (top < 20) {
            top = 20;
        }
        
        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
    },

    /**
     * Close context menu
     */
    close() {
        if (this.state.currentMenu) {
            this.state.currentMenu.classList.remove('show');
            setTimeout(() => {
                if (this.state.currentMenu) {
                    this.state.currentMenu.remove();
                    this.state.currentMenu = null;
                }
            }, 150);
        }
        
        if (this.state.backdrop) {
            this.state.backdrop.classList.remove('show');
            setTimeout(() => {
                if (this.state.backdrop) {
                    this.state.backdrop.remove();
                    this.state.backdrop = null;
                }
            }, 150);
        }
        
        this.state.currentFile = null;
    },

    /**
     * Handle outside click to close menu
     */
    handleOutsideClick(e) {
        if (this.state.currentMenu && !this.state.currentMenu.contains(e.target)) {
            this.close();
        }
    },

    /**
     * Handle context menu action
     */
    handleAction(action, file) {
        console.log(`Action: ${action}, File: ${file.name}`);
        
        switch (action) {
            case 'edit':
                FileEditor.open(file);
                break;
            case 'rename':
                Modals.openRename(file);
                break;
            case 'move':
                this.handleMove(file);
                break;
            case 'duplicate':
                this.handleDuplicate(file);
                break;
            case 'archive':
                this.handleArchive(file);
                break;
            case 'unarchive':
                this.handleUnarchive(file);
                break;
            case 'download':
                this.handleDownload(file);
                break;
            case 'delete':
                this.handleDelete(file);
                break;
        }
    },

    /**
     * Handle move action from context menu
     */
    handleMove(file) {
        // Select the file if not already selected
        if (!FileManagerState.selectedFiles.has(file.name)) {
            FileManagerState.selectedFiles.clear();
            FileManagerState.selectedFiles.add(file.name);
            FileManagerCore.updateSelectAllCheckbox();
            FileManagerCore.renderFiles();
        }
        
        // Copy to clipboard with 'move' action
        FileManagerCore.copyToClipboard('move');
    },

    /**
     * Handle duplicate action from context menu
     */
    handleDuplicate(file) {
        // Select the file if not already selected
        if (!FileManagerState.selectedFiles.has(file.name)) {
            FileManagerState.selectedFiles.clear();
            FileManagerState.selectedFiles.add(file.name);
            FileManagerCore.updateSelectAllCheckbox();
            FileManagerCore.renderFiles();
        }
        
        // Copy to clipboard with 'duplicate' action
        FileManagerCore.copyToClipboard('duplicate');
    },

    /**
     * Handle archive action from context menu
     */
    handleArchive(file) {
        // Select the file if not already selected
        if (!FileManagerState.selectedFiles.has(file.name)) {
            FileManagerState.selectedFiles.clear();
            FileManagerState.selectedFiles.add(file.name);
            FileManagerCore.updateSelectAllCheckbox();
            FileManagerCore.renderFiles();
        }
        
        // Trigger archive via floating button handler
        // This ensures consistent behavior between context menu and floating button
        if (window.Modals && window.Modals.handleFloatingArchive) {
            window.Modals.handleFloatingArchive();
        }
    },

    /**
     * Handle unarchive action from context menu
     */
    async handleUnarchive(file) {
        try {
            const formData = new URLSearchParams();
            formData.append('path', FileManagerState.currentPath);
            formData.append('file', file.name);

            const response = await fetch(
                `/server/${FileManagerState.serverName}/files/unarchive`,
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
                console.log('Archive extracted successfully');
                
                // Reload directory to show extracted files
                FileManagerCore.loadDirectory(FileManagerState.currentPath);
            } else {
                FileUtils.showError(data.error || 'Failed to extract archive');
            }
        } catch (error) {
            console.error('Failed to extract archive:', error);
            FileUtils.showError('Failed to extract archive');
        }
    },

    /**
     * Handle download action from context menu
     */
    handleDownload(file) {
        // Don't allow downloading directories
        if (file.is_dir) {
            FileUtils.showError('Cannot download folders. Please archive them first.');
            return;
        }

        // Build download URL
        const downloadUrl = `/server/${FileManagerState.serverName}/files/download?` +
            `path=${encodeURIComponent(FileManagerState.currentPath)}&` +
            `file=${encodeURIComponent(file.name)}`;

        // Trigger download by opening URL in new window
        window.open(downloadUrl, '_blank');
        
        console.log(`Downloading: ${file.name}`);
    },

    /**
     * Handle delete action from context menu
     */
    handleDelete(file) {
        // Select the file if not already selected
        if (!FileManagerState.selectedFiles.has(file.name)) {
            FileManagerState.selectedFiles.clear();
            FileManagerState.selectedFiles.add(file.name);
            FileManagerCore.updateSelectAllCheckbox();
            FileManagerCore.renderFiles();
        }
        
        // Trigger delete via floating button handler
        // This ensures consistent behavior between context menu and floating button
        if (window.Modals && window.Modals.handleFloatingDelete) {
            window.Modals.handleFloatingDelete();
        }
    }
};

// Export for global access
window.ContextMenu = ContextMenu;