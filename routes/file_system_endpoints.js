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

  if (sanitized.length > 20) {
    return { valid: false, error: 'Folder name too long (max 20 characters)' };
  }

  const reserved = ['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9', 'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'];
  if (reserved.includes(sanitized.toLowerCase())) {
    return { valid: false, error: 'Reserved folder name not allowed' };
  }

  return { valid: true, sanitized };
};

// Fetch arborescence in a folder
router.get('/arborescence', async (req, res) => {
  const { folder_path = '' } = req.query;
  const basePath = path.join(getWorkspacePath(req), folder_path);

  try {
    const entries = await fs.readdir(basePath, { withFileTypes: true });
    const structure = await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(basePath, entry.name);
      const stat = await fs.stat(entryPath);

      return {
        name: entry.name,
        type: entry.isDirectory() ? 'folder' : 'file',
        size: stat.size,
        modified: stat.mtime
      };
    }));

    res.json({ success: true, contents: structure });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a folder in a given path
router.post('/create-folder', async (req, res) => {
  const { folder_path, name } = req.body;
  const { valid, sanitized, error } = validateFolderName(name);

  if (!valid) return res.status(400).json({ success: false, error });

  const newFolderPath = path.join(getWorkspacePath(req), folder_path, sanitized);

  try {
    await fs.mkdir(newFolderPath, { recursive: false });
    res.status(201).json({ success: true, message: `Folder '${sanitized}' created successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create a file in a given path
router.post('/create-file', async (req, res) => {
  const { folder_path, name } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ success: false, error: 'File name is required and must be a string' });
  }

  const sanitized = sanitizeFolderName(name);
  const newFilePath = path.join(getWorkspacePath(req), folder_path, sanitized);

  try {
    await fs.writeFile(newFilePath, '', { flag: 'wx' }); // 'wx' fails if file exists
    res.status(201).json({ success: true, message: `File '${sanitized}' created successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;