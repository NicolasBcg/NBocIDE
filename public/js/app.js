// public/js/app.js - Frontend JavaScript for Python IDE Landing Page

// Global state
let folders = [];
let isLoading = false;

// DOM Elements
const statusBar = document.getElementById('statusBar');
const folderNameInput = document.getElementById('folderName');
const createBtn = document.getElementById('createBtn');
const foldersContainer = document.getElementById('foldersContainer');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Python IDE Frontend Initialized');
    
    // Initial health check and folder load
    checkServerHealth();
    loadFolders();
    
    // Set up form validation
    setupFormValidation();
    
    // Set up keyboard shortcuts
    setupKeyboardShortcuts();
});

// ============================================================================
// SERVER HEALTH & STATUS
// ============================================================================

async function checkServerHealth() {
    try {
        updateStatus('Checking server health...', 'loading');
        
        const response = await fetch('/api/health');
        const data = await response.json();
        
        if (data.success) {
            updateStatus(`✅ Server healthy - ${data.workspace.folderCount} folders in workspace`, 'success');
        } else {
            updateStatus(`⚠️ Server degraded - ${data.message}`, 'warning');
        }
    } catch (error) {
        console.error('Health check failed:', error);
        updateStatus('❌ Server connection failed', 'error');
    }
}

function updateStatus(message, type = 'default') {
    if (!statusBar) return;
    
    statusBar.className = `status-bar ${type}`;
    statusBar.innerHTML = type === 'loading' 
        ? `<span class="loading"></span>${message}`
        : message;
}

// ============================================================================
// FOLDER MANAGEMENT
// ============================================================================

async function loadFolders() {
    if (isLoading) return;
    
    try {
        isLoading = true;        
        const response = await fetch('/api/folders');
        const data = await response.json();
        
        if (data.success) {
            folders = data.folders;
            renderFolders(folders);
            updateStatus(`📁 ${folders.length} folders loaded`, 'success');
        } else {
            throw new Error(data.error || 'Failed to load folders');
        }
    } catch (error) {
        console.error('Error loading folders:', error);
        updateStatus('❌ Failed to load folders', 'error');
    } finally {
        isLoading = false;
    }
}

async function createFolder(event) {
    event.preventDefault();
    
    const folderName = folderNameInput.value.trim();
    if (!folderName) {
        return;
    }
    
    try {
        // Disable form during creation
        setFormDisabled(true);
        updateStatus('Creating folder...', 'loading');
        
        const response = await fetch('/api/folders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: folderName })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Clear form
            folderNameInput.value = '';
            
            // Reload folders to show the new one
            await loadFolders();
            updateStatus('✅ Folder created successfully!', 'Success');
            // Focus on the newly created folder
            setTimeout(() => {
                const newFolderCard = document.querySelector(`[data-folder-name="${data.folder.name}"]`);
                if (newFolderCard) {
                    newFolderCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    newFolderCard.classList.add('highlight');
                    setTimeout(() => newFolderCard.classList.remove('highlight'), 2000);
                }
            }, 500);
            
        } else {
            throw new Error(data.error || 'Failed to create folder');
        }
    } catch (error) {
        console.error('Error creating folder:', error);
        updateStatus('❌ Failed to create folder', 'error');
    } finally {
        setFormDisabled(false);
    }
}

async function deleteFolder(folderName) {
    if (!confirm(`Are you sure you want to delete the folder "${folderName}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        updateStatus(`Deleting folder "${folderName}"...`, 'loading');
        
        const response = await fetch(`/api/folders/${encodeURIComponent(folderName)}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadFolders(); // Reload the folder list
            updateStatus(`✅ Folder "${folderName}" deleted`, 'success');
        } else {
            throw new Error(data.error || 'Failed to delete folder');
        }
    } catch (error) {
        console.error('Error deleting folder:', error);
        updateStatus('❌ Failed to delete folder', 'error');
    }
}

