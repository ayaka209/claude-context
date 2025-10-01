#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');
const readline = require('readline');

// Load environment configuration
const envPath = path.join(__dirname, '..', '.env');
console.log(`Using configuration file: ${envPath}`);
dotenv.config({ path: envPath });

// Load Claude Context core package
console.log('Loading Claude Context core package...');
const { Context } = require('../packages/core/dist/index.js');
const { MilvusVectorDatabase } = require('../packages/core/dist/vectordb/milvus-vectordb.js');
const { OpenAIEmbedding } = require('../packages/core/dist/embedding/openai-embedding.js');
const fs = require('fs');

// Global state
let context = null;
let vectorDatabase = null;
let embedding = null;
let rl = null;
let workingDirectory = null; // Current working directory for project operations

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}

function createInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: colorize('claude-context> ', 'cyan')
    });
}

async function validateEnvironment() {
    // Check vector database config
    const milvusEndpoint = process.env.ZILLIZ_ENDPOINT || process.env.MILVUS_ENDPOINT;
    const milvusToken = process.env.ZILLIZ_TOKEN || process.env.MILVUS_TOKEN;

    if (!milvusEndpoint) {
        throw new Error('Missing ZILLIZ_ENDPOINT or MILVUS_ENDPOINT environment variable');
    }

    if (!milvusToken) {
        throw new Error('Missing ZILLIZ_TOKEN or MILVUS_TOKEN environment variable');
    }

    console.log(`Vector DB Endpoint: ${colorize(milvusEndpoint, 'blue')}`);
    console.log(`Token: Set (${colorize(milvusToken.substring(0, 10) + '...', 'yellow')})`);
}

async function initializeComponents() {
    // Initialize vector database
    vectorDatabase = new MilvusVectorDatabase({
        address: process.env.ZILLIZ_ENDPOINT || process.env.MILVUS_ENDPOINT,
        token: process.env.ZILLIZ_TOKEN || process.env.MILVUS_TOKEN,
        username: process.env.MILVUS_USERNAME,
        password: process.env.MILVUS_PASSWORD,
        ssl: true
    });

    // Initialize embedding (for hybrid search)
    embedding = new OpenAIEmbedding({
        apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        baseURL: process.env.OPENAI_BASE_URL,
        dimensions: process.env.EMBEDDING_DIMENSIONS ? parseInt(process.env.EMBEDDING_DIMENSIONS) : undefined
    });

    // Create context
    context = new Context({
        embedding,
        vectorDatabase
    });

    console.log(colorize('Components initialized successfully!', 'green'));
}

function showWelcome() {
    console.log(`
${colorize('═══════════════════════════════════════════════════════════════', 'cyan')}
${colorize('Claude Context - Interactive Vector Database Query Tool', 'bright')}
${colorize('═══════════════════════════════════════════════════════════════', 'cyan')}

Welcome to the interactive query interface! Type ${colorize('help', 'yellow')} for available commands.
Type ${colorize('exit', 'yellow')} or ${colorize('quit', 'yellow')} to leave the session.
    `);
}

function showHelp() {
    console.log(`
${colorize('Available Commands:', 'bright')}
${colorize('─────────────────', 'cyan')}

${colorize('Basic Operations:', 'yellow')}
  ${colorize('list', 'green')}                          - List all collections
  ${colorize('info <collection>', 'green')}             - Check if collection exists
  ${colorize('collections', 'green')}                   - Alias for 'list'

${colorize('Query Operations:', 'yellow')}
  ${colorize('query <collection> [filter]', 'green')}   - Query collection with optional filter
  ${colorize('search <collection> <query>', 'green')}   - Hybrid search in collection
  ${colorize('find <collection> <query>', 'green')}     - Alias for 'search'

${colorize('Management Operations:', 'yellow')}
  ${colorize('drop <collection>', 'green')}             - Drop/delete a collection (DANGEROUS)
  ${colorize('clearindex <project-path>', 'green')}     - Clear project index (collection + cache)
  ${colorize('reindex <project-path>', 'green')}        - Re-index a project (clears and rebuilds)
  ${colorize('project <project-path>', 'green')}        - Show project metadata (.context/project.json)

${colorize('Utility Commands:', 'yellow')}
  ${colorize('cd <project-path>', 'green')}             - Set working directory for project operations
  ${colorize('pwd', 'green')}                           - Show current working directory
  ${colorize('limit <number>', 'green')}                - Set result limit (default: 10)
  ${colorize('status', 'green')}                        - Show current settings
  ${colorize('clear', 'green')}                         - Clear screen
  ${colorize('help', 'green')}                          - Show this help
  ${colorize('exit', 'green')} or ${colorize('quit', 'green')}                   - Exit the tool

${colorize('Examples:', 'yellow')}
  ${colorize('> list', 'blue')}
  ${colorize('> info hybrid_code_chunks_abc123', 'blue')}
  ${colorize('> limit 20', 'blue')}
  ${colorize('> query hybrid_code_chunks_abc123 relativePath like "src/%"', 'blue')}
  ${colorize('> search hybrid_code_chunks_abc123 function definition', 'blue')}
  ${colorize('> find hybrid_code_chunks_abc123 error handling', 'blue')}
  ${colorize('> drop hybrid_code_chunks_abc123', 'blue')}
  ${colorize('> clearindex /path/to/project', 'blue')}
  ${colorize('> reindex /path/to/project', 'blue')}
  ${colorize('> project /path/to/project', 'blue')}
    `);
}

