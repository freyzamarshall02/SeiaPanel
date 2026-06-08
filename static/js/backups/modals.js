/* ========================================
   MODALS.JS - Backup Settings & Restore Modals
   ======================================== */

const BackupModals = {
    state: {
        isOpen: false,
        currentSettings: {
            backup_path: '',
            max_backups: 1
        },
        currentRestoreBackup: null
    },

    /**
     * Initialize modal
     */
    init() {
        this.initEventListeners();
        this.initSlider();
    },

    /**
     * Initialize event listeners
     */
    initEventListeners() {
        // Settings Modal
        const modal = document.getElementById('backupSettingsModal');
        const closeBtn = document.getElementById('closeBackupSettingsModal');
        const cancelBtn = document.getElementById('cancelBackupSettings');
        const form = document.getElementById('backupSettingsForm');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeSettingsModal());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeSettingsModal());
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeSettingsModal();
                }
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveSettings();
            });
        }

        // Restore Confirm Modal
        const restoreModal = document.getElementById('backupRestoreModal');
        const closeRestoreBtn = document.getElementById('closeBackupRestoreModal');
        const cancelRestoreBtn = document.getElementById('cancelBackupRestore');
        const confirmRestoreBtn = document.getElementById('confirmBackupRestore');

        if (closeRestoreBtn) {
            closeRestoreBtn.addEventListener('click', () => this.closeRestoreConfirmModal());
        }

        if (cancelRestoreBtn) {
            cancelRestoreBtn.addEventListener('click', () => this.closeRestoreConfirmModal());
        }

        if (restoreModal) {
            restoreModal.addEventListener('click', (e) => {
                if (e.target === restoreModal) {
                    this.closeRestoreConfirmModal();
                }
            });
        }

        if (confirmRestoreBtn) {
            confirmRestoreBtn.addEventListener('click', () => this.confirmRestore());
        }

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.state.isOpen) {
                    this.closeSettingsModal();
                }
                this.closeRestoreConfirmModal();
            }
        });
    },

    /**
     * Initialize slider
     */
    initSlider() {
        const slider = document.getElementById('maxBackupsSlider');
        const valueDisplay = document.getElementById('maxBackupsValue');

        if (slider && valueDisplay) {
            slider.addEventListener('input', (e) => {
                valueDisplay.textContent = e.target.value;
            });
        }
    },

    /**
     * Open settings modal
     */
    async openSettingsModal() {
        const modal = document.getElementById('backupSettingsModal');
        if (!modal) return;

        // Load current settings
        await this.loadCurrentSettings();

        // Populate form with current settings
        this.populateForm();

        // Show modal
        modal.classList.add('show');
        this.state.isOpen = true;

        // Focus on backup path input
        const backupPathInput = document.getElementById('backupPath');
        if (backupPathInput) {
            setTimeout(() => backupPathInput.focus(), 100);
        }
    },

    /**
     * Close settings modal
     */
    closeSettingsModal() {
        const modal = document.getElementById('backupSettingsModal');
        if (!modal) return;

        modal.classList.remove('show');
        this.state.isOpen = false;
    },

    /**
     * Load current settings from BackupManager
     */
    async loadCurrentSettings() {
        if (window.BackupManager) {
            await window.BackupManager.loadSettings();
            this.state.currentSettings = { ...window.BackupManager.state.settings };
        }
    },

    /**
     * Populate form with current settings
     */
    populateForm() {
        const backupPathInput = document.getElementById('backupPath');
        const maxBackupsSlider = document.getElementById('maxBackupsSlider');
        const maxBackupsValue = document.getElementById('maxBackupsValue');

        if (backupPathInput) {
            backupPathInput.value = this.state.currentSettings.backup_path || '';
        }

        if (maxBackupsSlider && maxBackupsValue) {
            const maxBackups = this.state.currentSettings.max_backups || 1;
            maxBackupsSlider.value = maxBackups;
            maxBackupsValue.textContent = maxBackups;
        }
    },

    /**
     * Save settings
     */
    async saveSettings() {
        const backupPathInput = document.getElementById('backupPath');
        const maxBackupsSlider = document.getElementById('maxBackupsSlider');
        const saveBtn = document.getElementById('saveBackupSettings');

        if (!backupPathInput || !maxBackupsSlider) return;

        const backupPath = backupPathInput.value.trim();
        const maxBackups = parseInt(maxBackupsSlider.value);

        // Validate
        if (!backupPath) {
            this.showError('Backup path is required');
            backupPathInput.focus();
            return;
        }

        if (maxBackups < 1 || maxBackups > 3) {
            this.showError('Max backups must be between 1 and 3');
            return;
        }

        // Disable save button
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }

        try {
            const formData = new URLSearchParams();
            formData.append('backup_path', backupPath);
            formData.append('max_backups', maxBackups);

            const response = await fetch(
                `/server/${window.BackupManager.state.serverName}/backups/settings`,
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
                console.log('Backup settings saved successfully');

                // Update BackupManager settings
                if (window.BackupManager) {
                    window.BackupManager.state.settings = data.data;
                }

                // Close modal
                this.closeSettingsModal();

                // Show success message
                this.showSuccess('Backup settings saved successfully');
            } else {
                this.showError(data.error || 'Failed to save settings');
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showError('Failed to save settings');
        } finally {
            // Re-enable save button
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';
            }
        }
    },

    /**
     * Open restore confirmation modal
     */
    openRestoreConfirmModal(backup) {
        const modal = document.getElementById('backupRestoreModal');
        const fileNameEl = document.getElementById('restoreBackupFileName');

        if (!modal) return;

        this.state.currentRestoreBackup = backup;

        if (fileNameEl) {
            fileNameEl.textContent = backup.name;
        }

        modal.classList.add('show');
    },

    /**
     * Close restore confirmation modal
     */
    closeRestoreConfirmModal() {
        const modal = document.getElementById('backupRestoreModal');
        if (!modal) return;

        modal.classList.remove('show');
        this.state.currentRestoreBackup = null;
    },

    /**
     * Confirm restore action
     */
    confirmRestore() {
        if (!this.state.currentRestoreBackup) return;

        const backup = this.state.currentRestoreBackup;

        // Close confirmation modal
        this.closeRestoreConfirmModal();

        // Trigger restore in BackupManager
        if (window.BackupManager) {
            window.BackupManager.restoreBackup(backup.id, backup.name);
        }
    },

    /**
     * Open restore progress modal
     */
    openRestoreProgressModal() {
        const modal = document.getElementById('backupRestoreProgressModal');
        if (!modal) return;

        modal.classList.add('show');
    },

    /**
     * Close restore progress modal
     */
    closeRestoreProgressModal() {
        const modal = document.getElementById('backupRestoreProgressModal');
        if (!modal) return;

        modal.classList.remove('show');
    },

    /**
     * Show restore completion notification
     */
    showRestoreNotification(title, message) {
        const notification = document.getElementById('backupNotification');
        const titleEl = document.getElementById('backupNotificationTitle');
        const messageEl = document.getElementById('backupNotificationMessage');

        if (!notification) return;

        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;

        notification.classList.add('show');

        // Auto-hide after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 5000);
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
        alert(message);
        console.log('Success: ' + message);
    }
};

// Export for global access
window.BackupModals = BackupModals;