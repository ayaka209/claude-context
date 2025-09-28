#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Embedding Debug Tool');
console.log('=======================');

// Load environment variables
function loadEnvironmentConfig() {
    const envFile = path.resolve('./.env');

    if (!fs.existsSync(envFile)) {
        console.error(`❌ Error: Configuration file not found: ${envFile}`);
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
        console.log('📄 Loading environment configuration...');
        const envVars = loadEnvironmentConfig();

        console.log('📦 Loading Claude Context core package...');
        const corePath = path.join(__dirname, '..', 'packages', 'core', 'dist', 'index.js');

        if (!fs.existsSync(corePath)) {
            throw new Error('Core package not built. Please run: pnpm build:core');
        }

        const { OpenAIEmbedding } = require(corePath);

        console.log('🧠 Creating embedding provider...');
        console.log('Config:');
        console.log(`  API Key: ${envVars.OPENAI_API_KEY ? 'Set (' + envVars.OPENAI_API_KEY.substring(0, 10) + '...)' : 'Not set'}`);
        console.log(`  Model: ${envVars.EMBEDDING_MODEL || 'text-embedding-3-small'}`);
        console.log(`  Base URL: ${envVars.OPENAI_BASE_URL || 'https://api.openai.com/v1'}`);

        const embedding = new OpenAIEmbedding({
            apiKey: envVars.OPENAI_API_KEY,
            model: envVars.EMBEDDING_MODEL || 'text-embedding-3-small',
            baseURL: envVars.OPENAI_BASE_URL
        });

        // Test different types of content
        const testCases = [
            { name: 'Simple English text', content: 'Hello world, this is a test.' },
            { name: 'Code snippet', content: 'function add(a, b) { return a + b; }' },
            { name: 'Chinese text', content: '这是一个测试文本。' },
            { name: 'Mixed content', content: 'Code: const x = 5; // 这是注释' },
            { name: 'Empty text', content: '' },
            { name: 'Special characters', content: '!@#$%^&*()[]{}|;:,.<>?' },
            { name: 'Long text', content: 'This is a very long text that contains multiple sentences and should test the embedding model with more substantial content. '.repeat(10) }
        ];

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            console.log(`\n${i + 1}. Testing: ${testCase.name}`);
            console.log(`   Content: "${testCase.content.substring(0, 50)}${testCase.content.length > 50 ? '...' : '"}"`);
            console.log(`   Length: ${testCase.content.length} characters`);

            try {
                const startTime = Date.now();
                const vector = await embedding.embed(testCase.content);
                const duration = Date.now() - startTime;

                if (!vector) {
                    console.log('   ❌ Result: null/undefined vector');
                    continue;
                }

                if (!Array.isArray(vector)) {
                    console.log('   ❌ Result: Not an array');
                    console.log(`   Type: ${typeof vector}`);
                    console.log(`   Value: ${JSON.stringify(vector).substring(0, 100)}...`);
                    continue;
                }

                console.log(`   ✅ Vector generated in ${duration}ms`);
                console.log(`   Dimension: ${vector.length}`);

                // Check for problematic values
                const nanCount = vector.filter(v => isNaN(v)).length;
                const infinityCount = vector.filter(v => !isFinite(v)).length;
                const zeroCount = vector.filter(v => v === 0).length;

                console.log(`   NaN values: ${nanCount}`);
                console.log(`   Infinity values: ${infinityCount}`);
                console.log(`   Zero values: ${zeroCount}`);

                if (nanCount > 0 || infinityCount > 0) {
                    console.log('   ⚠️  PROBLEMATIC VECTOR DETECTED!');
                    console.log(`   Sample values: [${vector.slice(0, 10).join(', ')}...]`);
                }

                // Statistical analysis
                const sum = vector.reduce((a, b) => a + b, 0);
                const mean = sum / vector.length;
                const variance = vector.reduce((a, b) => a + (b - mean) ** 2, 0) / vector.length;
                const stdDev = Math.sqrt(variance);

                console.log(`   Mean: ${mean.toFixed(6)}`);
                console.log(`   Std Dev: ${stdDev.toFixed(6)}`);
                console.log(`   Min: ${Math.min(...vector).toFixed(6)}`);
                console.log(`   Max: ${Math.max(...vector).toFixed(6)}`);

            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
                console.log(`   Stack: ${error.stack}`);
            }
        }

        console.log('\n🧪 Testing raw OpenAI API call...');
        try {
            // Test direct API call
            const response = await fetch(`${envVars.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/embeddings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${envVars.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    input: 'test embedding',
                    model: envVars.EMBEDDING_MODEL || 'text-embedding-3-small'
                })
            });

            if (!response.ok) {
                console.log(`   ❌ API Error: ${response.status} ${response.statusText}`);
                const errorText = await response.text();
                console.log(`   Error details: ${errorText}`);
            } else {
                const data = await response.json();
                console.log('   ✅ Direct API call successful');
                console.log(`   Usage: ${JSON.stringify(data.usage)}`);
                console.log(`   Vector dimension: ${data.data[0]?.embedding?.length}`);

                if (data.data[0]?.embedding) {
                    const rawVector = data.data[0].embedding;
                    const nanCount = rawVector.filter(v => isNaN(v)).length;
                    const infinityCount = rawVector.filter(v => !isFinite(v)).length;

                    console.log(`   NaN values in raw response: ${nanCount}`);
                    console.log(`   Infinity values in raw response: ${infinityCount}`);
                }
            }
        } catch (apiError) {
            console.log(`   ❌ Direct API call failed: ${apiError.message}`);
        }

    } catch (error) {
        console.error(`❌ Debug failed: ${error.message}`);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the debug
debugEmbedding().then(() => {
    console.log('\n✅ Embedding debug completed');
}).catch(error => {
    console.error(`❌ Unhandled error: ${error.message}`);
    process.exit(1);
});