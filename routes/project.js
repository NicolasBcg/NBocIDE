// Server/routes/project.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Utility function to get workspace path
const getWorkspacePath = (req) => req.app.locals.workspacePath;

// Utility function to get file tree structure
const getFileTree = async (dirPath, basePath = '') => {
    try {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        const tree = [];
        
        for (const item of items) {
            const itemPath = path.join(dirPath, item.name);
            const relativePath = path.join(basePath, item.name).replace(/\\/g, '/'); // Normalize path separators
            const stats = await fs.stat(itemPath);
            
            const node = {
                name: item.name,
                path: relativePath,
                isDirectory: item.isDirectory(),
                size: stats.size,
                modified: stats.mtime,
                extension: item.isFile() ? path.extname(item.name) : null
            };
            
            if (item.isDirectory()) {
                // Recursively get children for directories
                node.children = await getFileTree(itemPath, relativePath);
                node.isExpanded = false; // Default collapsed state
            }
            
            tree.push(node);
        }
        
        // Sort: directories first, then files, both alphabetically
        return tree.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
        
    } catch (error) {
        console.error('Error reading directory:', error);
        return [];
    }
};

// GET /api/project/:projectName - Get project info and file tree
router.get('/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        const workspacePath = getWorkspacePath(req);
        const projectPath = path.join(workspacePath, projectName);
        
        // Check if project exists
        try {
            const stats = await fs.stat(projectPath);
            
            if (!stats.isDirectory()) {
                return res.status(404).json({
                    success: false,
                    error: 'Project path exists but is not a directory'
                });
            }
            
            // Get file tree structure
            const tree = await getFileTree(projectPath);
            
            res.json({
                success: true,
                project: {
                    name: projectName,
                    path: projectPath,
                    created: stats.birthtime,
                    modified: stats.mtime,
                    tree: tree
                }
            });
            
        } catch (error) {
            res.status(404).json({
                success: false,
                error: `Project "${projectName}" not found`
            });
        }
        
    } catch (error) {
        console.error('Error getting project info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get project information'
        });
    }
});

// GET /api/project/:projectName/file/* - Get file content
router.get('/:projectName/file/*', async (req, res) => {
    try {
        const { projectName } = req.params;
        const filePath = req.params[0]; // Get the full file path after /file/
        const workspacePath = getWorkspacePath(req);
        const fullFilePath = path.join(workspacePath, projectName, filePath);
        
        // Security check - ensure file is within the project directory
        const projectPath = path.join(workspacePath, projectName);
        const resolvedPath = path.resolve(fullFilePath);
        const resolvedProjectPath = path.resolve(projectPath);
        
        if (!resolvedPath.startsWith(resolvedProjectPath)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied: File path outside project directory'
            });
        }
        
        // Check if file exists
        try {
            const stats = await fs.stat(fullFilePath);
            
            if (stats.isDirectory()) {
                return res.status(400).json({
                    success: false,
                    error: 'Path is a directory, not a file'
                });
            }
            
            // Check file size (limit to 10MB for safety)
            if (stats.size > 10 * 1024 * 1024) {
                return res.status(413).json({
                    success: false,
                    error: 'File too large to display (>10MB)'
                });
            }
            
            // Try to read file as text
            let content;
            let isBinary = false;
            
            try {
                content = await fs.readFile(fullFilePath, 'utf8');
                
                // Check if content contains non-printable characters (binary file)
                const nonPrintableRegex = /[\x00-\x08\x0E-\x1F\x7F-\x9F]/;
                if (nonPrintableRegex.test(content)) {
                    isBinary = true;
                    content = null;
                }
            } catch (encodingError) {
                // If UTF-8 reading fails, it's likely a binary file
                isBinary = true;
                content = null;
            }
            
            res.json({
                success: true,
                file: {
                    name: path.basename(fullFilePath),
                    path: filePath.replace(/\\/g, '/'), // Normalize path separators
                    extension: path.extname(fullFilePath),
                    size: stats.size,
                    modified: stats.mtime,
                    content: content,
                    isBinary: isBinary,
                    type: isBinary ? 'binary' : 'text'
                }
            });
            
        } catch (error) {
            res.status(404).json({
                success: false,
                error: `File "${filePath}" not found`
            });
        }
        
    } catch (error) {
        console.error('Error reading file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to read file'
        });
    }
});

// PUT /api/project/:projectName/file/* - Save file content
router.put('/:projectName/file/*', async (req, res) => {
    try {
        const { projectName } = req.params;
        const filePath = req.params[0];
        const { content } = req.body;
        const workspacePath = getWorkspacePath(req);
        const fullFilePath = path.join(workspacePath, projectName, filePath);
        
        // Security check - ensure file is within the project directory
        const projectPath = path.join(workspacePath, projectName);
        const resolvedPath = path.resolve(fullFilePath);
        const resolvedProjectPath = path.resolve(projectPath);
        
        if (!resolvedPath.startsWith(resolvedProjectPath)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied: File path outside project directory'
            });
        }
        
        // Validate content
        if (typeof content !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Content must be a string'
            });
        }
        
        // Create directory if it doesn't exist
        const dir = path.dirname(fullFilePath);
        await fs.mkdir(dir, { recursive: true });
        
        // Write file
        await fs.writeFile(fullFilePath, content, 'utf8');
        
        // Get updated file stats
        const stats = await fs.stat(fullFilePath);
        
        console.log(`💾 Saved file: ${projectName}/${filePath}`);
        
        res.json({
            success: true,
            message: 'File saved successfully',
            file: {
                name: path.basename(fullFilePath),
                path: filePath.replace(/\\/g, '/'),
                size: stats.size,
                modified: stats.mtime
            }
        });
        
    } catch (error) {
        console.error('Error saving file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save file: ' + error.message
        });
    }
});