// Settings
let settings = {
    limit: 10
};

function showStatus() {
    console.log(`
${colorize('Current Settings:', 'bright')}
${colorize('────────────────', 'cyan')}
  Result Limit: ${colorize(settings.limit, 'yellow')}
  Embedding Model: ${colorize(process.env.EMBEDDING_MODEL || 'text-embedding-3-small', 'yellow')}
  Vector DB: ${colorize((process.env.ZILLIZ_ENDPOINT || process.env.MILVUS_ENDPOINT || '').split('.')[0] + '...', 'yellow')}
  Working Directory: ${colorize(workingDirectory || '(not set)', 'yellow')}
    `);
}

function handleCd(projectPath) {
    if (!projectPath) {
        console.error(colorize('Usage: cd <project_path>', 'red'));
        return;
    }

    const resolvedPath = path.resolve(projectPath);
    if (!fs.existsSync(resolvedPath)) {
        console.error(colorize(`Error: Path does not exist: ${resolvedPath}`, 'red'));
        return;
    }

    if (!fs.statSync(resolvedPath).isDirectory()) {
        console.error(colorize(`Error: Path is not a directory: ${resolvedPath}`, 'red'));
        return;
    }

    workingDirectory = resolvedPath;
    console.log(colorize(`Working directory set to: ${workingDirectory}`, 'green'));
}

function handlePwd() {
    if (workingDirectory) {
        console.log(colorize(`Current working directory: ${workingDirectory}`, 'blue'));
    } else {
        console.log(colorize('No working directory set. Use "cd <path>" to set one.', 'yellow'));
    }
}

async function handleList() {
    try {
        console.log(colorize('Listing collections...', 'blue'));
        const collections = await vectorDatabase.listCollections();

        if (collections.length === 0) {
            console.log(colorize('No collections found', 'yellow'));
            return;
        }

        console.log(`\n${colorize(`Found ${collections.length} collections:`, 'green')}`);
        collections.forEach((name, index) => {
            console.log(`  ${colorize(`${index + 1}.`, 'cyan')} ${name}`);
        });
        console.log();
    } catch (error) {
        console.error(colorize(`Error: ${error.message}`, 'red'));
    }
}

async function handleInfo(collection) {
    if (!collection) {
        console.error(colorize('Usage: info <collection_name>', 'red'));
        return;
    }

    try {
        console.log(colorize(`Checking collection: ${collection}`, 'blue'));
        const exists = await vectorDatabase.hasCollection(collection);

        if (exists) {
            console.log(colorize(`Collection '${collection}' exists and is accessible`, 'green'));
        } else {
            console.log(colorize(`Collection '${collection}' does not exist`, 'red'));
        }
    } catch (error) {
        console.error(colorize(`Error: ${error.message}`, 'red'));
    }
}

