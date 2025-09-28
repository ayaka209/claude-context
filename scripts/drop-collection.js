#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');

// Load environment configuration
const envPath = path.join(__dirname, '..', '.env');
console.log(`📄 Using configuration file: ${envPath}`);
dotenv.config({ path: envPath });

// Load Claude Context core package
console.log('📦 Loading Claude Context core package...');
const { MilvusVectorDatabase } = require('../packages/core/dist/vectordb/milvus-vectordb.js');

async function dropCollection() {
    try {
        // Create vector database instance
        const vectorDb = new MilvusVectorDatabase({
            address: process.env.ZILLIZ_ENDPOINT || process.env.MILVUS_ENDPOINT,
            token: process.env.ZILLIZ_TOKEN || process.env.MILVUS_TOKEN,
            username: process.env.MILVUS_USERNAME,
            password: process.env.MILVUS_PASSWORD,
            ssl: true
        });

        const collectionName = 'hybrid_code_chunks_f12bdcb4';

        console.log(`🗑️  Dropping collection: ${collectionName}`);

        // Check if collection exists first
        const exists = await vectorDb.hasCollection(collectionName);
        if (!exists) {
            console.log(`❌ Collection '${collectionName}' does not exist`);
            return;
        }

        // Drop the collection
        await vectorDb.dropCollection(collectionName);
        console.log(`✅ Collection '${collectionName}' dropped successfully`);

        // Verify it's gone
        const stillExists = await vectorDb.hasCollection(collectionName);
        if (stillExists) {
            console.log(`⚠️  Warning: Collection still exists after drop operation`);
        } else {
            console.log(`✅ Verified: Collection '${collectionName}' no longer exists`);
        }

    } catch (error) {
        console.error('❌ Error dropping collection:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

dropCollection();