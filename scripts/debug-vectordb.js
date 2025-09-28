#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Vector Database Debug Tool
==========================

Usage:
  node scripts/debug-vectordb.js [options]

Options:
  --test-connection              Test basic database connection
  --test-insert                  Test inserting sample data
  --test-query                   Test querying existing data
  --check-collection <name>      Check specific collection details
  --check-schema <name>          Check collection schema
  --test-batch-insert           Test batch insert operation
  --analyze-failures            Analyze potential failure points
  --help, -h                    Show this help message

Examples:
  node scripts/debug-vectordb.js --test-connection
  node scripts/debug-vectordb.js --check-collection hybrid_code_chunks_f12bdcb4
  node scripts/debug-vectordb.js --test-insert
  node scripts/debug-vectordb.js --analyze-failures

Features:
  - Comprehensive connection testing
  - Sample data insertion testing
  - Schema validation
  - Error diagnosis and reporting
  - Detailed logging of all operations
`);
    process.exit(0);
}

// Load environment variables
function loadEnvironmentConfig() {
    const envFile = path.resolve('./.env');

    if (!fs.existsSync(envFile)) {
        console.error(`❌ Error: Configuration file not found: ${envFile}`);
        process.exit(1);
    }

    console.log(`📄 Using configuration file: ${envFile}`);

    try {
        const envContent = fs.readFileSync(envFile, 'utf8');
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

        // Set environment variables
        Object.assign(process.env, envVars);

        return envVars;
    } catch (error) {
        console.error(`❌ Error: Cannot read configuration file: ${error.message}`);
        process.exit(1);
    }
}

// Initialize vector database
async function initializeVectorDB() {
    console.log('📦 Loading Claude Context core package...');
    const corePath = path.join(__dirname, '..', 'packages', 'core', 'dist', 'index.js');

    if (!fs.existsSync(corePath)) {
        throw new Error('Core package not built. Please run: pnpm build:core');
    }

    const { MilvusVectorDatabase } = require(corePath);

    const vectorDatabase = new MilvusVectorDatabase({
        endpoint: process.env.ZILLIZ_ENDPOINT || process.env.MILVUS_ENDPOINT,
        token: process.env.ZILLIZ_TOKEN || process.env.MILVUS_TOKEN
    });

    return vectorDatabase;
}

// Test basic connection
async function testConnection() {
    console.log('\n🔗 Testing Vector Database Connection');
    console.log('====================================');

    try {
        const vectorDB = await initializeVectorDB();

        console.log('📡 Connecting to vector database...');

        // Test basic connectivity
        const collections = await vectorDB.listCollections();
        console.log(`✅ Connection successful! Found ${collections.length} collections:`);

        collections.forEach((collection, index) => {
            console.log(`   ${index + 1}. ${collection}`);
        });

        return true;
    } catch (error) {
        console.error(`❌ Connection failed: ${error.message}`);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

// Check collection details
async function checkCollection(collectionName) {
    console.log(`\n🗂️  Checking Collection: ${collectionName}`);
    console.log('=====================================');

    try {
        const vectorDB = await initializeVectorDB();

        // Check if collection exists
        const collections = await vectorDB.listCollections();
        if (!collections.includes(collectionName)) {
            console.error(`❌ Collection '${collectionName}' does not exist`);
            console.log('Available collections:', collections);
            return false;
        }

        console.log(`✅ Collection '${collectionName}' exists`);

        // Try to get collection info using raw client
        console.log('📊 Getting collection statistics...');

        // Access the raw Milvus client
        const client = vectorDB.client;

        if (client) {
            try {
                // Get collection info
                const collectionInfo = await client.describeCollection({
                    collection_name: collectionName
                });

                console.log('📋 Collection Info:');
                console.log(JSON.stringify(collectionInfo, null, 2));

                // Get collection statistics
                const stats = await client.getCollectionStatistics({
                    collection_name: collectionName
                });

                console.log('📈 Collection Statistics:');
                console.log(JSON.stringify(stats, null, 2));

                // Try to load collection
                const loadResult = await client.loadCollection({
                    collection_name: collectionName
                });

                console.log('🔄 Load Collection Result:');
                console.log(JSON.stringify(loadResult, null, 2));

            } catch (clientError) {
                console.error(`⚠️  Raw client operations failed: ${clientError.message}`);
            }
        }

        return true;
    } catch (error) {
        console.error(`❌ Collection check failed: ${error.message}`);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

// Test sample data insertion
async function testInsert() {
    console.log('\n🧪 Testing Sample Data Insertion');
    console.log('=================================');

    try {
        const vectorDB = await initializeVectorDB();

        // Create test collection name
        const testCollectionName = 'test_debug_collection_' + Date.now();
        console.log(`📝 Creating test collection: ${testCollectionName}`);

        // Load embedding for test data
        console.log('🧠 Loading embedding provider...');
        const { OpenAIEmbedding } = require(path.join(__dirname, '..', 'packages', 'core', 'dist', 'index.js'));

        const embedding = new OpenAIEmbedding({
            apiKey: process.env.OPENAI_API_KEY,
            model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
            baseURL: process.env.OPENAI_BASE_URL
        });

        // Generate test embedding
        console.log('🔢 Generating test embedding...');
        const testContent = "This is a test code snippet for debugging vector database insertion.";
        const testEmbeddingResult = await embedding.embed(testContent);

        console.log(`✅ Generated embedding vector (dimension: ${testEmbeddingResult.vector.length})`);

        // Create test document
        const testDocument = {
            id: 'test_debug_' + Date.now(),
            vector: testEmbeddingResult.vector,
            content: testContent,
            relativePath: 'test/debug.js',
            startLine: 1,
            endLine: 1,
            fileExtension: '.js',
            metadata: { test: true, debug: true }
        };

        console.log('📄 Test document created:', {
            id: testDocument.id,
            vectorDimension: testDocument.vector.length,
            contentLength: testDocument.content.length
        });

        // Try to insert the test document
        console.log('💾 Attempting to insert test document...');

        try {
            await vectorDB.insert(testCollectionName, [testDocument]);
            console.log('✅ Test insertion successful!');
            return true;
        } catch (insertError) {
            console.error('❌ Test insertion failed:', insertError.message);
            console.error('Insert error stack:', insertError.stack);
            return false;
        }

    } catch (error) {
        console.error(`❌ Test insert setup failed: ${error.message}`);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

// Test batch insertion (similar to real indexing)
async function testBatchInsert() {
    console.log('\n📦 Testing Batch Insertion');
    console.log('==========================');

    try {
        const vectorDB = await initializeVectorDB();

        // Load embedding
        const { OpenAIEmbedding } = require(path.join(__dirname, '..', 'packages', 'core', 'dist', 'index.js'));

        const embedding = new OpenAIEmbedding({
            apiKey: process.env.OPENAI_API_KEY,
            model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
            baseURL: process.env.OPENAI_BASE_URL
        });

        // Generate multiple test documents
        console.log('🔢 Generating batch test data...');
        const batchSize = 5;
        const testDocuments = [];

        for (let i = 0; i < batchSize; i++) {
            const content = `Test code snippet ${i + 1} for batch insertion debugging.`;
            const embeddingResult = await embedding.embed(content);

            testDocuments.push({
                id: `test_batch_${Date.now()}_${i}`,
                vector: embeddingResult.vector,  // Extract vector from EmbeddingVector format
                content: content,
                relativePath: `test/batch_${i}.js`,
                startLine: i * 10 + 1,
                endLine: i * 10 + 5,
                fileExtension: '.js',
                metadata: { test: true, batch: true, index: i }
            });
        }

        console.log(`✅ Generated ${testDocuments.length} test documents`);

        // Test insertion to existing collection
        const existingCollections = await vectorDB.listCollections();
        if (existingCollections.length === 0) {
            console.log('⚠️  No existing collections found, creating test collection');

            const testCollectionName = 'test_batch_collection_' + Date.now();
            console.log(`📝 Using test collection: ${testCollectionName}`);

            try {
                await vectorDB.insert(testCollectionName, testDocuments);
                console.log('✅ Batch insertion to new collection successful!');
            } catch (batchError) {
                console.error('❌ Batch insertion to new collection failed:', batchError.message);
                console.error('Batch error details:', batchError.stack);
            }
        } else {
            // Use first existing collection
            const targetCollection = existingCollections[0];
            console.log(`📝 Using existing collection: ${targetCollection}`);

            try {
                await vectorDB.insert(targetCollection, testDocuments);
                console.log('✅ Batch insertion to existing collection successful!');

                // Verify the insertion
                console.log('🔍 Verifying insertion...');
                const collections = await vectorDB.listCollections();
                console.log('Collections after insertion:', collections);

            } catch (batchError) {
                console.error('❌ Batch insertion to existing collection failed:', batchError.message);
                console.error('Batch error details:', batchError);

                // Try to get more specific error information
                if (batchError.code) {
                    console.error('Error code:', batchError.code);
                }
                if (batchError.status) {
                    console.error('Error status:', batchError.status);
                }
            }
        }

        return true;
    } catch (error) {
        console.error(`❌ Batch insert test failed: ${error.message}`);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

// Analyze potential failure points
async function analyzeFailures() {
    console.log('\n🔍 Analyzing Potential Failure Points');
    console.log('=====================================');

    const issues = [];

    try {
        // 1. Check environment variables
        console.log('1️⃣  Checking environment variables...');
        const requiredVars = ['ZILLIZ_ENDPOINT', 'ZILLIZ_TOKEN', 'OPENAI_API_KEY'];
        requiredVars.forEach(varName => {
            if (!process.env[varName] && !process.env[varName.replace('ZILLIZ', 'MILVUS')]) {
                issues.push(`Missing environment variable: ${varName}`);
            } else {
                console.log(`   ✅ ${varName}: ${process.env[varName] ? 'Set' : 'Not set'}`);
            }
        });

        // 2. Check network connectivity
        console.log('2️⃣  Testing network connectivity...');
        const vectorDB = await initializeVectorDB();

        try {
            const collections = await vectorDB.listCollections();
            console.log(`   ✅ Network connectivity: OK (${collections.length} collections found)`);
        } catch (networkError) {
            issues.push(`Network connectivity issue: ${networkError.message}`);
        }

        // 3. Check collection schemas
        console.log('3️⃣  Checking collection schemas...');
        const collections = await vectorDB.listCollections();

        for (const collection of collections) {
            try {
                const client = vectorDB.client;
                const collectionInfo = await client.describeCollection({
                    collection_name: collection
                });

                console.log(`   ✅ Collection '${collection}' schema: OK`);
                console.log(`      Fields: ${collectionInfo.schema?.fields?.length || 'Unknown'}`);

            } catch (schemaError) {
                issues.push(`Schema issue in collection '${collection}': ${schemaError.message}`);
            }
        }

        // 4. Check embedding service
        console.log('4️⃣  Testing embedding service...');
        try {
            const { OpenAIEmbedding } = require(path.join(__dirname, '..', 'packages', 'core', 'dist', 'index.js'));

            const embedding = new OpenAIEmbedding({
                apiKey: process.env.OPENAI_API_KEY,
                model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
                baseURL: process.env.OPENAI_BASE_URL
            });

            const testEmbeddingResult = await embedding.embed("Test embedding");
            console.log(`   ✅ Embedding service: OK (dimension: ${testEmbeddingResult.vector.length})`);

        } catch (embeddingError) {
            issues.push(`Embedding service issue: ${embeddingError.message}`);
        }

        // 5. Summary
        console.log('\n📊 Analysis Summary:');
        if (issues.length === 0) {
            console.log('✅ No obvious issues found! The problem might be in the indexing logic.');
        } else {
            console.log(`❌ Found ${issues.length} potential issue(s):`);
            issues.forEach((issue, index) => {
                console.log(`   ${index + 1}. ${issue}`);
            });
        }

        return issues.length === 0;
    } catch (error) {
        console.error(`❌ Analysis failed: ${error.message}`);
        return false;
    }
}

// Main function
async function main() {
    console.log('🔧 Vector Database Debug Tool');
    console.log('=============================');

    // Load environment
    loadEnvironmentConfig();

    let success = true;

    // Handle different debug operations
    if (args.includes('--test-connection')) {
        success = await testConnection() && success;
    }

    if (args.includes('--test-insert')) {
        success = await testInsert() && success;
    }

    if (args.includes('--test-batch-insert')) {
        success = await testBatchInsert() && success;
    }

    if (args.includes('--analyze-failures')) {
        success = await analyzeFailures() && success;
    }

    const collectionIndex = args.indexOf('--check-collection');
    if (collectionIndex !== -1 && collectionIndex + 1 < args.length) {
        const collectionName = args[collectionIndex + 1];
        success = await checkCollection(collectionName) && success;
    }

    // Default behavior: run all tests
    if (!args.some(arg => arg.startsWith('--'))) {
        console.log('🚀 Running all debug tests...\n');
        success = await testConnection() && success;
        success = await analyzeFailures() && success;

        const collections = await (async () => {
            try {
                const vectorDB = await initializeVectorDB();
                return await vectorDB.listCollections();
            } catch {
                return [];
            }
        })();

        if (collections.length > 0) {
            success = await checkCollection(collections[0]) && success;
        }
    }

    console.log('\n🏁 Debug session completed');
    if (success) {
        console.log('✅ All tests passed');
    } else {
        console.log('❌ Some tests failed - check output above for details');
    }

    process.exit(success ? 0 : 1);
}

// Run main function
main().catch(error => {
    console.error(`❌ Unhandled error: ${error.message}`);
    console.error('Stack trace:', error.stack);
    process.exit(1);
});