async function handleQuery(collection, filter = '') {
    if (!collection) {
        console.error(colorize('Usage: query <collection_name> [filter_expression]', 'red'));
        return;
    }

    try {
        console.log(colorize(`🔍 Querying collection: ${collection}`, 'blue'));
        if (filter) {
            console.log(colorize(`Filter: ${filter}`, 'blue'));
        }
        console.log(colorize(`Limit: ${settings.limit}`, 'blue'));

        const outputFields = ['id', 'content', 'relativePath', 'startLine', 'endLine', 'fileExtension', 'metadata'];
        const results = await vectorDatabase.query(collection, filter, outputFields, settings.limit);

        console.log(`\n${colorize(`Found ${results.length} results:`, 'green')}`);
        results.forEach((result, index) => {
            console.log(`\n${colorize(`--- Result ${index + 1} ---`, 'cyan')}`);
            console.log(`${colorize('ID:', 'yellow')} ${result.id}`);
            console.log(`${colorize('Path:', 'yellow')} ${result.relativePath}`);
            console.log(`${colorize('Lines:', 'yellow')} ${result.startLine}-${result.endLine}`);
            const contentPreview = result.content?.substring(0, 200) + (result.content?.length > 200 ? '...' : '');
            console.log(`${colorize('Content:', 'yellow')} ${contentPreview}`);
        });
        console.log();
    } catch (error) {
        console.error(colorize(`Error: ${error.message}`, 'red'));
    }
}

async function handleSearch(collection, query) {
    if (!collection || !query) {
        console.error(colorize('Usage: search <collection_name> <query_text>', 'red'));
        return;
    }

    if (!process.env.OPENAI_API_KEY) {
        console.error(colorize('OPENAI_API_KEY is required for hybrid search', 'red'));
        return;
    }

    try {
        console.log(colorize(`Performing hybrid search on: ${collection}`, 'blue'));
        console.log(colorize(`Query: "${query}"`, 'blue'));
        console.log(colorize(`Limit: ${settings.limit}`, 'blue'));

        // Get embedding for the query
        const queryEmbedding = await embedding.embed(query);
        console.log(colorize(`Generated ${queryEmbedding.dimension}D query vector`, 'green'));

        // Prepare hybrid search requests
        const searchRequests = [
            {
                data: queryEmbedding.vector,
                anns_field: "vector",
                param: { "nprobe": 10 },
                limit: settings.limit
            },
            {
                data: query,
                anns_field: "sparse_vector",
                param: { "drop_ratio_search": 0.2 },
                limit: settings.limit
            }
        ];

        const results = await vectorDatabase.hybridSearch(
            collection,
            searchRequests,
            {
                rerank: { strategy: 'rrf', params: { k: 100 } },
                limit: settings.limit
            }
        );

        console.log(`\n${colorize(`Found ${results.length} hybrid search results:`, 'green')}`);
        results.forEach((result, index) => {
            console.log(`\n${colorize(`--- Result ${index + 1} (Score: ${result.score.toFixed(4)}) ---`, 'cyan')}`);
            console.log(`${colorize('ID:', 'yellow')} ${result.document.id}`);
            console.log(`${colorize('Path:', 'yellow')} ${result.document.relativePath}`);
            console.log(`${colorize('Lines:', 'yellow')} ${result.document.startLine}-${result.document.endLine}`);
            const contentPreview = result.document.content?.substring(0, 200) + (result.document.content?.length > 200 ? '...' : '');
            console.log(`${colorize('Content:', 'yellow')} ${contentPreview}`);
        });
        console.log();
    } catch (error) {
        console.error(colorize(`Error: ${error.message}`, 'red'));
    }
}

function handleLimit(limit) {
    const num = parseInt(limit);
    if (isNaN(num) || num <= 0 || num > 100) {
        console.error(colorize('Limit must be a number between 1 and 100', 'red'));
        return;
    }

    settings.limit = num;
    console.log(colorize(`Result limit set to ${num}`, 'green'));
}

function clearScreen() {
    console.clear();
    showWelcome();
}