// POST /api/project/:projectName/file/* - Create new file
router.post('/:projectName/file/*', async (req, res) => {
    try {
        const { projectName } = req.params;
        const filePath = req.params[0];
        const { content = '' } = req.body;
        const workspacePath = getWorkspacePath(req);
        const fullFilePath = path.join(workspacePath, projectName, filePath);
        
        // Security check
        const projectPath = path.join(workspacePath, projectName);
        const resolvedPath = path.resolve(fullFilePath);
        const resolvedProjectPath = path.resolve(projectPath);
        
        if (!resolvedPath.startsWith(resolvedProjectPath)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied: File path outside project directory'
            });
        }
        
        // Check if file already exists
        try {
            await fs.access(fullFilePath);
            return res.status(409).json({
                success: false,
                error: 'File already exists'
            });
        } catch (error) {
            // File doesn't exist, we can create it
        }
        
        // Create directory if it doesn't exist
        const dir = path.dirname(fullFilePath);
        await fs.mkdir(dir, { recursive: true });
        
        // Create file
        await fs.writeFile(fullFilePath, content, 'utf8');
        
        // Get file stats
        const stats = await fs.stat(fullFilePath);
        
        console.log(`📄 Created file: ${projectName}/${filePath}`);
        
        res.status(201).json({
            success: true,
            message: 'File created successfully',
            file: {
                name: path.basename(fullFilePath),
                path: filePath.replace(/\\/g, '/'),
                size: stats.size,
                modified: stats.mtime,
                content: content
            }
        });
        
    } catch (error) {
        console.error('Error creating file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create file: ' + error.message
        });
    }
});

// DELETE /api/project/:projectName/file/* - Delete file
router.delete('/:projectName/file/*', async (req, res) => {
    try {
        const { projectName } = req.params;
        const filePath = req.params[0];
        const workspacePath = getWorkspacePath(req);
        const fullFilePath = path.join(workspacePath, projectName, filePath);
        
        // Security check
        const projectPath = path.join(workspacePath, projectName);
        const resolvedPath = path.resolve(fullFilePath);
        const resolvedProjectPath = path.resolve(projectPath);
        
        if (!resolvedPath.startsWith(resolvedProjectPath)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied: File path outside project directory'
            });
        }
        
        // Check if file exists
        try {
            const stats = await fs.stat(fullFilePath);
            
            if (stats.isDirectory()) {
                // Delete directory recursively
                await fs.rm(fullFilePath, { recursive: true, force: true });
                console.log(`🗑️ Deleted directory: ${projectName}/${filePath}`);
            } else {
                // Delete file
                await fs.unlink(fullFilePath);
                console.log(`🗑️ Deleted file: ${projectName}/${filePath}`);
            }
            
            res.json({
                success: true,
                message: `${stats.isDirectory() ? 'Directory' : 'File'} deleted successfully`
            });
            
        } catch (error) {
            res.status(404).json({
                success: false,
                error: `File or directory "${filePath}" not found`
            });
        }
        
    } catch (error) {
        console.error('Error deleting file/directory:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete file or directory'
        });
    }
});

// POST /api/project/:projectName/folder/* - Create new folder
router.post('/:projectName/folder/*', async (req, res) => {
    try {
        const { projectName } = req.params;
        const folderPath = req.params[0];
        const workspacePath = getWorkspacePath(req);
        const fullFolderPath = path.join(workspacePath, projectName, folderPath);
        
        // Security check
        const projectPath = path.join(workspacePath, projectName);
        const resolvedPath = path.resolve(fullFolderPath);
        const resolvedProjectPath = path.resolve(projectPath);
        
        if (!resolvedPath.startsWith(resolvedProjectPath)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied: Folder path outside project directory'
            });
        }
        
        // Check if folder already exists
        try {
            await fs.access(fullFolderPath);
            return res.status(409).json({
                success: false,
                error: 'Folder already exists'
            });
        } catch (error) {
            // Folder doesn't exist, we can create it
        }
        
        // Create folder
        await fs.mkdir(fullFolderPath, { recursive: true });
        
        // Get folder stats
        const stats = await fs.stat(fullFolderPath);
        
        console.log(`📁 Created folder: ${projectName}/${folderPath}`);
        
        res.status(201).json({
            success: true,
            message: 'Folder created successfully',
            folder: {
                name: path.basename(fullFolderPath),
                path: folderPath.replace(/\\/g, '/'),
                modified: stats.mtime
            }
        });
        
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create folder: ' + error.message
        });
    }
});

module.exports = router;