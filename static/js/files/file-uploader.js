/* ========================================
   FILE-UPLOADER.JS - Upload Manager
   ======================================== */

const FileUploader = {
    /**
     * Initialize file uploader
     */
    init() {
        this.initDragAndDrop();
        this.initFileInput();
        this.initUploadPanel();
    },

    /**
     * Initialize drag and drop
     */
    initDragAndDrop() {
        const overlay = document.getElementById('dragDropOverlay');
        let dragCounter = 0;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.body.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        document.body.addEventListener('dragenter', (e) => {
            dragCounter++;
            if (e.dataTransfer.types.includes('Files')) {
                overlay.classList.add('show');
            }
        });

        document.body.addEventListener('dragleave', (e) => {
            dragCounter--;
            if (dragCounter === 0) {
                overlay.classList.remove('show');
            }
        });

        document.body.addEventListener('drop', (e) => {
            dragCounter = 0;
            overlay.classList.remove('show');
            
            const files = Array.from(e.dataTransfer.files);
            this.handleFilesDrop(files);
        });

        overlay.addEventListener('dragover', (e) => {
            e.dataTransfer.dropEffect = 'copy';
        });
    },

    /**
     * Initialize file input
     */
    initFileInput() {
        const uploadBtn = document.getElementById('uploadBtn');
        const fileInput = document.getElementById('fileInput');
        
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => this.handleFileInputChange(e));
        }

        const uploadIndicator = document.getElementById('uploadIndicator');
        if (uploadIndicator) {
            uploadIndicator.addEventListener('click', () => this.toggleUploadPanel());
        }
    },

    /**
     * Initialize upload panel
     */
    initUploadPanel() {
        const closeUploadPanelX = document.getElementById('closeUploadPanel');
        const closeUploadPanelBtn = document.getElementById('closeUploadPanelBtn');
        const cancelAllBtn = document.getElementById('cancelAllUploads');

        if (closeUploadPanelX) {
            closeUploadPanelX.addEventListener('click', () => this.hideUploadPanel());
        }

        if (closeUploadPanelBtn) {
            closeUploadPanelBtn.addEventListener('click', () => this.hideUploadPanel());
        }

        if (cancelAllBtn) {
            cancelAllBtn.addEventListener('click', () => this.cancelAllUploads());
        }
    },

    /**
     * Handle file input change
     */
    handleFileInputChange(e) {
        const files = Array.from(e.target.files);
        this.handleFilesDrop(files);
        e.target.value = '';
    },

    /**
     * Handle files dropped or selected
     */
    handleFilesDrop(files) {
        if (files.length === 0) return;

        const validFiles = files.filter(file => file.size > 0 || file.type !== '');

        if (validFiles.length === 0) {
            FileUtils.showError('Folder upload is not allowed');
            return;
        }

        if (validFiles.length < files.length) {
            FileUtils.showError('Some items were skipped (folders are not allowed)');
        }

        validFiles.forEach(file => this.addUploadToQueue(file));
        this.processUploadQueue();
    },

    /**
     * Add file to upload queue
     */
    addUploadToQueue(file) {
        const uploadId = UploadManager.nextId++;
        
        const uploadItem = {
            id: uploadId,
            file: file,
            status: 'queued',
            progress: 0,
            abortController: new AbortController(),
            error: null
        };

        UploadManager.uploads.set(uploadId, uploadItem);
        this.renderUploadItem(uploadItem);
        this.updateUploadIndicator();
        this.showUploadPanel();
    },

    /**
     * Process upload queue
     */
    async processUploadQueue() {
        const queuedUploads = Array.from(UploadManager.uploads.values())
            .filter(upload => upload.status === 'queued');

        for (const upload of queuedUploads) {
            while (UploadManager.activeUploads >= UploadManager.maxConcurrent) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (upload.status === 'queued') {
                this.uploadFile(upload);
            }
        }
    },

    /**
     * Upload a file
     */
    async uploadFile(uploadItem) {
        uploadItem.status = 'uploading';
        UploadManager.activeUploads++;
        this.updateUploadItemUI(uploadItem);

        const formData = new FormData();
        formData.append('file', uploadItem.file);
        formData.append('path', FileManagerState.currentPath);

        try {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    uploadItem.progress = Math.round((e.loaded / e.total) * 100);
                    this.updateUploadItemUI(uploadItem);
                }
            });

            xhr.addEventListener('load', () => {
                UploadManager.activeUploads--;

                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        uploadItem.status = 'success';
                        uploadItem.progress = 100;
                        this.updateUploadItemUI(uploadItem);

                        setTimeout(() => this.removeUpload(uploadItem.id), 3000);
                        FileManagerCore.loadDirectory(FileManagerState.currentPath);
                    } else {
                        uploadItem.status = 'failed';
                        uploadItem.error = response.error || 'Upload failed';
                        this.updateUploadItemUI(uploadItem);
                    }
                } else {
                    uploadItem.status = 'failed';
                    uploadItem.error = 'Upload failed';
                    this.updateUploadItemUI(uploadItem);
                }

                this.updateUploadIndicator();
            });

            xhr.addEventListener('error', () => {
                UploadManager.activeUploads--;
                uploadItem.status = 'failed';
                uploadItem.error = 'Network error';
                this.updateUploadItemUI(uploadItem);
                this.updateUploadIndicator();
            });

            xhr.addEventListener('abort', () => {
                UploadManager.activeUploads--;
                uploadItem.status = 'cancelled';
                this.updateUploadItemUI(uploadItem);
                setTimeout(() => this.removeUpload(uploadItem.id), 2000);
                this.updateUploadIndicator();
            });

            uploadItem.abortController.signal.addEventListener('abort', () => {
                xhr.abort();
            });

            xhr.open('POST', `/server/${FileManagerState.serverName}/files/upload`);
            xhr.send(formData);

        } catch (error) {
            UploadManager.activeUploads--;
            uploadItem.status = 'failed';
            uploadItem.error = error.message;
            this.updateUploadItemUI(uploadItem);
            this.updateUploadIndicator();
        }
    },

    /**
     * Cancel upload
     */
    cancelUpload(uploadId) {
        const upload = UploadManager.uploads.get(uploadId);
        if (!upload) return;

        if (upload.status === 'uploading' || upload.status === 'queued') {
            upload.abortController.abort();
        }
    },

    /**
     * Cancel all uploads
     */
    cancelAllUploads() {
        UploadManager.uploads.forEach(upload => {
            if (upload.status === 'uploading' || upload.status === 'queued') {
                this.cancelUpload(upload.id);
            }
        });
    },

    /**
     * Remove upload from manager
     */
    removeUpload(uploadId) {
        UploadManager.uploads.delete(uploadId);
        
        const uploadEl = document.getElementById(`upload-${uploadId}`);
        if (uploadEl) {
            uploadEl.remove();
        }

        this.updateUploadIndicator();

        if (UploadManager.uploads.size === 0) {
            this.hideUploadPanel();
        }
    },

    /**
     * Render upload item in panel
     */
    renderUploadItem(uploadItem) {
        const panelBody = document.getElementById('uploadPanelBody');
        if (!panelBody) return;

        const itemEl = document.createElement('div');
        itemEl.className = 'upload-item';
        itemEl.id = `upload-${uploadItem.id}`;

        itemEl.innerHTML = `
            <div class="upload-item-header">
                <div class="upload-item-name" title="${uploadItem.file.name}">${uploadItem.file.name}</div>
                <button class="upload-item-cancel" data-upload-id="${uploadItem.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div class="upload-progress-bar">
                <div class="upload-progress-fill" style="width: 0%"></div>
            </div>
            <div class="upload-item-status">Queued...</div>
        `;

        const cancelBtn = itemEl.querySelector('.upload-item-cancel');
        cancelBtn.addEventListener('click', () => this.cancelUpload(uploadItem.id));

        panelBody.appendChild(itemEl);
    },

    /**
     * Update upload item UI
     */
    updateUploadItemUI(uploadItem) {
        const itemEl = document.getElementById(`upload-${uploadItem.id}`);
        if (!itemEl) return;

        const progressFill = itemEl.querySelector('.upload-progress-fill');
        const statusEl = itemEl.querySelector('.upload-item-status');

        if (progressFill) {
            progressFill.style.width = uploadItem.progress + '%';
            
            progressFill.classList.remove('success', 'failed');
            if (uploadItem.status === 'success') {
                progressFill.classList.add('success');
            } else if (uploadItem.status === 'failed') {
                progressFill.classList.add('failed');
            }
        }

        if (statusEl) {
            statusEl.classList.remove('success', 'failed', 'cancelled');
            
            switch (uploadItem.status) {
                case 'queued':
                    statusEl.textContent = 'Queued...';
                    break;
                case 'uploading':
                    statusEl.textContent = `Uploading... ${uploadItem.progress}%`;
                    break;
                case 'success':
                    statusEl.textContent = 'Upload complete';
                    statusEl.classList.add('success');
                    break;
                case 'failed':
                    statusEl.textContent = uploadItem.error || 'Upload failed';
                    statusEl.classList.add('failed');
                    break;
                case 'cancelled':
                    statusEl.textContent = 'Cancelled';
                    statusEl.classList.add('cancelled');
                    break;
            }
        }
    },

    /**
     * Update upload indicator badge
     */
    updateUploadIndicator() {
        const indicator = document.getElementById('uploadIndicator');
        const badge = document.getElementById('uploadBadge');

        if (!indicator || !badge) return;

        const activeCount = Array.from(UploadManager.uploads.values())
            .filter(u => u.status === 'uploading' || u.status === 'queued').length;

        if (activeCount > 0) {
            indicator.style.display = 'flex';
            badge.textContent = activeCount;
        } else if (UploadManager.uploads.size === 0) {
            indicator.style.display = 'none';
        }
    },

    /**
     * Show upload panel
     */
    showUploadPanel() {
        const panel = document.getElementById('uploadPanel');
        if (panel) {
            panel.classList.add('show');
        }
    },

    /**
     * Hide upload panel
     */
    hideUploadPanel() {
        const panel = document.getElementById('uploadPanel');
        if (panel) {
            panel.classList.remove('show');
        }
    },

    /**
     * Toggle upload panel
     */
    toggleUploadPanel() {
        const panel = document.getElementById('uploadPanel');
        if (panel) {
            panel.classList.toggle('show');
        }
    }
};

// Export for global access
window.FileUploader = FileUploader;