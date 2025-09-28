#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Get command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Synchronous Indexing Tool
=========================

Usage:
  node scripts/sync-index.js <project-path> [options]

Options:
  --env <file-path>      Specify .env configuration file path (default: ./.env)
  --clean                Clean existing index before re-indexing
  --force                Force re-index even if project exists
  --help, -h             Show this help message

Examples:
  node scripts/sync-index.js /path/to/project
  node scripts/sync-index.js /path/to/project --env /path/to/.env.production
  node scripts/sync-index.js /path/to/project --clean

Features:
  - Direct synchronous indexing using core package
  - Real-time progress display
  - Comprehensive error handling and logging
  - Immediate feedback on indexing results

Note: This is a synchronous operation that will block until completion.
`);
    process.exit(0);
}

// Parse arguments
const projectPath = args[0];
const envIndex = args.indexOf('--env');
const envFile = envIndex !== -1 && envIndex + 1 < args.length ? args[envIndex + 1] : './.env';

const options = {
    clean: args.includes('--clean'),
    force: args.includes('--force'),
    envFile: envFile
};

// Load environment variables
function loadEnvironmentConfig(envFile) {
    const resolvedEnvFile = path.resolve(envFile);

    if (!fs.existsSync(resolvedEnvFile)) {
        console.error(`❌ Error: Configuration file not found: ${resolvedEnvFile}`);
        console.log('💡 Tip: Create .env file with the following configuration:');
        console.log(`
