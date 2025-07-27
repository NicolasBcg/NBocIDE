// Server/routes/health.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const router = express.Router();

// GET /api/health - Server health check
router.get('/', async (req, res) => {
    try {
        const workspacePath = req.app.locals.workspacePath;
        
        // Check workspace accessibility
        let workspaceStatus = 'accessible';
        let workspaceError = null;
        
        try {
            await fs.access(workspacePath);
        } catch (error) {
            workspaceStatus = 'inaccessible';
            workspaceError = error.message;
        }
        
        // Get system information
        const systemInfo = {
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            uptime: process.uptime(),
            memory: {
                total: Math.round(os.totalmem() / 1024 / 1024), // MB
                free: Math.round(os.freemem() / 1024 / 1024), // MB
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) // MB
            }
        };
        
        // Count workspace folders
        let folderCount = 0;
        if (workspaceStatus === 'accessible') {
            try {
                const items = await fs.readdir(workspacePath, { withFileTypes: true });
                folderCount = items.filter(item => item.isDirectory()).length;
            } catch (error) {
                console.warn('Could not count workspace folders:', error);
            }
        }
        
        const healthData = {
            success: true,
            status: 'healthy',
            message: 'IDE Server is running',
            timestamp: new Date().toISOString(),
            server: {
                port: process.env.PORT || 3000,
                environment: process.env.NODE_ENV || 'development',
                uptime: `${Math.floor(systemInfo.uptime / 60)} minutes`
            },
            workspace: {
                path: workspacePath,
                status: workspaceStatus,
                folderCount: folderCount,
                error: workspaceError
            },
            system: systemInfo
        };
        
        // If workspace is inaccessible, return 503
        if (workspaceStatus === 'inaccessible') {
            return res.status(503).json({
                ...healthData,
                success: false,
                status: 'degraded',
                message: 'Server running but workspace inaccessible'
            });
        }
        
        res.json(healthData);
        
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            message: 'Health check failed',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// GET /api/health/detailed - Detailed health information
router.get('/detailed', async (req, res) => {
    try {
        const workspacePath = req.app.locals.workspacePath;
        
        // Get detailed workspace information
        let workspaceDetails = {
            accessible: false,
            folders: [],
            totalSize: 0,
            error: null
        };
        
        try {
            await fs.access(workspacePath);
            workspaceDetails.accessible = true;
            
            const items = await fs.readdir(workspacePath, { withFileTypes: true });
            
            for (const item of items) {
                if (item.isDirectory()) {
                    try {
                        const folderPath = path.join(workspacePath, item.name);
                        const stats = await fs.stat(folderPath);
                        
                        workspaceDetails.folders.push({
                            name: item.name,
                            created: stats.birthtime,
                            size: stats.size
                        });
                        
                        workspaceDetails.totalSize += stats.size;
                    } catch (error) {
                        console.warn(`Could not get stats for ${item.name}:`, error);
                    }
                }
            }
        } catch (error) {
            workspaceDetails.error = error.message;
        }
        
        // Get Node.js process information
        const processInfo = {
            pid: process.pid,
            version: process.version,
            platform: process.platform,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage()
        };
        
        // Get OS information
        const osInfo = {
            type: os.type(),
            platform: os.platform(),
            arch: os.arch(),
            release: os.release(),
            hostname: os.hostname(),
            uptime: os.uptime(),
            memory: {
                total: os.totalmem(),
                free: os.freemem()
            },
            cpus: os.cpus().length,
            loadavg: os.loadavg()
        };
        
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            workspace: workspaceDetails,
            process: processInfo,
            system: osInfo
        });
        
    } catch (error) {
        console.error('Detailed health check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get detailed health information',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;