async function handleDrop(collection) {
    if (!collection) {
        console.error(colorize('Usage: drop <collection_name>', 'red'));
        return;
    }

    try {
        // Check if collection exists
        console.log(colorize(`🔍 Checking if collection '${collection}' exists...`, 'blue'));
        const exists = await vectorDatabase.hasCollection(collection);

        if (!exists) {
            console.log(colorize(`Collection '${collection}' does not exist`, 'red'));
            return;
        }

        // Confirm before dropping
        return new Promise((resolve) => {
            rl.question(colorize(`Are you sure you want to DROP collection '${collection}'? This cannot be undone! (yes/NO): `, 'yellow'), async (answer) => {
                if (answer.toLowerCase() === 'yes') {
                    try {
                        console.log(colorize(`Dropping collection '${collection}'...`, 'blue'));
                        await vectorDatabase.dropCollection(collection);
                        console.log(colorize(`Successfully dropped collection '${collection}'`, 'green'));
                    } catch (error) {
                        console.error(colorize(`Error dropping collection: ${error.message}`, 'red'));
                    }
                } else {
                    console.log(colorize('Operation cancelled', 'yellow'));
                }
                resolve();
            });
        });
    } catch (error) {
        console.error(colorize(`Error: ${error.message}`, 'red'));
    }
}

async function handleProject(projectPath) {
    // Use working directory if no path provided
    if (!projectPath) {
        if (!workingDirectory) {
            console.error(colorize('Usage: project <project_path>', 'red'));
            console.error(colorize('   Or set working directory first with: cd <project_path>', 'yellow'));
            return;
        }
        projectPath = workingDirectory;
    }

    try {
        // Validate project path
        const resolvedPath = path.resolve(projectPath);
        if (!fs.existsSync(resolvedPath)) {
            console.error(colorize(`Error: Project path does not exist: ${resolvedPath}`, 'red'));
            return;
        }

        if (!fs.statSync(resolvedPath).isDirectory()) {
            console.error(colorize(`Error: Path is not a directory: ${resolvedPath}`, 'red'));
            return;
        }

        // Check for .context/project.json
        const projectJsonPath = path.join(resolvedPath, '.context', 'project.json');
        if (!fs.existsSync(projectJsonPath)) {
            console.log(colorize(`\nNo project metadata found at: ${projectJsonPath}`, 'yellow'));
            console.log(colorize('This project has not been indexed yet.', 'yellow'));
            console.log(colorize(`\nTo index this project, use: ${colorize('reindex ' + projectPath, 'cyan')}`, 'blue'));
            return;
        }

        // Read and parse project.json
        const projectData = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));

        // Display project metadata
        console.log(`\n${colorize('═══════════════════════════════════════════', 'cyan')}`);
        console.log(colorize('Project Metadata', 'bright'));
        console.log(colorize('═══════════════════════════════════════════', 'cyan'));
        console.log();

        console.log(colorize('Basic Information:', 'yellow'));
        console.log(`  ${colorize('Project Path:', 'cyan')} ${projectData.projectPath || 'N/A'}`);
        console.log(`  ${colorize('Collection Name:', 'cyan')} ${projectData.collectionName || 'N/A'}`);
        console.log(`  ${colorize('Version:', 'cyan')} ${projectData.version || 'N/A'}`);
        console.log();

        console.log(colorize('Embedding Configuration:', 'yellow'));
        console.log(`  ${colorize('Model:', 'cyan')} ${projectData.embeddingModel || 'N/A'}`);
        console.log(`  ${colorize('Dimension:', 'cyan')} ${projectData.embeddingDimension || 'N/A'}`);
        console.log(`  ${colorize('Hybrid Mode:', 'cyan')} ${projectData.isHybrid ? colorize('Yes', 'green') : colorize('No', 'red')}`);
        console.log();

        console.log(colorize('Indexing Statistics:', 'yellow'));
        console.log(`  ${colorize('Files Indexed:', 'cyan')} ${projectData.indexedFileCount || 'N/A'}`);
        console.log(`  ${colorize('Total Chunks:', 'cyan')} ${projectData.totalChunks || 'N/A'}`);
        console.log();

        console.log(colorize('Timestamps:', 'yellow'));
        if (projectData.createdAt) {
            const createdDate = new Date(projectData.createdAt);
            console.log(`  ${colorize('Created:', 'cyan')} ${createdDate.toLocaleString()}`);
        }
        if (projectData.lastIndexed) {
            const lastIndexedDate = new Date(projectData.lastIndexed);
            console.log(`  ${colorize('Last Indexed:', 'cyan')} ${lastIndexedDate.toLocaleString()}`);
        }
        console.log();

        if (projectData.gitRepoIdentifier) {
            console.log(colorize('Git Information:', 'yellow'));
            console.log(`  ${colorize('Repository:', 'cyan')} ${projectData.gitRepoIdentifier}`);
            console.log();
        }

        // Check if collection exists in database
        const exists = await vectorDatabase.hasCollection(projectData.collectionName);
        console.log(colorize('Collection Status:', 'yellow'));
        if (exists) {
            console.log(`  ${colorize('Collection exists in vector database', 'green')}`);
        } else {
            console.log(`  ${colorize('Collection not found in vector database', 'red')}`);
            console.log(`  ${colorize('The metadata exists but the collection may have been deleted.', 'yellow')}`);
        }
        console.log();

        // Check if project.json is tracked by git
        const { execSync } = require('child_process');
        try {
            // Check if directory is a git repository
            execSync('git rev-parse --git-dir', { cwd: resolvedPath, stdio: 'ignore' });

            // Check if .context/project.json is tracked by git
            const relativePath = '.context/project.json';
            const gitStatus = execSync(`git ls-files --error-unmatch "${relativePath}"`, {
                cwd: resolvedPath,
                stdio: 'pipe',
                encoding: 'utf-8'
            }).trim();

            if (gitStatus) {
                console.log(colorize('Git Tracking:', 'yellow'));
                console.log(`  ${colorize('project.json is tracked in git (recommended for team collaboration)', 'green')}`);
                console.log();
            }
        } catch (gitError) {
            // Git command failed - either not a git repo or file is not tracked
            try {
                // Verify it's actually a git repo
                execSync('git rev-parse --git-dir', { cwd: resolvedPath, stdio: 'ignore' });

                // It's a git repo but file is not tracked
                console.log(colorize('Git Tracking:', 'yellow'));
                console.log(`  ${colorize('project.json is NOT tracked in git', 'red')}`);
                console.log();
                console.log(colorize('Recommendation:', 'bright'));
                console.log(`  ${colorize('Consider committing .context/project.json to git for team collaboration.', 'yellow')}`);
                console.log(`  ${colorize('This ensures all team members use the same collection name.', 'yellow')}`);
                console.log();
                console.log(colorize('To track it:', 'cyan'));
                console.log(`  ${colorize('git add .context/project.json', 'blue')}`);
                console.log(`  ${colorize('git commit -m "chore: Add Claude Context project metadata"', 'blue')}`);
                console.log();
            } catch (notGitRepoError) {
                // Not a git repository, skip git tracking check silently
            }
        }

    } catch (error) {
        console.error(colorize(`Error reading project metadata: ${error.message}`, 'red'));
    }
}

