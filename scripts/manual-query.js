#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');

// Load environment configuration
const envPath = path.join(__dirname, '..', '.env');
console.log(`📄 Using configuration file: ${envPath}`);
dotenv.config({ path: envPath });

// Load Claude Context core package
console.log('📦 Loading Claude Context core package...');
const { Context } = require('../packages/core/dist/index.js');
const { MilvusVectorDatabase } = require('../packages/core/dist/vectordb/milvus-vectordb.js');
const { OpenAIEmbedding } = require('../packages/core/dist/embedding/openai-embedding.js');

// Command line argument parsing
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        operation: 'list_collections',
        collection_name: null,
        query_text: null,
        filter_expr: null,
        limit: 10,
        output_fields: ['id', 'content', 'relativePath', 'startLine', 'endLine', 'fileExtension', 'metadata']
    };

    for (let i = 0; i < args.length; i += 2) {
        const key = args[i];
        const value = args[i + 1];

        switch (key) {
            case '--operation':
                options.operation = value;
                break;
            case '--collection':
                options.collection_name = value;
                break;
            case '--query':
                options.query_text = value;
                break;
            case '--filter':
                options.filter_expr = value;
                break;
            case '--limit':
                options.limit = parseInt(value) || 10;
                break;
            case '--help':
            case '-h':
                showHelp();
                process.exit(0);
            default:
                if (key.startsWith('--')) {
                    console.error(`❌ Unknown option: ${key}`);
                    process.exit(1);
                }
        }
    }

    return options;
}

function showHelp() {
    console.log(`
🔧 Manual Vector Database Query Tool

Usage:
  node scripts/manual-query.js [options]

Operations:
  --operation <type>    Operation type (default: list_collections)
                       Options: list_collections, collection_info, query, hybrid_search

Options:
  --collection <name>   Collection name (required for: collection_info, query, hybrid_search)
  --query <text>        Natural language query (required for: hybrid_search)
  --filter <expr>       Milvus filter expression (optional)
  --limit <number>      Maximum results (default: 10, max: 100)
  --help, -h           Show this help

Examples:
  # List all collections
  node scripts/manual-query.js --operation list_collections

  # Check if collection exists
  node scripts/manual-query.js --operation collection_info --collection "hybrid_code_chunks_abc123"

  # Perform hybrid search
  node scripts/manual-query.js --operation hybrid_search --collection "hybrid_code_chunks_abc123" --query "function definition"

  # Query with filter
  node scripts/manual-query.js --operation query --collection "hybrid_code_chunks_abc123" --filter "relativePath like 'src/%'" --limit 5

Environment Variables Required:
  ZILLIZ_ENDPOINT (or MILVUS_ENDPOINT)
  ZILLIZ_TOKEN (or MILVUS_TOKEN)
  OPENAI_API_KEY (for hybrid search)
  EMBEDDING_MODEL (optional, default: text-embedding-3-small)
  OPENAI_BASE_URL (optional, for custom endpoints)
`);
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

    console.log(`🔗 Vector DB Endpoint: ${milvusEndpoint}`);
    console.log(`🔑 Token: Set (${milvusToken.substring(0, 10)}...)`);
}

async function createContext() {
    // Initialize vector database
    const vectorDatabase = new MilvusVectorDatabase({
        address: process.env.ZILLIZ_ENDPOINT || process.env.MILVUS_ENDPOINT,
        token: process.env.ZILLIZ_TOKEN || process.env.MILVUS_TOKEN,
        username: process.env.MILVUS_USERNAME,
        password: process.env.MILVUS_PASSWORD,
        ssl: true
    });

    // Initialize embedding (for hybrid search)
    const embedding = new OpenAIEmbedding({
        apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        baseURL: process.env.OPENAI_BASE_URL,
        dimensions: process.env.EMBEDDING_DIMENSIONS ? parseInt(process.env.EMBEDDING_DIMENSIONS) : undefined
    });

    // Create context
    const context = new Context({
        embedding,
        vectorDatabase
    });

    return { context, vectorDatabase, embedding };
}

