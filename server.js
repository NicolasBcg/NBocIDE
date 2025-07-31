// Server/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

// Import route modules
const folderRoutes = require('./routes/file_system_endpoints');


const app = express();
const PORT = process.env.PORT || 3000;

// Workspace path (relative to server directory)
const WORKSPACE_PATH = path.join(__dirname, 'Workspace');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Make workspace path available to routes
app.locals.workspacePath = WORKSPACE_PATH;

// Initialize workspace directory
async function initializeWorkspace() {
    try {
        await fs.access(WORKSPACE_PATH);
        console.log('✅ Workspace directory exists');
    } catch (error) {
        try {
            await fs.mkdir(WORKSPACE_PATH, { recursive: true });
            console.log('✅ Workspace directory created');
        } catch (createError) {
            console.error('❌ Failed to create Workspace directory:', createError);
            process.exit(1);
        }
    }
}

// API Routes
app.use('/api/folders', folderRoutes);


// Default route - serve main frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: `API endpoint ${req.originalUrl} not found`
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Server Error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
async function startServer() {
    try {
        await initializeWorkspace();
        
        app.listen(PORT, () => {
            console.log('\n🚀 ===== IDE SERVER STARTED =====');
            console.log(`📡 Server: http://localhost:${PORT}`);
            console.log(`🌐 Frontend: http://localhost:${PORT}`);
            console.log(`🔌 API Base: http://localhost:${PORT}/api`);
            console.log(`📁 Workspace: ${WORKSPACE_PATH}`);
            console.log('=====================================\n');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Server shutting down gracefully...');
    process.exit(0);
});

startServer().catch(console.error);