async function handleClearIndex(projectPath) {
    // Use working directory if no path provided
    if (!projectPath) {
        if (!workingDirectory) {
            console.error(colorize('Usage: clearindex <project_path>', 'red'));
            console.error(colorize('   Or set working directory first with: cd <project_path>', 'yellow'));
            return;
        }
        projectPath = workingDirectory;
    }

    try {
        // Validate project path
        const resolvedPath = path.resolve(projectPath);
        if (!fs.existsSync(resolvedPath)) {
            console.error(colorize(`Error: Project path does not exist: ${resolvedPath}`, 'red'));
            return;
        }

        if (!fs.statSync(resolvedPath).isDirectory()) {
            console.error(colorize(`Error: Path is not a directory: ${resolvedPath}`, 'red'));
            return;
        }

        console.log(colorize(`Project path: ${resolvedPath}`, 'blue'));

        // Get the collection name that would be used for this project
        const collectionName = context.getCollectionName(resolvedPath);
        console.log(colorize(`Collection name: ${collectionName}`, 'blue'));

        // Check if collection exists
        const exists = await vectorDatabase.hasCollection(collectionName);
        if (!exists) {
            console.log(colorize(`Collection '${collectionName}' does not exist`, 'yellow'));
            console.log(colorize('Nothing to clear. Project may not have been indexed yet.', 'yellow'));
            return;
        }

        // Confirm before clearing
        return new Promise((resolve) => {
            rl.question(colorize(`Are you sure you want to CLEAR the index for '${path.basename(resolvedPath)}'? This will delete all indexed data. (yes/NO): `, 'yellow'), async (answer) => {
                if (answer.toLowerCase() === 'yes') {
                    try {
                        console.log(colorize('\nStarting index cleanup...', 'bright'));

                        // Clear the index (drops collection, clears cache, clears metadata)
                        await context.clearIndex(resolvedPath);

                        console.log(colorize('\nIndex cleared successfully!', 'green'));
                        console.log(colorize('The following have been removed:', 'cyan'));
                        console.log(colorize(`  - Vector database collection: ${collectionName}`, 'cyan'));
                        console.log(colorize(`  - Project metadata: .context/project.json`, 'cyan'));
                        console.log(colorize(`  - Hash cache: .context/file-hashes.json`, 'cyan'));
                        console.log(colorize(`  - Merkle tree snapshot`, 'cyan'));
                        console.log();
                        console.log(colorize('To re-index this project, use:', 'blue'));
                        console.log(colorize(`  reindex ${projectPath}`, 'cyan'));
                    } catch (error) {
                        console.error(colorize(`\nError during index cleanup: ${error.message}`, 'red'));
                        if (error.stack) {
                            console.error(colorize(`Stack trace: ${error.stack}`, 'red'));
                        }
                    }
                } else {
                    console.log(colorize('Operation cancelled', 'yellow'));
                }
                resolve();
            });
        });
    } catch (error) {
        console.error(colorize(`Error: ${error.message}`, 'red'));
    }
}

