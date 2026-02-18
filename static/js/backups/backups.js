/* ========================================
   BACKUPS.JS - Backup Management
   ======================================== */

const BackupManager = {
    state: {
        serverName: '',
        backups: [],
        settings: {
            backup_path: '',
            max_backups: 1
        },
        isLoading: false,
        isCreatingBackup: false,
        isRestoring: false
    },

    /**
     * Initialize backup manager
     */
    init(serverName) {
        this.state.serverName = serverName;
        
        // Load settings and backups
        this.loadSettings();
        this.loadBackups();
        
        // Initialize event listeners
        this.initEventListeners();
    },

    /**
     * Initialize event listeners
     */
    initEventListeners() {
        const createBackupBtn = document.getElementById('createBackupBtn');
        const settingsBtn = document.getElementById('backupSettingsBtn');

        if (createBackupBtn) {
            createBackupBtn.addEventListener('click', () => this.createBackup());
        }

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                if (window.BackupModals) {
                    window.BackupModals.openSettingsModal();
                }
            });
        }
    },

    /**
     * Load backup settings from server
     */
    async loadSettings() {
        try {
            const response = await fetch(`/server/${this.state.serverName}/backups/settings`);
            const data = await response.json();

            if (data.success) {
                this.state.settings = data.data;
            }
        } catch (error) {
            console.error('Failed to load backup settings:', error);
        }
    },

    /**
     * Load backup list from server
     */
    async loadBackups() {
        this.state.isLoading = true;
        this.showLoadingState();

        try {
            const response = await fetch(`/server/${this.state.serverName}/backups/list`);
            const data = await response.json();

            if (data.success) {
                this.state.backups = data.backups || [];
                this.renderBackups();
            } else {
                this.showError('Failed to load backups');
            }
        } catch (error) {
            console.error('Failed to load backups:', error);
            this.showError('Failed to load backups');
        } finally {
            this.state.isLoading = false;
        }
    },

    /**
     * Create a new backup
     */
    async createBackup() {
        // Check if backup path is set
        if (!this.state.settings.backup_path || this.state.settings.backup_path === '') {
            this.showError('Please configure backup path in Settings first');
            return;
        }

        // Prevent multiple simultaneous backup creations
        if (this.state.isCreatingBackup) {
            return;
        }

        const createBtn = document.getElementById('createBackupBtn');
        if (createBtn) {
            createBtn.disabled = true;
            createBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"></circle>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"></path>
                </svg>
                Creating Backup...
            `;
        }

        this.state.isCreatingBackup = true;

        // Add a loading backup item to the list
        this.addLoadingBackup();

        try {
            const response = await fetch(`/server/${this.state.serverName}/backups/create`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                console.log('Backup created successfully');
                
                // Reload backup list
                await this.loadBackups();
                
                this.showSuccess('Backup created successfully');
            } else {
                this.showError(data.error || 'Failed to create backup');
                this.removeLoadingBackup();
            }
        } catch (error) {
            console.error('Failed to create backup:', error);
            this.showError('Failed to create backup');
            this.removeLoadingBackup();
        } finally {
            this.state.isCreatingBackup = false;
            
            if (createBtn) {
                createBtn.disabled = false;
                createBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    CREATE BACKUP
                `;
            }
        }
    },

    /**
     * Restore from backup
     */
    async restoreBackup(backupId, backupName) {
        if (this.state.isRestoring) {
            return;
        }

        this.state.isRestoring = true;

        // Show progress modal
        if (window.BackupModals) {
            window.BackupModals.openRestoreProgressModal();
        }

        try {
            const response = await fetch(`/server/${this.state.serverName}/backups/restore/${backupId}`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                console.log('Restore completed successfully');
                
                // Close progress modal
                if (window.BackupModals) {
                    window.BackupModals.closeRestoreProgressModal();
                }
                
                // Show success notification
                if (window.BackupModals) {
                    window.BackupModals.showRestoreNotification(
                        'Restore Completed!',
                        `Server restored successfully from backup: ${backupName}`
                    );
                }
            } else {
                // Close progress modal
                if (window.BackupModals) {
                    window.BackupModals.closeRestoreProgressModal();
                }
                
                this.showError(data.error || 'Failed to restore backup');
            }
        } catch (error) {
            console.error('Failed to restore backup:', error);
            
            // Close progress modal
            if (window.BackupModals) {
                window.BackupModals.closeRestoreProgressModal();
            }
            
            this.showError('Failed to restore backup');
        } finally {
            this.state.isRestoring = false;
        }
    },

    /**
     * Delete a backup
     */
    async deleteBackup(backupId, backupName) {
        if (!confirm(`Are you sure you want to delete backup "${backupName}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/server/${this.state.serverName}/backups/${backupId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                console.log('Backup deleted successfully');
                
                // Reload backup list
                await this.loadBackups();
                
                this.showSuccess('Backup deleted successfully');
            } else {
                this.showError(data.error || 'Failed to delete backup');
            }
        } catch (error) {
            console.error('Failed to delete backup:', error);
            this.showError('Failed to delete backup');
        }
    },

    /**
     * Download a backup
     */
    downloadBackup(backupId, backupName) {
        const downloadUrl = `/server/${this.state.serverName}/backups/download/${backupId}`;
        
        // Trigger download by opening URL in new window
        window.open(downloadUrl, '_blank');
        
        console.log(`Downloading backup: ${backupName}`);
    },

    /**
     * Render backup list
     */
    renderBackups() {
        const container = document.getElementById('backupListContainer');
        if (!container) return;

        if (this.state.backups.length === 0) {
            this.showEmptyState();
            return;
        }

        container.innerHTML = '';

        this.state.backups.forEach(backup => {
            const backupItem = this.createBackupItem(backup);
            container.appendChild(backupItem);
        });
    },

    /**
     * Create a backup list item
     */
    createBackupItem(backup) {
        const item = document.createElement('div');
        item.className = 'backup-item';
        item.innerHTML = `
            <div class="backup-item-info">
                <div class="backup-item-name">${backup.file_name}</div>
                <div class="backup-item-meta">
                    <span class="backup-item-size">${backup.size_display}</span>
                    <span class="backup-item-date">${backup.created_at}</span>
                </div>
            </div>
            <div class="backup-item-actions">
                <button class="backup-action-btn backup-action-restore" data-backup-id="${backup.id}" data-backup-name="${backup.file_name}" title="Restore">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                </button>
                <button class="backup-action-btn backup-action-download" data-backup-id="${backup.id}" data-backup-name="${backup.file_name}" title="Download">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                </button>
                <button class="backup-action-btn backup-action-delete" data-backup-id="${backup.id}" data-backup-name="${backup.file_name}" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;

        // Add event listeners
        const restoreBtn = item.querySelector('.backup-action-restore');
        const downloadBtn = item.querySelector('.backup-action-download');
        const deleteBtn = item.querySelector('.backup-action-delete');

        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => {
                if (window.BackupModals) {
                    window.BackupModals.openRestoreConfirmModal({
                        id: backup.id,
                        name: backup.file_name
                    });
                }
            });
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadBackup(backup.id, backup.file_name);
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.deleteBackup(backup.id, backup.file_name);
            });
        }

        return item;
    },

    /**
     * Add a loading backup item to the list
     */
    addLoadingBackup() {
        const container = document.getElementById('backupListContainer');
        if (!container) return;

        // Remove empty state if present
        const emptyState = container.querySelector('.backup-list-empty');
        if (emptyState) {
            emptyState.remove();
        }

        const loadingItem = document.createElement('div');
        loadingItem.className = 'backup-item backup-item-loading';
        loadingItem.id = 'loadingBackupItem';
        loadingItem.innerHTML = `
            <div class="backup-item-info">
                <div class="backup-item-name">Creating backup...</div>
                <div class="backup-item-meta">
                    <span class="backup-item-size">Please wait</span>
                </div>
            </div>
            <div class="backup-item-actions">
                <div class="backup-loading-spinner">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"></circle>
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"></path>
                    </svg>
                </div>
            </div>
        `;

        // Add to the top of the list
        container.insertBefore(loadingItem, container.firstChild);
    },

    /**
     * Remove the loading backup item
     */
    removeLoadingBackup() {
        const loadingItem = document.getElementById('loadingBackupItem');
        if (loadingItem) {
            loadingItem.remove();
        }
    },

    /**
     * Show loading state
     */
    showLoadingState() {
        const container = document.getElementById('backupListContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="backup-list-loading">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"></circle>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"></path>
                </svg>
                <p>Loading backups...</p>
            </div>
        `;
    },

    /**
     * Show empty state
     */
    showEmptyState() {
        const container = document.getElementById('backupListContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="backup-list-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <div class="backup-list-empty-title">No Backups Yet</div>
                <div class="backup-list-empty-description">Create your first backup to get started</div>
            </div>
        `;
    },

    /**
     * Show error message
     */
    showError(message) {
        // You can implement a toast/notification system here
        alert('Error: ' + message);
        console.error(message);
    },

    /**
     * Show success message
     */
    showSuccess(message) {
        // You can implement a toast/notification system here
        console.log('Success: ' + message);
    }
};

// Export for global access
window.BackupManager = BackupManager;