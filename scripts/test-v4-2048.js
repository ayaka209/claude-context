#!/usr/bin/env node

const { OpenAIEmbedding } = require('../packages/core/dist/embedding/openai-embedding.js');
const path = require('path');
const dotenv = require('dotenv');

// Load environment configuration
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

async function testV4With2048() {
    console.log('Testing text-embedding-v4 with 2048 dimensions');
    console.log('==================================================');

    try {
        // Create embedding provider with custom dimensions
        const embedding = new OpenAIEmbedding({
            apiKey: process.env.OPENAI_API_KEY,
            model: 'text-embedding-v4',
            baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            dimensions: 2048
        });

        console.log('Config:');
        console.log(`  API Key: Set (${process.env.OPENAI_API_KEY?.substring(0, 10)}...)`);
        console.log(`  Model: text-embedding-v4`);
        console.log(`  Base URL: https://dashscope.aliyuncs.com/compatible-mode/v1`);
        console.log(`  Custom Dimensions: 2048`);
        console.log();

        // Test single embedding
        console.log('1. Testing single embedding with 2048 dimensions');
        const start1 = Date.now();
        const result1 = await embedding.embed('Hello world, this is a test of 2048-dimensional embedding.');
        const duration1 = Date.now() - start1;

        console.log(`   ✅ Completed in ${duration1}ms`);
        console.log(`   📊 Vector dimension: ${result1.dimension}`);
        console.log(`   🔍 Vector preview: [${result1.vector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
        console.log();

        // Test batch embedding
        console.log('2. Testing batch embedding with 2048 dimensions');
        const texts = ['Test text 1', 'Test text 2', 'Test text 3'];
        const start2 = Date.now();
        const results2 = await embedding.embedBatch(texts);
        const duration2 = Date.now() - start2;

        console.log(`   ✅ Completed in ${duration2}ms`);
        console.log(`   📊 Generated ${results2.length} vectors, each ${results2[0].dimension}D`);
        console.log(`   🔍 First vector preview: [${results2[0].vector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
        console.log();

        // Verify all vectors have correct dimension
        const allCorrectDimension = results2.every(r => r.dimension === 2048);
        console.log(`✅ All vectors have correct dimension (2048): ${allCorrectDimension}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testV4With2048();