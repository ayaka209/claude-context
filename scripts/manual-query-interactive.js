#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');
const readline = require('readline');

// Load environment configuration
const envPath = path.join(__dirname, '..', '.env');
console.log(`📄 Using configuration file: ${envPath}`);
dotenv.config({ path: envPath });

// Load Claude Context core package
console.log('📦 Loading Claude Context core package...');
const { Context } = require('../packages/core/dist/index.js');
const { MilvusVectorDatabase } = require('../packages/core/dist/vectordb/milvus-vectordb.js');
const { OpenAIEmbedding } = require('../packages/core/dist/embedding/openai-embedding.js');

// Global state
let context = null;
let vectorDatabase = null;
let embedding = null;
let rl = null;

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

    console.log(`🔗 Vector DB Endpoint: ${colorize(milvusEndpoint, 'blue')}`);
    console.log(`🔑 Token: Set (${colorize(milvusToken.substring(0, 10) + '...', 'yellow')})`);
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

    console.log(colorize('✅ Components initialized successfully!', 'green'));
}

function showWelcome() {
    console.log(`
${colorize('═══════════════════════════════════════════════════════════════', 'cyan')}
${colorize('🔧 Claude Context - Interactive Vector Database Query Tool', 'bright')}
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

${colorize('Utility Commands:', 'yellow')}
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
    `);
}

async function handleList() {
    try {
        console.log(colorize('📋 Listing collections...', 'blue'));
        const collections = await vectorDatabase.listCollections();

        if (collections.length === 0) {
            console.log(colorize('ℹ️  No collections found', 'yellow'));
            return;
        }

        console.log(`\n${colorize(`Found ${collections.length} collections:`, 'green')}`);
        collections.forEach((name, index) => {
            console.log(`  ${colorize(`${index + 1}.`, 'cyan')} ${name}`);
        });
        console.log();
    } catch (error) {
        console.error(colorize(`❌ Error: ${error.message}`, 'red'));
    }
}

async function handleInfo(collection) {
    if (!collection) {
        console.error(colorize('❌ Usage: info <collection_name>', 'red'));
        return;
    }

    try {
        console.log(colorize(`ℹ️  Checking collection: ${collection}`, 'blue'));
        const exists = await vectorDatabase.hasCollection(collection);

        if (exists) {
            console.log(colorize(`✅ Collection '${collection}' exists and is accessible`, 'green'));
        } else {
            console.log(colorize(`❌ Collection '${collection}' does not exist`, 'red'));
        }
    } catch (error) {
        console.error(colorize(`❌ Error: ${error.message}`, 'red'));
    }
}

async function handleQuery(collection, filter = '') {
    if (!collection) {
        console.error(colorize('❌ Usage: query <collection_name> [filter_expression]', 'red'));
        return;
    }

    try {
        console.log(colorize(`🔍 Querying collection: ${collection}`, 'blue'));
        if (filter) {
            console.log(colorize(`🎯 Filter: ${filter}`, 'blue'));
        }
        console.log(colorize(`📊 Limit: ${settings.limit}`, 'blue'));

        const outputFields = ['id', 'content', 'relativePath', 'startLine', 'endLine', 'fileExtension', 'metadata'];
        const results = await vectorDatabase.query(collection, filter, outputFields, settings.limit);

        console.log(`\n${colorize(`✅ Found ${results.length} results:`, 'green')}`);
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
        console.error(colorize(`❌ Error: ${error.message}`, 'red'));
    }
}

async function handleSearch(collection, query) {
    if (!collection || !query) {
        console.error(colorize('❌ Usage: search <collection_name> <query_text>', 'red'));
        return;
    }

    if (!process.env.OPENAI_API_KEY) {
        console.error(colorize('❌ OPENAI_API_KEY is required for hybrid search', 'red'));
        return;
    }

    try {
        console.log(colorize(`🔎 Performing hybrid search on: ${collection}`, 'blue'));
        console.log(colorize(`🎯 Query: "${query}"`, 'blue'));
        console.log(colorize(`📊 Limit: ${settings.limit}`, 'blue'));

        // Get embedding for the query
        const queryEmbedding = await embedding.embed(query);
        console.log(colorize(`✅ Generated ${queryEmbedding.dimension}D query vector`, 'green'));

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

        console.log(`\n${colorize(`✅ Found ${results.length} hybrid search results:`, 'green')}`);
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
        console.error(colorize(`❌ Error: ${error.message}`, 'red'));
    }
}

function handleLimit(limit) {
    const num = parseInt(limit);
    if (isNaN(num) || num <= 0 || num > 100) {
        console.error(colorize('❌ Limit must be a number between 1 and 100', 'red'));
        return;
    }

    settings.limit = num;
    console.log(colorize(`✅ Result limit set to ${num}`, 'green'));
}

function clearScreen() {
    console.clear();
    showWelcome();
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
            console.log(colorize('\n👋 Goodbye!', 'green'));
            process.exit(0);
            break;

        case 'clear':
        case 'cls':
            clearScreen();
            break;

        case 'status':
            showStatus();
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

        default:
            console.error(colorize(`❌ Unknown command: ${command}`, 'red'));
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
        console.log(colorize('\n👋 Session ended', 'green'));
        process.exit(0);
    });

    // Handle Ctrl+C gracefully
    rl.on('SIGINT', () => {
        rl.question(colorize('\nAre you sure you want to exit? (y/N) ', 'yellow'), (answer) => {
            if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                console.log(colorize('👋 Goodbye!', 'green'));
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
        console.log(colorize('🔧 Claude Context - Interactive Query Tool', 'bright'));
        console.log(colorize('═════════════════════════════════════════', 'cyan'));

        // Validate environment
        await validateEnvironment();

        // Initialize components
        await initializeComponents();

        // Start interactive session
        startInteractiveSession();

    } catch (error) {
        console.error(colorize(`\n❌ Initialization Error: ${error.message}`, 'red'));
        console.error(colorize('💡 Please check your environment configuration', 'yellow'));
        process.exit(1);
    }
}

// Handle unexpected errors
process.on('uncaughtException', (error) => {
    console.error(colorize(`\n💥 Uncaught Exception: ${error.message}`, 'red'));
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(colorize(`\n💥 Unhandled Rejection at: ${promise}`, 'red'));
    console.error(colorize(`Reason: ${reason}`, 'red'));
    process.exit(1);
});

// Run the main function
main();