async function performOperation(options, context, vectorDatabase, embedding) {
    switch (options.operation) {
        case 'list_collections':
            console.log('📋 Listing all collections...');
            const collections = await vectorDatabase.listCollections();
            console.log(`\n✅ Found ${collections.length} collections:`);
            collections.forEach((name, index) => {
                console.log(`  ${index + 1}. ${name}`);
            });
            break;

        case 'collection_info':
            if (!options.collection_name) {
                throw new Error('--collection is required for collection_info operation');
            }

            console.log(`ℹ️  Getting collection info for: ${options.collection_name}`);
            const exists = await vectorDatabase.hasCollection(options.collection_name);

            if (exists) {
                console.log(`✅ Collection '${options.collection_name}' exists and is accessible`);
            } else {
                console.log(`❌ Collection '${options.collection_name}' does not exist`);
            }
            break;

        case 'query':
            if (!options.collection_name) {
                throw new Error('--collection is required for query operation');
            }

            console.log(`🔍 Querying collection: ${options.collection_name}`);
            console.log(`🎯 Filter: ${options.filter_expr || 'None'}`);
            console.log(`📊 Limit: ${options.limit}`);

            const queryResults = await vectorDatabase.query(
                options.collection_name,
                options.filter_expr || "",
                options.output_fields,
                options.limit
            );

            console.log(`\n✅ Found ${queryResults.length} results:`);
            queryResults.forEach((result, index) => {
                console.log(`\n--- Result ${index + 1} ---`);
                console.log(`ID: ${result.id}`);
                console.log(`Path: ${result.relativePath}`);
                console.log(`Lines: ${result.startLine}-${result.endLine}`);
                console.log(`Content: ${result.content?.substring(0, 200)}${result.content?.length > 200 ? '...' : ''}`);
            });
            break;

        case 'hybrid_search':
            if (!options.collection_name) {
                throw new Error('--collection is required for hybrid_search operation');
            }
            if (!options.query_text) {
                throw new Error('--query is required for hybrid_search operation');
            }
            if (!process.env.OPENAI_API_KEY) {
                throw new Error('OPENAI_API_KEY is required for hybrid_search operation');
            }

            console.log(`🔎 Performing hybrid search on: ${options.collection_name}`);
            console.log(`🎯 Query: "${options.query_text}"`);
            console.log(`🎯 Filter: ${options.filter_expr || 'None'}`);
            console.log(`📊 Limit: ${options.limit}`);

            // Get embedding for the query
            const queryEmbedding = await embedding.embed(options.query_text);
            console.log(`✅ Generated ${queryEmbedding.dimension}D query vector`);

            // Prepare hybrid search requests
            const searchRequests = [
                {
                    data: queryEmbedding.vector,
                    anns_field: "vector",
                    param: { "nprobe": 10 },
                    limit: options.limit
                },
                {
                    data: options.query_text,
                    anns_field: "sparse_vector",
                    param: { "drop_ratio_search": 0.2 },
                    limit: options.limit
                }
            ];

            const hybridResults = await vectorDatabase.hybridSearch(
                options.collection_name,
                searchRequests,
                {
                    rerank: { strategy: 'rrf', params: { k: 100 } },
                    limit: options.limit,
                    filterExpr: options.filter_expr
                }
            );

            console.log(`\n✅ Found ${hybridResults.length} hybrid search results:`);
            hybridResults.forEach((result, index) => {
                console.log(`\n--- Result ${index + 1} (Score: ${result.score.toFixed(4)}) ---`);
                console.log(`ID: ${result.document.id}`);
                console.log(`Path: ${result.document.relativePath}`);
                console.log(`Lines: ${result.document.startLine}-${result.document.endLine}`);
                console.log(`Content: ${result.document.content?.substring(0, 200)}${result.document.content?.length > 200 ? '...' : ''}`);
            });
            break;

        default:
            throw new Error(`Unknown operation: ${options.operation}`);
    }
}

async function main() {
    try {
        const options = parseArgs();

        console.log('🔧 Manual Vector Database Query Tool');
        console.log('=====================================');

        // Validate environment
        await validateEnvironment();

        // Create context and components
        const { context, vectorDatabase, embedding } = await createContext();

        // Perform the requested operation
        await performOperation(options, context, vectorDatabase, embedding);

        console.log('\n🎉 Operation completed successfully!');

    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        console.error('💡 Use --help for usage information');
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Operation cancelled by user');
    process.exit(0);
});

// Run the main function
main();