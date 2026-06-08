/* ========================================
   FILES.JS - Main Entry Point
   Coordinates all file manager modules
   ======================================== */

// ========== GLOBAL STATE ==========
window.FileManagerState = {
    serverName: '',
    currentPath: '/',
    currentView: 'list', // 'list' or 'grid'
    files: [],
    selectedFiles: new Set(),
    isLoading: false,
    clipboard: {
        action: null, // 'move' or 'duplicate'
        items: [], // Array of file objects
        sourcePath: '' // Source directory path
    }
};

window.FileEditorState = {
    isEditing: false,
    currentFile: null,
    originalContent: '',
    hasChanges: false
};

window.UploadManager = {
    uploads: new Map(), // Map<uploadId, uploadItem>
    nextId: 1,
    activeUploads: 0,
    maxConcurrent: 3
};

// ========== MAIN INITIALIZATION ==========

/**
 * Initialize file manager
 * @param {string} serverName - Name of the server
 */
function initFileManager(serverName) {
    FileManagerState.serverName = serverName;
    
    // Initialize all modules
    FileManagerCore.init();
    FileEditor.init();
    FileUploader.init();
    ContextMenu.init();
    Modals.init();
}

// Export for global access
window.initFileManager = initFileManager;