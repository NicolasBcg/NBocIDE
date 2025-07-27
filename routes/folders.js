// Server/routes/folders.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Utility function to get workspace path
const getWorkspacePath = (req) => req.app.locals.workspacePath;

// Utility function to sanitize folder names
const sanitizeFolderName = (name) => {
    return name
        .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .toLowerCase()
        .trim();
};

// Utility function to validate folder name
const validateFolderName = (name) => {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'Folder name is required and must be a string' };
    }
    
    const sanitized = sanitizeFolderName(name);
    
    if (!sanitized || sanitized.length === 0) {
        return { valid: false, error: 'Invalid folder name' };
    }
    
    if (sanitized.length > 50) {
        return { valid: false, error: 'Folder name too long (max 50 characters)' };
    }
    
    // Reserved names
    const reserved = ['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9', 'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'];
    if (reserved.includes(sanitized.toLowerCase())) {
        return { valid: false, error: 'Reserved folder name not allowed' };
    }
    
    return { valid: true, sanitized };
};

// GET /api/folders - List all folders in workspace
router.get('/', async (req, res) => {
    try {
        const workspacePath = getWorkspacePath(req);
        const items = await fs.readdir(workspacePath, { withFileTypes: true });
        
        const folders = [];
        
        for (const item of items) {
            if (item.isDirectory()) {
                try {
                    const folderPath = path.join(workspacePath, item.name);
                    const stats = await fs.stat(folderPath);
                    
                    folders.push({
                        name: item.name,
                        path: folderPath,
                        created: stats.birthtime,
                        modified: stats.mtime,
                        size: stats.size
                    });
                } catch (statError) {
                    console.warn(`Warning: Could not get stats for folder ${item.name}:`, statError);
                    // Still include the folder but with basic info
                    folders.push({
                        name: item.name,
                        path: path.join(workspacePath, item.name),
                        created: new Date(),
                        modified: new Date(),
                        size: 0
                    });
                }
            }
        }
        
        // Sort folders by creation date (newest first)
        folders.sort((a, b) => new Date(b.created) - new Date(a.created));
        
        res.json({
            success: true,
            count: folders.length,
            folders: folders
        });
        
    } catch (error) {
        console.error('Error reading workspace:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to read workspace directory',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/folders - Create a new folder
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        const workspacePath = getWorkspacePath(req);
        
        // Validate folder name
        const validation = validateFolderName(name);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: validation.error
            });
        }
        
        const sanitizedName = validation.sanitized;
        const folderPath = path.join(workspacePath, sanitizedName);
        
        // Check if folder already exists
        try {
            await fs.access(folderPath);
            return res.status(409).json({
                success: false,
                error: `Folder "${sanitizedName}" already exists`
            });
        } catch (error) {
            // Folder doesn't exist, we can create it
        }
        
        // Create the folder
        await fs.mkdir(folderPath, { recursive: true });
        
        // Get folder stats for response
        const stats = await fs.stat(folderPath);
        
        const newFolder = {
            name: sanitizedName,
            path: folderPath,
            created: stats.birthtime,
            modified: stats.mtime,
            size: stats.size
        };
        
        console.log(`✅ Created folder: ${sanitizedName}`);
        
        res.status(201).json({
            success: true,
            message: `Folder "${sanitizedName}" created successfully`,
            folder: newFolder
        });
        
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create folder',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/folders/:folderName - Get specific folder info
router.get('/:folderName', async (req, res) => {
    try {
        const { folderName } = req.params;
        const workspacePath = getWorkspacePath(req);
        const folderPath = path.join(workspacePath, folderName);
        
        // Check if folder exists
        try {
            const stats = await fs.stat(folderPath);
            
            if (!stats.isDirectory()) {
                return res.status(404).json({
                    success: false,
                    error: 'Path exists but is not a folder'
                });
            }
            
            // Get folder contents
            const items = await fs.readdir(folderPath, { withFileTypes: true });
            const contents = items.map(item => ({
                name: item.name,
                type: item.isDirectory() ? 'folder' : 'file',
                path: path.join(folderPath, item.name)
            }));
            
            res.json({
                success: true,
                folder: {
                    name: folderName,
                    path: folderPath,
                    created: stats.birthtime,
                    modified: stats.mtime,
                    size: stats.size,
                    contents: contents
                }
            });
            
        } catch (error) {
            res.status(404).json({
                success: false,
                error: `Folder "${folderName}" not found`
            });
        }
        
    } catch (error) {
        console.error('Error getting folder info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get folder information'
        });
    }
});

// DELETE /api/folders/:folderName - Delete a folder
router.delete('/:folderName', async (req, res) => {
    try {
        const { folderName } = req.params;
        const workspacePath = getWorkspacePath(req);
        const folderPath = path.join(workspacePath, folderName);
        
        // Check if folder exists
        try {
            const stats = await fs.stat(folderPath);
            
            if (!stats.isDirectory()) {
                return res.status(400).json({
                    success: false,
                    error: 'Path exists but is not a folder'
                });
            }
            
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: `Folder "${folderName}" not found`
            });
        }
        
        // Delete the folder recursively
        await fs.rm(folderPath, { recursive: true, force: true });
        
        console.log(`🗑️ Deleted folder: ${folderName}`);
        
        res.json({
            success: true,
            message: `Folder "${folderName}" deleted successfully`
        });
        
    } catch (error) {
        console.error('Error deleting folder:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete folder'
        });
    }
});

module.exports = router;