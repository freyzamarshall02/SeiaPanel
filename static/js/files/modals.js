/* ========================================
   MODALS.JS - Modal Dialogs
   ======================================== */

const Modals = {
    /**
     * Initialize modals
     */
    init() {
        this.initCreateDirModal();
        this.initNewFileModal();
        this.initRenameModal();
        this.initFloatingButtons();
    },

    /**
     * Initialize create directory modal
     */
    initCreateDirModal() {
        const createDirBtn = document.getElementById('createDirBtn');
        if (createDirBtn) {
            createDirBtn.addEventListener('click', () => this.openCreateDir());
        }

        const closeBtn = document.getElementById('closeCreateDirModal');
        const cancelBtn = document.getElementById('cancelCreateDir');
        const modal = document.getElementById('createDirModal');
        const form = document.getElementById('createDirForm');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeCreateDir());
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeCreateDir());
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeCreateDir();
                }
            });
        }
        
        if (form) {
            form.addEventListener('submit', (e) => this.handleCreateDirectory(e));
        }
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeCreateDir();
                this.closeNewFile();
                this.closeRename();
            }
        });
    },

    /**
     * Initialize new file modal
     */
    initNewFileModal() {
        const newFileBtn = document.getElementById('newFileBtn');
        if (newFileBtn) {
            newFileBtn.addEventListener('click', () => this.openNewFile());
        }

        const closeBtn = document.getElementById('closeNewFileModal');
        const cancelBtn = document.getElementById('cancelNewFile');
        const modal = document.getElementById('newFileModal');
        const form = document.getElementById('newFileForm');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeNewFile());
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeNewFile());
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeNewFile();
                }
            });
        }
        
        if (form) {
            form.addEventListener('submit', (e) => this.handleCreateNewFile(e));
        }
    },

    /**
     * Initialize rename modal
     */
    initRenameModal() {
        const closeBtn = document.getElementById('closeRenameModal');
        const cancelBtn = document.getElementById('cancelRename');
        const modal = document.getElementById('renameModal');
        const form = document.getElementById('renameForm');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeRename());
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeRename());
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeRename();
                }
            });
        }
        
        if (form) {
            form.addEventListener('submit', (e) => this.handleRename(e));
        }
    },

    /**
     * Initialize floating action buttons
     */
    initFloatingButtons() {
        const moveBtn = document.getElementById('moveBtn');
        const duplicateBtn = document.getElementById('duplicateBtn');
        const archiveBtn = document.getElementById('archiveBtn');
        const deleteBtn = document.getElementById('deleteBtn');

        if (moveBtn) {
            moveBtn.addEventListener('click', () => this.handleFloatingMove());
        }

        if (duplicateBtn) {
            duplicateBtn.addEventListener('click', () => this.handleFloatingDuplicate());
        }

        if (archiveBtn) {
            archiveBtn.addEventListener('click', () => this.handleFloatingArchive());
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.handleFloatingDelete());
        }
    },

    /**
     * Handle move from floating button
     */
    handleFloatingMove() {
        if (FileManagerState.selectedFiles.size === 0) {
            FileUtils.showError('No files selected');
            return;
        }

        FileManagerCore.copyToClipboard('move');
    },

    /**
     * Handle duplicate from floating button
     */
    handleFloatingDuplicate() {
        if (FileManagerState.selectedFiles.size === 0) {
            FileUtils.showError('No files selected');
            return;
        }

        FileManagerCore.copyToClipboard('duplicate');
    },

    /**
     * Handle archive from floating button
     */
    async handleFloatingArchive() {
        if (FileManagerState.selectedFiles.size === 0) {
            FileUtils.showError('No files selected');
            return;
        }

        // Get selected file names
        const selectedFiles = Array.from(FileManagerState.selectedFiles);
        
        console.log('=== ARCHIVE DEBUG ===');
        console.log('Selected files:', selectedFiles);
        console.log('Current path:', FileManagerState.currentPath);
        console.log('====================');

        try {
            const formData = new URLSearchParams();
            formData.append('path', FileManagerState.currentPath);
            formData.append('files', JSON.stringify(selectedFiles));
            
            console.log('Sending request with body:', formData.toString());

            const response = await fetch(
                `/server/${FileManagerState.serverName}/files/archive`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData
                }
            );

            const data = await response.json();
            
            console.log('Response:', data);

            if (data.success) {
                console.log(`Archive created: ${data.archive}`);
                
                // Clear selection
                FileManagerState.selectedFiles.clear();
                FileManagerCore.updateSelectAllCheckbox();
                FileManagerCore.updateFloatingActions();
                
                // Reload directory to show new archive
                FileManagerCore.loadDirectory(FileManagerState.currentPath);
            } else {
                FileUtils.showError(data.error || 'Failed to create archive');
            }
        } catch (error) {
            console.error('Failed to create archive:', error);
            FileUtils.showError('Failed to create archive');
        }
    },

    /**
     * Handle delete from floating button
     */
    async handleFloatingDelete() {
        if (FileManagerState.selectedFiles.size === 0) {
            FileUtils.showError('No files selected');
            return;
        }

        // Get selected file names
        const selectedFiles = Array.from(FileManagerState.selectedFiles);

        try {
            const formData = new URLSearchParams();
            formData.append('path', FileManagerState.currentPath);
            formData.append('files', JSON.stringify(selectedFiles));

            const response = await fetch(
                `/server/${FileManagerState.serverName}/files/delete`,
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
                console.log(`Deleted ${data.count} item(s)`);
                
                // Clear selection
                FileManagerState.selectedFiles.clear();
                FileManagerCore.updateSelectAllCheckbox();
                FileManagerCore.updateFloatingActions();
                
                // Reload directory
                FileManagerCore.loadDirectory(FileManagerState.currentPath);
            } else {
                FileUtils.showError(data.error || 'Failed to delete files');
            }
        } catch (error) {
            console.error('Failed to delete files:', error);
            FileUtils.showError('Failed to delete files');
        }
    },

    /**
     * Open Create Directory modal
     */
    openCreateDir() {
        const modal = document.getElementById('createDirModal');
        const input = document.getElementById('directoryName');
        
        if (modal && input) {
            modal.classList.add('show');
            input.value = '';
            input.focus();
            
            this.initDirAutocomplete();
        }
    },

    /**
     * Close Create Directory modal
     */
    closeCreateDir() {
        const modal = document.getElementById('createDirModal');
        const autocomplete = document.getElementById('dirAutocomplete');
        
        if (modal) {
            modal.classList.remove('show');
        }
        
        if (autocomplete) {
            autocomplete.classList.remove('show');
            autocomplete.innerHTML = '';
        }
    },

    /**
     * Initialize directory name autocomplete
     */
    initDirAutocomplete() {
        const input = document.getElementById('directoryName');
        const dropdown = document.getElementById('dirAutocomplete');
        
        if (!input || !dropdown) return;
        
        input.addEventListener('input', function() {
            const value = this.value.toLowerCase().trim();
            
            if (value === '') {
                dropdown.classList.remove('show');
                return;
            }
            
            const suggestions = FileManagerState.files
                .filter(file => file.name.toLowerCase().includes(value))
                .slice(0, 5);
            
            if (suggestions.length > 0) {
                dropdown.innerHTML = '';
                suggestions.forEach(file => {
                    const item = document.createElement('div');
                    item.className = 'autocomplete-item';
                    item.innerHTML = `
                        ${file.is_dir ? Icons.getFolderIcon() : Icons.getFileIcon(file.extension)}
                        <span>${file.name}</span>
                    `;
                    item.addEventListener('click', () => {
                        input.value = file.name;
                        dropdown.classList.remove('show');
                    });
                    dropdown.appendChild(item);
                });
                dropdown.classList.add('show');
            } else {
                dropdown.classList.remove('show');
            }
        });
        
        document.addEventListener('click', function(e) {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    },

    /**
     * Handle Create Directory form submission
     */
    async handleCreateDirectory(e) {
        e.preventDefault();
        
        const input = document.getElementById('directoryName');
        const submitBtn = document.getElementById('submitCreateDir');
        
        if (!input || !submitBtn) return;
        
        const directoryName = input.value.trim();
        
        if (!directoryName) {
            FileUtils.showError('Directory name cannot be empty');
            return;
        }
        
        const validName = /^[a-zA-Z0-9-_]+$/;
        if (!validName.test(directoryName)) {
            FileUtils.showError('Directory name can only contain letters, numbers, hyphens, and underscores');
            return;
        }
        
        const exists = FileManagerState.files.some(
            file => file.name.toLowerCase() === directoryName.toLowerCase()
        );
        
        if (exists) {
            FileUtils.showError('A file or folder with this name already exists');
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
        
        try {
            const response = await fetch(
                `/server/${FileManagerState.serverName}/files/create-directory`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `path=${encodeURIComponent(FileManagerState.currentPath)}&name=${encodeURIComponent(directoryName)}`
                }
            );
            
            const data = await response.json();
            
            if (data.success) {
                this.closeCreateDir();
                FileManagerCore.loadDirectory(FileManagerState.currentPath);
                console.log('Directory created successfully');
            } else {
                FileUtils.showError(data.error || 'Failed to create directory');
            }
            
        } catch (error) {
            console.error('Failed to create directory:', error);
            FileUtils.showError('Failed to create directory');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create';
        }
    },

    /**
     * Open New File modal
     */
    openNewFile() {
        const modal = document.getElementById('newFileModal');
        const input = document.getElementById('fileName');
        
        if (modal && input) {
            modal.classList.add('show');
            input.value = '';
            input.focus();
            
            this.initFileAutocomplete();
        }
    },

    /**
     * Close New File modal
     */
    closeNewFile() {
        const modal = document.getElementById('newFileModal');
        const autocomplete = document.getElementById('fileAutocomplete');
        
        if (modal) {
            modal.classList.remove('show');
        }
        
        if (autocomplete) {
            autocomplete.classList.remove('show');
            autocomplete.innerHTML = '';
        }
    },

    /**
     * Initialize file name autocomplete
     */
    initFileAutocomplete() {
        const input = document.getElementById('fileName');
        const dropdown = document.getElementById('fileAutocomplete');
        
        if (!input || !dropdown) return;
        
        input.addEventListener('input', function() {
            const value = this.value.toLowerCase().trim();
            
            if (value === '') {
                dropdown.classList.remove('show');
                return;
            }
            
            const suggestions = FileManagerState.files
                .filter(file => !file.is_dir && file.name.toLowerCase().includes(value))
                .slice(0, 5);
            
            if (suggestions.length > 0) {
                dropdown.innerHTML = '';
                suggestions.forEach(file => {
                    const item = document.createElement('div');
                    item.className = 'autocomplete-item';
                    item.innerHTML = `
                        ${Icons.getFileIcon(file.extension)}
                        <span>${file.name}</span>
                    `;
                    item.addEventListener('click', () => {
                        input.value = file.name;
                        dropdown.classList.remove('show');
                    });
                    dropdown.appendChild(item);
                });
                dropdown.classList.add('show');
            } else {
                dropdown.classList.remove('show');
            }
        });
        
        document.addEventListener('click', function(e) {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    },

    /**
     * Handle New File form submission
     */
    async handleCreateNewFile(e) {
        e.preventDefault();
        
        const input = document.getElementById('fileName');
        const submitBtn = document.getElementById('submitNewFile');
        
        if (!input || !submitBtn) return;
        
        const fileName = input.value.trim();
        
        if (!fileName) {
            FileUtils.showError('File name cannot be empty');
            return;
        }
        
        if (!fileName.includes('.')) {
            FileUtils.showError('File name must include an extension (e.g., .txt, .yml, .json)');
            return;
        }
        
        const validName = /^[a-zA-Z0-9-_.]+$/;
        if (!validName.test(fileName)) {
            FileUtils.showError('File name can only contain letters, numbers, hyphens, underscores, and dots');
            return;
        }
        
        const exists = FileManagerState.files.some(
            file => file.name.toLowerCase() === fileName.toLowerCase()
        );
        
        if (exists) {
            FileUtils.showError('A file or folder with this name already exists');
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
        
        try {
            const response = await fetch(
                `/server/${FileManagerState.serverName}/files/create-file`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `path=${encodeURIComponent(FileManagerState.currentPath)}&name=${encodeURIComponent(fileName)}`
                }
            );
            
            const data = await response.json();
            
            if (data.success) {
                this.closeNewFile();
                FileManagerCore.loadDirectory(FileManagerState.currentPath);
                console.log('File created successfully');
            } else {
                FileUtils.showError(data.error || 'Failed to create file');
            }
            
        } catch (error) {
            console.error('Failed to create file:', error);
            FileUtils.showError('Failed to create file');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create';
        }
    },

    /**
     * Open Rename modal
     */
    openRename(file) {
        const modal = document.getElementById('renameModal');
        const input = document.getElementById('renameInput');
        const oldNameEl = document.getElementById('renameOldName');
        
        if (modal && input && oldNameEl) {
            // Store the current file being renamed
            this.currentRenameFile = file;
            
            // Set the old name display
            oldNameEl.textContent = file.name;
            
            // Prefill the input with current name
            input.value = file.name;
            
            // Show modal
            modal.classList.add('show');
            
            // Focus and select the filename (without extension for files)
            setTimeout(() => {
                input.focus();
                if (!file.is_dir && file.name.includes('.')) {
                    const dotIndex = file.name.lastIndexOf('.');
                    input.setSelectionRange(0, dotIndex);
                } else {
                    input.select();
                }
            }, 100);
        }
    },

    /**
     * Close Rename modal
     */
    closeRename() {
        const modal = document.getElementById('renameModal');
        const input = document.getElementById('renameInput');
        
        if (modal) {
            modal.classList.remove('show');
        }
        
        if (input) {
            input.value = '';
        }
        
        this.currentRenameFile = null;
    },

    /**
     * Handle Rename form submission
     */
    async handleRename(e) {
        e.preventDefault();
        
        const input = document.getElementById('renameInput');
        const submitBtn = document.getElementById('submitRename');
        
        if (!input || !submitBtn || !this.currentRenameFile) return;
        
        const newName = input.value.trim();
        const oldName = this.currentRenameFile.name;
        
        if (!newName) {
            FileUtils.showError('Name cannot be empty');
            return;
        }
        
        if (newName === oldName) {
            FileUtils.showError('New name is the same as the current name');
            return;
        }
        
        // Validate name
        const validName = /^[a-zA-Z0-9-_.]+$/;
        if (!validName.test(newName)) {
            FileUtils.showError('Name can only contain letters, numbers, hyphens, underscores, and dots');
            return;
        }
        
        // Check if new name already exists
        const exists = FileManagerState.files.some(
            file => file.name.toLowerCase() === newName.toLowerCase() && file.name !== oldName
        );
        
        if (exists) {
            FileUtils.showError('A file or folder with this name already exists');
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Renaming...';
        
        try {
            const formData = new URLSearchParams();
            formData.append('path', FileManagerState.currentPath);
            formData.append('old_name', oldName);
            formData.append('new_name', newName);

            const response = await fetch(
                `/server/${FileManagerState.serverName}/files/rename`,
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
                this.closeRename();
                FileManagerCore.loadDirectory(FileManagerState.currentPath);
                console.log('File renamed successfully');
            } else {
                FileUtils.showError(data.error || 'Failed to rename');
            }
            
        } catch (error) {
            console.error('Failed to rename:', error);
            FileUtils.showError('Failed to rename file');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Rename';
        }
    }
};

// Export for global access
window.Modals = Modals;