async function handleReindex(projectPath) {
    // Use working directory if no path provided
    if (!projectPath) {
        if (!workingDirectory) {
            console.error(colorize('Usage: reindex <project_path>', 'red'));
            console.error(colorize('   Or set working directory first with: cd <project_path>', 'yellow'));
            return;
        }
        projectPath = workingDirectory;
    }

    try {
        // Validate project path
        const resolvedPath = path.resolve(projectPath);
        if (!fs.existsSync(resolvedPath)) {
            console.error(colorize(`Error: Project path does not exist: ${resolvedPath}`, 'red'));
            return;
        }

        if (!fs.statSync(resolvedPath).isDirectory()) {
            console.error(colorize(`Error: Path is not a directory: ${resolvedPath}`, 'red'));
            return;
        }

        console.log(colorize(`Project path: ${resolvedPath}`, 'blue'));

        // Get the collection name that would be used for this project
        const collectionName = context.getCollectionName(resolvedPath);
        console.log(colorize(`Collection name: ${collectionName}`, 'blue'));

        // Check if collection exists
        const exists = await vectorDatabase.hasCollection(collectionName);
        if (exists) {
            console.log(colorize(`Collection '${collectionName}' already exists and will be cleared`, 'yellow'));
        }

        // Confirm before re-indexing
        return new Promise((resolve) => {
            rl.question(colorize(`Re-index project '${path.basename(resolvedPath)}'? This will clear existing data. (yes/NO): `, 'yellow'), async (answer) => {
                if (answer.toLowerCase() === 'yes') {
                    try {
                        console.log(colorize('\n🚀 Starting re-indexing process...', 'bright'));
                        console.log(colorize('This may take several minutes depending on project size.\n', 'yellow'));

                        // Clear existing index
                        if (exists) {
                            console.log(colorize(`Clearing existing collection '${collectionName}'...`, 'blue'));
                            await context.clearIndex(resolvedPath);
                            console.log(colorize('Existing index cleared', 'green'));
                        }

                        // Re-index the project
                        console.log(colorize(`Indexing project: ${resolvedPath}`, 'blue'));
                        const startTime = Date.now();

                        await context.indexCodebase(resolvedPath);

                        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                        console.log(colorize(`\nRe-indexing completed successfully in ${duration}s!`, 'green'));
                        console.log(colorize(`Collection: ${collectionName}`, 'cyan'));
                    } catch (error) {
                        console.error(colorize(`\nError during re-indexing: ${error.message}`, 'red'));
                        if (error.stack) {
                            console.error(colorize(`Stack trace: ${error.stack}`, 'red'));
                        }
                    }
                } else {
                    console.log(colorize('Operation cancelled', 'yellow'));
                }
                resolve();
            });
        });
    } catch (error) {
        console.error(colorize(`Error: ${error.message}`, 'red'));
    }
}