// Navigate to project page
function openFolder(folderName) {
    try {
        updateStatus(`Opening project "${folderName}"...`, 'loading');
        
        // Navigate to project page with the folder name as parameter
        window.location.href = `/project.html?project=${encodeURIComponent(folderName)}`;
        
    } catch (error) {
        console.error('Error opening folder:', error);
        updateStatus('❌ Failed to open project', 'error');
    }
}

// ============================================================================
// UI RENDERING
// ============================================================================

function renderFolders(folderList) {
    if (!foldersContainer) return;
    
    if (folderList.length === 0) {
        foldersContainer.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📁</span>
                <h3>No folders yet</h3>
                <p>Create your first Python project folder to get started!</p>
            </div>
        `;
        return;
    }
    
    const foldersHtml = folderList.map(folder => {
        const createdDate = new Date(folder.created).toLocaleDateString();
        const modifiedDate = new Date(folder.modified).toLocaleDateString();
        
        return `
            <div class="folder-card" data-folder-name="${escapeHtml(folder.name)}">
                <div class="folder-header">
                    <div class="folder-icon">📁</div>
                    <div class="folder-info">
                        <h3 class="folder-name">${escapeHtml(folder.name)}</h3>
                        <div class="folder-meta">
                            <span class="folder-date">Created: ${createdDate}</span>
                            ${createdDate !== modifiedDate ? `<span class="folder-date">Modified: ${modifiedDate}</span>` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="folder-actions">
                    <button class="btn btn-primary btn-sm" onclick="openFolder('${escapeHtml(folder.name)}')" title="Open project">
                        <span class="btn-icon">📂</span>
                        <span class="btn-text">Open</span>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteFolder('${escapeHtml(folder.name)}')" title="Delete folder">
                        <span class="btn-icon">🗑️</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    foldersContainer.innerHTML = foldersHtml;
}

// ============================================================================
// FORM VALIDATION & UI HELPERS
// ============================================================================

function setupFormValidation() {
    if (!folderNameInput) return;
    
    folderNameInput.addEventListener('input', function(e) {
        const value = e.target.value;
        const isValid = validateFolderName(value);
        
        // Update form styling based on validation
        const formGroup = e.target.closest('.form-group');
        if (formGroup) {
            formGroup.classList.toggle('error', !isValid && value.length > 0);
        }
        
        // Enable/disable create button
        if (createBtn) {
            createBtn.disabled = !isValid || value.trim().length === 0;
        }
    });
    
    // Auto-focus on folder name input
    folderNameInput.focus();
}

function validateFolderName(name) {
    if (!name || typeof name !== 'string') return false;
    
    const trimmed = name.trim();
    if (!trimmed || trimmed.length === 0) return false;
    if (trimmed.length > 50) return false;
    
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(trimmed)) return false;
    
    // Check for reserved names
    const reserved = ['con', 'prn', 'aux', 'nul'];
    if (reserved.includes(trimmed.toLowerCase())) return false;
    
    return true;
}

function setFormDisabled(disabled) {
    if (folderNameInput) folderNameInput.disabled = disabled;
    if (createBtn) createBtn.disabled = disabled;
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + Enter to create folder
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (folderNameInput && document.activeElement === folderNameInput) {
                e.preventDefault();
                createFolder(e);
            }
        }
        
        // F5 to refresh folders
        if (e.key === 'F5') {
            e.preventDefault();
            loadFolders();
        }
        
        // Escape to clear form
        if (e.key === 'Escape') {
            if (folderNameInput) {
                folderNameInput.value = '';
                folderNameInput.focus();
            }
        }
    });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================================================
// EXPORT FOR GLOBAL ACCESS
// ============================================================================

// Make functions available globally for onclick handlers
window.createFolder = createFolder;
window.loadFolders = loadFolders;
window.deleteFolder = deleteFolder;
window.openFolder = openFolder;


