#!/usr/bin/env node

const { OpenAIEmbedding } = require('../packages/core/dist/embedding/openai-embedding.js');
const path = require('path');
const dotenv = require('dotenv');

// Load environment configuration
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

async function testBatchEmbedding() {
    console.log('Batch Embedding Debug Tool');
    console.log('===========================');

    try {
        // Create embedding provider
        const embedding = new OpenAIEmbedding({
            apiKey: process.env.OPENAI_API_KEY,
            model: 'text-embedding-v4',
            baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
        });

        console.log('Config:');
        console.log(`  API Key: Set (${process.env.OPENAI_API_KEY?.substring(0, 10)}...)`);
        console.log(`  Model: text-embedding-v4`);
        console.log(`  Base URL: https://dashscope.aliyuncs.com/compatible-mode/v1`);
        console.log();

        // Test 1: Batch within limit (5 texts)
        console.log('1. Testing: Small batch (5 texts)');
        const smallBatch = Array.from({length: 5}, (_, i) => `Test text ${i+1}`);
        const start1 = Date.now();
        const results1 = await embedding.embedBatch(smallBatch);
        const duration1 = Date.now() - start1;
        console.log(`   ✅ Completed in ${duration1}ms`);
        console.log(`   📊 Results: ${results1.length} vectors, each with ${results1[0].dimension} dimensions`);
        console.log();

        // Test 2: Batch exactly at limit (10 texts)
        console.log('2. Testing: Batch at limit (10 texts)');
        const exactBatch = Array.from({length: 10}, (_, i) => `Test text ${i+1}`);
        const start2 = Date.now();
        const results2 = await embedding.embedBatch(exactBatch);
        const duration2 = Date.now() - start2;
        console.log(`   ✅ Completed in ${duration2}ms`);
        console.log(`   📊 Results: ${results2.length} vectors, each with ${results2[0].dimension} dimensions`);
        console.log();

        // Test 3: Batch over limit (15 texts - should split into 10+5)
        console.log('3. Testing: Large batch (15 texts - should split into 10+5)');
        const largeBatch = Array.from({length: 15}, (_, i) => `Test text ${i+1}`);
        const start3 = Date.now();
        const results3 = await embedding.embedBatch(largeBatch);
        const duration3 = Date.now() - start3;
        console.log(`   ✅ Completed in ${duration3}ms`);
        console.log(`   📊 Results: ${results3.length} vectors, each with ${results3[0].dimension} dimensions`);
        console.log();

        // Test 4: Much larger batch (50 texts - should split into 5 batches of 10)
        console.log('4. Testing: Very large batch (50 texts - should split into 5 batches of 10)');
        const veryLargeBatch = Array.from({length: 50}, (_, i) => `Test text ${i+1}`);
        const start4 = Date.now();
        const results4 = await embedding.embedBatch(veryLargeBatch);
        const duration4 = Date.now() - start4;
        console.log(`   ✅ Completed in ${duration4}ms`);
        console.log(`   📊 Results: ${results4.length} vectors, each with ${results4[0].dimension} dimensions`);
        console.log();

        console.log('All batch embedding tests completed successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testBatchEmbedding().catch(console.error);