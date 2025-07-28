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

// Function to create Python project structure
const createPythonProjectStructure = async (folderPath, projectName) => {
    try {
        // Create subdirectories
        const subdirs = ['data', 'logs', 'test', 'src'];
        for (const subdir of subdirs) {
            await fs.mkdir(path.join(folderPath, subdir), { recursive: true });
        }

        // Create README.md
        const readmeContent = `# ${projectName.charAt(0).toUpperCase() + projectName.slice(1).replace(/-/g, ' ')}

## Description
A Python project for ${projectName.replace(/-/g, ' ')}.

## Installation

1. Clone this repository
2. Install dependencies:
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`

## Usage

Describe how to use your project here.

## Project Structure

\`\`\`
${projectName}/
├── data/          # Data files (ignored by git)
├── logs/          # Log files (ignored by git)
├── test/          # Test files
├── README.md      # This file
├── requirements.txt # Python dependencies
├── LICENSE        # License file
└── .gitignore     # Git ignore rules
\`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
`;

        await fs.writeFile(path.join(folderPath, 'README.md'), readmeContent);

        // Create LICENSE (MIT License)
        const currentYear = new Date().getFullYear();
        const licenseContent = `MIT License

Copyright (c) ${currentYear} ${projectName}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

        await fs.writeFile(path.join(folderPath, 'LICENSE'), licenseContent);

        // Create requirements.txt
        const requirementsContent = `# Core dependencies
numpy>=1.21.0
pandas>=1.3.0
matplotlib>=3.4.0

# Development dependencies
pytest>=6.2.0
black>=21.0.0
flake8>=3.9.0

# Add your project-specific dependencies here
`;

        await fs.writeFile(path.join(folderPath, 'requirements.txt'), requirementsContent);

        // Create .gitignore
        const gitignoreContent = `# Byte-compiled / optimized / DLL files
__pycache__/
*.py[cod]
*$py.class

# C extensions
*.so

# Distribution / packaging
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST

# PyInstaller
#  Usually these files are written by a python script from a template
#  before PyInstaller builds the exe, so as to inject date/other infos into it.
*.manifest
*.spec

# Installer logs
pip-log.txt
pip-delete-this-directory.txt

# Unit test / coverage reports
htmlcov/
.tox/
.nox/
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
.hypothesis/
.pytest_cache/

# Translations
*.mo
*.pot

# Django stuff:
*.log
local_settings.py
db.sqlite3

# Flask stuff:
instance/
.webassets-cache

# Scrapy stuff:
.scrapy

# Sphinx documentation
docs/_build/

# PyBuilder
target/

# Jupyter Notebook
.ipynb_checkpoints

# IPython
profile_default/
ipython_config.py

# pyenv
.python-version

# celery beat schedule file
celerybeat-schedule

# SageMath parsed files
*.sage.py

# Environments
.env
.venv
env/
venv/
ENV/
env.bak/
venv.bak/

# Spyder project settings
.spyderproject
.spyproject

# Rope project settings
.ropeproject

# mkdocs documentation
/site

# mypy
.mypy_cache/
.dmypy.json
dmypy.json

# Pyre type checker
.pyre/

# Project-specific ignores
data/
logs/

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
`;

        await fs.writeFile(path.join(folderPath, '.gitignore'), gitignoreContent);
        console.log(`✅ Created Python project structure for: ${projectName}`);
        
    } catch (error) {
        console.error('Error creating Python project structure:', error);
        throw error;
    }
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

// POST /api/folders - Create a new folder with Python project structure
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
        
        // Create Python project structure
        await createPythonProjectStructure(folderPath, sanitizedName);
        
        // Get folder stats for response
        const stats = await fs.stat(folderPath);
        
        const newFolder = {
            name: sanitizedName,
            path: folderPath,
            created: stats.birthtime,
            modified: stats.mtime,
            size: stats.size
        };
        
        console.log(`✅ Created Python project: ${sanitizedName}`);
        
        res.status(201).json({
            success: true,
            message: `Python project "${sanitizedName}" created successfully with full project structure`,
            folder: newFolder
        });
        
    } catch (error) {
        console.error('Error creating Python project:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create Python project',
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
        
        console.log(`🗑️ Deleted Python project: ${folderName}`);
        
        res.json({
            success: true,
            message: `Python project "${folderName}" deleted successfully`
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