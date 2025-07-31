// app.js
class BocIDE {
    constructor() {
        this.projects = [];
        this.init();
    }

    init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.bindEvents();
                this.loadProjects();
            });
        } else {
            this.bindEvents();
            this.loadProjects();
        }
    }

    bindEvents() {
        // New project button
        const newProjectBtn = document.getElementById('new-project-btn');
        if (newProjectBtn) {
            newProjectBtn.addEventListener('click', () => {
                console.log('New project button clicked');
                this.showCreateModal();
            });
        } else {
            console.error('New project button not found');
        }

        // Modal events
        const cancelBtn = document.getElementById('cancel-btn');
        const createBtn = document.getElementById('create-btn');
        const deleteCancelBtn = document.getElementById('delete-cancel-btn');
        const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
        const modalOverlay = document.getElementById('modal-overlay');
        const deleteModalOverlay = document.getElementById('delete-modal-overlay');
        const projectNameInput = document.getElementById('project-name-input');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hideCreateModal();
            });
        }

        if (createBtn) {
            createBtn.addEventListener('click', () => {
                this.createProject();
            });
        }

        // Delete modal events
        if (deleteCancelBtn) {
            deleteCancelBtn.addEventListener('click', () => {
                this.hideDeleteModal();
            });
        }

        if (deleteConfirmBtn) {
            deleteConfirmBtn.addEventListener('click', () => {
                this.confirmDelete();
            });
        }

        // Close modals when clicking overlay
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === e.currentTarget) {
                    this.hideCreateModal();
                }
            });
        }

        if (deleteModalOverlay) {
            deleteModalOverlay.addEventListener('click', (e) => {
                if (e.target === e.currentTarget) {
                    this.hideDeleteModal();
                }
            });
        }

        // Enter key in input
        if (projectNameInput) {
            projectNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.createProject();
                }
            });
        }
    }

    async loadProjects() {
        const container = document.getElementById('projects-container');
        container.innerHTML = '<div class="loading">Loading projects...</div>';

        try {
            console.log('Fetching projects...');
            // Try different possible API endpoints
            let response;
            try {
                response = await fetch('/api/folders/arborescence');
            } catch (e) {
                console.log('Trying alternative endpoint...');
                response = await fetch('/folders/arborescence');
            }

            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);

            if (data.success) {
                // Filter only folders
                this.projects = data.contents.filter(item => item.type === 'folder');
                console.log('Found projects:', this.projects);
                this.renderProjects();
            } else {
                this.showError('Failed to load projects: ' + data.error);
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            this.showError('Error loading projects: ' + error.message + '. Check if the server is running and the API endpoints are accessible.');
        }
    }

    renderProjects() {
        const container = document.getElementById('projects-container');
        
        if (this.projects.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="folder-icon">📁</span>
                    <span class="create-project-link" onclick="bocIDE.showCreateModal()">
                        Create a new project
                    </span>
                </div>
            `;
            return;
        }

        const projectsHTML = this.projects.map(project => `
            <div class="project-card">
                <div class="project-header">
                    <span class="project-icon">📁</span>
                    <span class="project-name">${this.escapeHtml(project.name)}</span>
                </div>
                <div class="project-actions">
                    <button class="btn btn-success btn-small" onclick="bocIDE.openProject('${this.escapeHtml(project.name)}')">
                        Open
                    </button>
                    <button class="btn btn-danger btn-small" onclick="bocIDE.showDeleteModal('${this.escapeHtml(project.name)}')">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = `<div class="project-grid">${projectsHTML}</div>`;
    }

    showCreateModal() {
        const modal = document.getElementById('modal-overlay');
        const input = document.getElementById('project-name-input');
        
        input.value = '';
        modal.classList.add('active');
        input.focus();
    }

    hideCreateModal() {
        const modal = document.getElementById('modal-overlay');
        modal.classList.remove('active');
    }

    showDeleteModal(projectName) {
        const modal = document.getElementById('delete-modal-overlay');
        const nameSpan = document.getElementById('delete-project-name');
        
        nameSpan.textContent = projectName;
        this.projectToDelete = projectName;
        modal.classList.add('active');
    }

    hideDeleteModal() {
        const modal = document.getElementById('delete-modal-overlay');
        modal.classList.remove('active');
        this.projectToDelete = null;
    }

    async createProject() {
        const input = document.getElementById('project-name-input');
        const projectName = input.value.trim();

        if (!projectName) {
            alert('Please enter a project name');
            return;
        }

        if (projectName.length > 20) {
            alert('Project name must be 20 characters or less');
            return;
        }

        try {
            console.log('Creating project:', projectName);
            let response;
            try {
                response = await fetch('/api/folders/create-folder', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        folder_path: '',
                        name: projectName
                    })
                });
            } catch (e) {
                console.log('Trying alternative endpoint...');
                response = await fetch('/folders/create-folder', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        folder_path: '',
                        name: projectName
                    })
                });
            }

            const data = await response.json();
            console.log('Create response:', data);

            if (data.success) {
                this.hideCreateModal();
                this.loadProjects(); // Reload to show new project
                this.showSuccess(`Project "${projectName}" created successfully!`);
            } else {
                alert('Error creating project: ' + data.error);
            }
        } catch (error) {
            console.error('Error creating project:', error);
            alert('Error creating project: ' + error.message);
        }
    }

    async confirmDelete() {
        if (!this.projectToDelete) return;

        try {
            const response = await fetch('/api/folders/delete-folder', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    folder_path: this.projectToDelete
                })
            });

            const data = await response.json();

            if (data.success) {
                this.hideDeleteModal();
                this.loadProjects(); // Reload to remove deleted project
                this.showSuccess(`Project "${this.projectToDelete}" deleted successfully!`);
            } else {
                alert('Error deleting project: ' + data.error);
            }
        } catch (error) {
            alert('Error deleting project: ' + error.message);
        }
    }

    openProject(projectName) {
        // TODO: Implement project opening functionality
        console.log('Opening project:', projectName);
        alert(`Opening project "${projectName}" - functionality not implemented yet`);
    }

    showError(message) {
        const container = document.getElementById('projects-container');
        container.innerHTML = `
            <div class="empty-state">
                <span style="color: #dc3545; font-size: 2rem;">⚠️</span>
                <p style="margin-top: 10px; color: #dc3545;">${this.escapeHtml(message)}</p>
                <button class="btn btn-primary" onclick="bocIDE.loadProjects()" style="margin-top: 15px;">
                    Retry
                </button>
            </div>
        `;
    }

    showSuccess(message) {
        // Create a temporary success notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1001;
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize the application
const bocIDE = new BocIDE();