ZILLIZ_ENDPOINT=your_zilliz_endpoint
ZILLIZ_TOKEN=your_zilliz_token
OPENAI_API_KEY=your_openai_api_key
EMBEDDING_MODEL=text-embedding-3-small
`);
        process.exit(1);
    }

    console.log(`📄 Using configuration file: ${resolvedEnvFile}`);

    // Read .env file
    try {
        const envContent = fs.readFileSync(resolvedEnvFile, 'utf8');
        const envVars = {};

        envContent.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    envVars[key.trim()] = valueParts.join('=').trim();
                }
            }
        });

        // Validate required configuration
        const requiredKeys = ['ZILLIZ_ENDPOINT', 'ZILLIZ_TOKEN'];
        const missingKeys = requiredKeys.filter(key =>
            !envVars[key] && !envVars[key.replace('ZILLIZ', 'MILVUS')]
        );

        if (missingKeys.length > 0) {
            console.error(`❌ Error: Missing required configuration: ${missingKeys.join(', ')}`);
            console.log('💡 Please add these configuration items to .env file');
            process.exit(1);
        }

        // Validate embedding model configuration
        const hasEmbeddingConfig = envVars['OPENAI_API_KEY'] ||
                                 envVars['GOOGLE_API_KEY'] ||
                                 envVars['VOYAGE_API_KEY'] ||
                                 envVars['OLLAMA_ENDPOINT'];

        if (!hasEmbeddingConfig) {
            console.warn('⚠️  Warning: No embedding model API key detected. You may need one of:');
            console.warn('   - OPENAI_API_KEY');
            console.warn('   - GOOGLE_API_KEY');
            console.warn('   - VOYAGE_API_KEY');
            console.warn('   - OLLAMA_ENDPOINT');
        }

        return envVars;
    } catch (error) {
        console.error(`❌ Error: Cannot read configuration file: ${error.message}`);
        process.exit(1);
    }
}

// Validate project path
function validateProjectPath(projectPath) {
    if (!projectPath) {
        console.error('❌ Error: Project path is required');
        process.exit(1);
    }

    const resolvedPath = path.resolve(projectPath);

    if (!fs.existsSync(resolvedPath)) {
        console.error(`❌ Error: Project path does not exist: ${resolvedPath}`);
        process.exit(1);
    }

    if (!fs.statSync(resolvedPath).isDirectory()) {
        console.error(`❌ Error: Path is not a directory: ${resolvedPath}`);
        process.exit(1);
    }

    return resolvedPath;
}

// Get snapshot file path
function getSnapshotPath() {
    const contextDir = path.join(os.homedir(), '.context');
    return path.join(contextDir, 'mcp-codebase-snapshot.json');
}

// Read snapshot file
function readSnapshot() {
    const snapshotPath = getSnapshotPath();

    if (!fs.existsSync(snapshotPath)) {
        return { codebases: {} };
    }

    try {
        const content = fs.readFileSync(snapshotPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.warn(`⚠️  Warning: Cannot read snapshot file: ${error.message}`);
        return { codebases: {} };
    }
}

// Write snapshot file
function writeSnapshot(snapshot) {
    const snapshotPath = getSnapshotPath();
    const contextDir = path.dirname(snapshotPath);

    // Ensure directory exists
    if (!fs.existsSync(contextDir)) {
        fs.mkdirSync(contextDir, { recursive: true });
    }

    try {
        fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
        return true;
    } catch (error) {
        console.error(`❌ Error: Cannot write snapshot file: ${error.message}`);
        return false;
    }
}

// Clean project index
function cleanProjectIndex(projectPath, snapshot) {
    const normalizedPath = path.normalize(projectPath);

    if (typeof snapshot.codebases === 'object') {
        if (snapshot.codebases[normalizedPath]) {
            delete snapshot.codebases[normalizedPath];
            console.log(`🧹 Cleaned existing index record: ${normalizedPath}`);
        }
    }

    return snapshot;
}

// Main indexing function
async function performSyncIndexing(projectPath, envVars) {
    console.log(`🚀 Starting synchronous indexing for: ${projectPath}`);

    // Set environment variables
    Object.assign(process.env, envVars);

    try {
        // Dynamic import of core package
        const corePath = path.join(__dirname, '..', 'packages', 'core', 'dist', 'index.js');

        if (!fs.existsSync(corePath)) {
            throw new Error('Core package not built. Please run: pnpm build:core');
        }

        console.log('📦 Loading Claude Context core package...');
        const { Context, MilvusVectorDatabase, OpenAIEmbedding } = require(corePath);

        // Initialize embedding provider
        console.log('🧠 Initializing embedding provider...');
        const embedding = new OpenAIEmbedding({
            apiKey: envVars.OPENAI_API_KEY,
            model: envVars.EMBEDDING_MODEL || 'text-embedding-3-small',
            baseURL: envVars.OPENAI_BASE_URL,
            dimensions: envVars.EMBEDDING_DIMENSIONS ? parseInt(envVars.EMBEDDING_DIMENSIONS) : undefined
        });

        // Initialize vector database
        console.log('🗄️  Initializing vector database...');
        const vectorDatabase = new MilvusVectorDatabase({
            endpoint: envVars.ZILLIZ_ENDPOINT || envVars.MILVUS_ENDPOINT,
            token: envVars.ZILLIZ_TOKEN || envVars.MILVUS_TOKEN
        });

        // Create context instance
        console.log('⚙️  Creating context instance...');
        const context = new Context({
            embedding,
            vectorDatabase
        });

        // Progress tracking
        let lastUpdate = Date.now();
        const progressCallback = (progress) => {
            const now = Date.now();
            if (now - lastUpdate > 1000) { // Update every second
                console.log(`📊 ${progress.phase} - ${progress.percentage}% (${progress.current}/${progress.total})`);
                lastUpdate = now;
            }
        };

        // Start indexing
        console.log('🔍 Starting codebase indexing...');
        const startTime = Date.now();

        const stats = await context.indexCodebase(projectPath, progressCallback, options.force);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n🎉 Indexing completed successfully!');
        console.log(`📈 Statistics:`);
        console.log(`   - Indexed files: ${stats.indexedFiles}`);
        console.log(`   - Total chunks: ${stats.totalChunks}`);
        console.log(`   - Status: ${stats.status}`);
        console.log(`   - Duration: ${duration}s`);

        // Update snapshot
        let snapshot = readSnapshot();
        const normalizedPath = path.normalize(projectPath);

        if (!snapshot.codebases) {
            snapshot.codebases = {};
        }

        snapshot.codebases[normalizedPath] = {
            status: stats.status === 'completed' ? 'indexed' : 'partial',
            progress: 100,
            totalFiles: stats.indexedFiles,
            indexedFiles: stats.indexedFiles,
            totalChunks: stats.totalChunks,
            indexedChunks: stats.totalChunks,
            lastUpdated: new Date().toISOString(),
            version: '2.0'
        };

        if (writeSnapshot(snapshot)) {
            console.log('📝 Updated project snapshot');
        }

        return stats;

    } catch (error) {
        console.error('\n❌ Indexing failed!');
        console.error(`💥 Error: ${error.message}`);

        if (error.stack) {
            console.error('\n🔍 Stack trace:');
            console.error(error.stack);
        }

        // Update snapshot with error status
        let snapshot = readSnapshot();
        const normalizedPath = path.normalize(projectPath);

        if (!snapshot.codebases) {
            snapshot.codebases = {};
        }

        snapshot.codebases[normalizedPath] = {
            status: 'failed',
            progress: 0,
            lastUpdated: new Date().toISOString(),
            error: error.message,
            version: '2.0'
        };

        writeSnapshot(snapshot);

        throw error;
    }
}

// Main function
async function main() {
    try {
        const resolvedPath = validateProjectPath(projectPath);
        console.log(`📁 Project path: ${resolvedPath}`);

        // Load environment variables
        const envVars = loadEnvironmentConfig(options.envFile);

        // Read current snapshot
        let snapshot = readSnapshot();

        // Check if project already exists
        const normalizedPath = path.normalize(resolvedPath);
        const existingProject = snapshot.codebases && snapshot.codebases[normalizedPath];

        if (existingProject && !options.force && !options.clean) {
            console.log('⚠️  Project already exists in index');
            console.log(`   Status: ${existingProject.status}`);
            console.log(`   Progress: ${existingProject.progress || 0}%`);
            console.log('💡 Use --force to force re-index, or --clean to clean and re-index');
            process.exit(0);
        }

        // Clean existing index if needed
        if (options.clean || options.force) {
            snapshot = cleanProjectIndex(resolvedPath, snapshot);
        }

        // Perform synchronous indexing
        const stats = await performSyncIndexing(resolvedPath, envVars);

        console.log('\n✅ Synchronous indexing completed successfully!');
        console.log('💡 Use the following commands to monitor:');
        console.log(`   pnpm check:index --path "${resolvedPath}"`);
        console.log(`   pnpm logs --latest ${path.basename(resolvedPath)}`);

    } catch (error) {
        console.error(`\n❌ Operation failed: ${error.message}`);
        process.exit(1);
    }
}

// Run main function
main().catch(error => {
    console.error(`❌ Unhandled error: ${error.message}`);
    process.exit(1);
});