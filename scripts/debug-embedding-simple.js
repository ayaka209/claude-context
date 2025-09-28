#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Embedding Debug Tool');
console.log('====================');

// Load environment variables
function loadEnvironmentConfig() {
    const envFile = path.resolve('./.env');

    if (!fs.existsSync(envFile)) {
        console.error('Error: Configuration file not found:', envFile);
        process.exit(1);
    }

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

    Object.assign(process.env, envVars);
    return envVars;
}

async function debugEmbedding() {
    try {
        console.log('Loading environment configuration...');
        const envVars = loadEnvironmentConfig();

        console.log('Loading Claude Context core package...');
        const corePath = path.join(__dirname, '..', 'packages', 'core', 'dist', 'index.js');

        if (!fs.existsSync(corePath)) {
            throw new Error('Core package not built. Please run: pnpm build:core');
        }

        const { OpenAIEmbedding } = require(corePath);

        console.log('Creating embedding provider...');
        console.log('Config:');
        console.log('  API Key:', envVars.OPENAI_API_KEY ? 'Set (' + envVars.OPENAI_API_KEY.substring(0, 10) + '...)' : 'Not set');
        console.log('  Model:', envVars.EMBEDDING_MODEL || 'text-embedding-3-small');
        console.log('  Base URL:', envVars.OPENAI_BASE_URL || 'https://api.openai.com/v1');

        const embedding = new OpenAIEmbedding({
            apiKey: envVars.OPENAI_API_KEY,
            model: envVars.EMBEDDING_MODEL || 'text-embedding-3-small',
            baseURL: envVars.OPENAI_BASE_URL
        });

        // Test different types of content
        const testCases = [
            { name: 'Simple English text', content: 'Hello world, this is a test.' },
            { name: 'Code snippet', content: 'function add(a, b) { return a + b; }' },
            { name: 'Empty text', content: '' },
            { name: 'Special characters', content: '!@#$%^&*()[]{}|' }
        ];

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            console.log('\n' + (i + 1) + '. Testing:', testCase.name);
            console.log('   Content:', JSON.stringify(testCase.content));
            console.log('   Length:', testCase.content.length, 'characters');

            try {
                const startTime = Date.now();
                const embeddingResult = await embedding.embed(testCase.content);
                const duration = Date.now() - startTime;

                if (!embeddingResult) {
                    console.log('   Result: null/undefined embedding result');
                    continue;
                }

                // Extract vector from EmbeddingVector format
                const vector = embeddingResult.vector;
                if (!vector || !Array.isArray(vector)) {
                    console.log('   Result: Invalid vector format');
                    console.log('   Type:', typeof embeddingResult);
                    console.log('   Value:', JSON.stringify(embeddingResult).substring(0, 100) + '...');
                    continue;
                }

                console.log('   Vector generated in', duration + 'ms');
                console.log('   Dimension:', vector.length);

                // Check for problematic values
                const nanCount = vector.filter(v => isNaN(v)).length;
                const infinityCount = vector.filter(v => !isFinite(v)).length;
                const zeroCount = vector.filter(v => v === 0).length;

                console.log('   NaN values:', nanCount);
                console.log('   Infinity values:', infinityCount);
                console.log('   Zero values:', zeroCount);

                if (nanCount > 0 || infinityCount > 0) {
                    console.log('   PROBLEMATIC VECTOR DETECTED!');
                    console.log('   Sample values:', vector.slice(0, 10));
                }

                // Statistical analysis
                const sum = vector.reduce((a, b) => a + b, 0);
                const mean = sum / vector.length;
                const variance = vector.reduce((a, b) => a + (b - mean) ** 2, 0) / vector.length;
                const stdDev = Math.sqrt(variance);

                console.log('   Mean:', mean.toFixed(6));
                console.log('   Std Dev:', stdDev.toFixed(6));
                console.log('   Min:', Math.min(...vector).toFixed(6));
                console.log('   Max:', Math.max(...vector).toFixed(6));

            } catch (error) {
                console.log('   Error:', error.message);
                console.log('   Stack:', error.stack);
            }
        }

    } catch (error) {
        console.error('Debug failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the debug
debugEmbedding().then(() => {
    console.log('\nEmbedding debug completed');
}).catch(error => {
    console.error('Unhandled error:', error.message);
    process.exit(1);
});