async function processCommand(input) {
    const parts = input.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
        case '':
            // Empty command, do nothing
            break;

        case 'help':
        case 'h':
            showHelp();
            break;

        case 'exit':
        case 'quit':
        case 'q':
            console.log(colorize('\nGoodbye!', 'green'));
            process.exit(0);
            break;

        case 'clear':
        case 'cls':
            clearScreen();
            break;

        case 'status':
            showStatus();
            break;

        case 'cd':
            handleCd(args.slice(0).join(' '));
            break;

        case 'pwd':
            handlePwd();
            break;

        case 'limit':
            if (args.length === 0) {
                console.log(colorize(`Current limit: ${settings.limit}`, 'yellow'));
            } else {
                handleLimit(args[0]);
            }
            break;

        case 'list':
        case 'collections':
            await handleList();
            break;

        case 'info':
            await handleInfo(args[0]);
            break;

        case 'query':
            await handleQuery(args[0], args.slice(1).join(' '));
            break;

        case 'search':
        case 'find':
            await handleSearch(args[0], args.slice(1).join(' '));
            break;

        case 'drop':
            await handleDrop(args[0]);
            break;

        case 'reindex':
            await handleReindex(args.slice(0).join(' '));
            break;

        case 'project':
            await handleProject(args.slice(0).join(' '));
            break;

        case 'clearindex':
            await handleClearIndex(args.slice(0).join(' '));
            break;

        default:
            console.error(colorize(`Unknown command: ${command}`, 'red'));
            console.log(colorize('Type "help" for available commands', 'yellow'));
            break;
    }
}

function startInteractiveSession() {
    rl = createInterface();

    rl.on('line', async (input) => {
        await processCommand(input);
        rl.prompt();
    });

    rl.on('close', () => {
        console.log(colorize('\nSession ended', 'green'));
        process.exit(0);
    });

    // Handle Ctrl+C gracefully
    rl.on('SIGINT', () => {
        rl.question(colorize('\nAre you sure you want to exit? (y/N) ', 'yellow'), (answer) => {
            if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                console.log(colorize('Goodbye!', 'green'));
                process.exit(0);
            } else {
                rl.prompt();
            }
        });
    });

    showWelcome();
    rl.prompt();
}

async function main() {
    try {
        // Parse command-line arguments
        const args = process.argv.slice(2);

        // Check for --cwd or -C flag to set working directory
        let cwdIndex = args.findIndex(arg => arg === '--cwd' || arg === '-C');
        if (cwdIndex !== -1 && args[cwdIndex + 1]) {
            const cwdPath = args[cwdIndex + 1];
            const resolvedPath = path.resolve(cwdPath);

            if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
                workingDirectory = resolvedPath;
                // Remove --cwd and its value from args
                args.splice(cwdIndex, 2);
            } else {
                console.error(colorize(`Error: Invalid working directory: ${cwdPath}`, 'red'));
                process.exit(1);
            }
        }

        // Check if running in non-interactive mode (with command arguments)
        if (args.length > 0) {
            // Non-interactive mode: execute command directly
            console.log(colorize('Claude Context - Query Tool', 'bright'));
            console.log(colorize('═════════════════════════════════════════', 'cyan'));

            // Validate environment
            await validateEnvironment();

            // Initialize components
            await initializeComponents();

            // Show working directory if set
            if (workingDirectory) {
                console.log(colorize(`Working directory: ${workingDirectory}`, 'blue'));
            }

            // Execute the command
            const commandLine = args.join(' ');
            console.log(colorize(`\nExecuting: ${commandLine}\n`, 'cyan'));
            await processCommand(commandLine);

            // Exit after command execution
            process.exit(0);
        } else {
            // Interactive mode
            console.log(colorize('Claude Context - Interactive Query Tool', 'bright'));
            console.log(colorize('═════════════════════════════════════════', 'cyan'));

            // Validate environment
            await validateEnvironment();

            // Initialize components
            await initializeComponents();

            // Show working directory if set
            if (workingDirectory) {
                console.log(colorize(`Working directory: ${workingDirectory}`, 'blue'));
            }

            // Start interactive session
            startInteractiveSession();
        }

    } catch (error) {
        console.error(colorize(`\nInitialization Error: ${error.message}`, 'red'));
        console.error(colorize('Please check your environment configuration', 'yellow'));
        process.exit(1);
    }
}

// Handle unexpected errors
process.on('uncaughtException', (error) => {
    console.error(colorize(`\nUncaught Exception: ${error.message}`, 'red'));
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(colorize(`\nUnhandled Rejection at: ${promise}`, 'red'));
    console.error(colorize(`Reason: ${reason}`, 'red'));
    process.exit(1);
});

// Run the main function
main();