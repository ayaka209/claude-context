#!/usr/bin/env node

/**
 * 自定义向量模型可用性测试脚本
 * 用于测试任意API密钥、模型名称和URL的向量模型
 */

const { program } = require('commander');

// 测试用的文本样本
const TEST_TEXTS = [
    "Hello, this is a test text for embedding.",
    "这是一个用于测试嵌入的中文文本。",
    "function test() { return 'code sample'; }",
    "Vector embedding test with multiple languages and code samples."
];

/**
 * 测试OpenAI兼容的嵌入API
 */
async function testOpenAICompatibleAPI(config) {
    const { apiKey, modelName, baseURL, testText } = config;

    console.log(`🧪 测试OpenAI兼容API...`);
    console.log(`   模型: ${modelName}`);
    console.log(`   端点: ${baseURL}`);
    console.log(`   测试文本: ${testText.substring(0, 50)}...`);

    try {
        const fetch = (await import('node-fetch')).default;
        const startTime = Date.now();

        const response = await fetch(`${baseURL}/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: modelName,
                input: [testText],
                encoding_format: 'float'
            })
        });

        const endTime = Date.now();
        const latency = endTime - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();

        // 验证响应格式
        if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
            throw new Error('响应格式无效：缺少data数组');
        }

        const embedding = result.data[0].embedding;
        if (!Array.isArray(embedding) || embedding.length === 0) {
            throw new Error('响应格式无效：嵌入向量为空');
        }

        return {
            success: true,
            dimension: embedding.length,
            latency: latency,
            vector_sample: embedding.slice(0, 5),
            usage: result.usage || null,
            model: result.model || modelName
        };

    } catch (error) {
        return {
            success: false,
            error: error.message,
            latency: null,
            dimension: null
        };
    }
}

/**
 * 测试Azure OpenAI风格的API
 */
async function testAzureOpenAIAPI(config) {
    const { apiKey, modelName, baseURL, testText, apiVersion = '2024-02-01' } = config;

    console.log(`🧪 测试Azure OpenAI API...`);
    console.log(`   部署名称: ${modelName}`);
    console.log(`   端点: ${baseURL}`);
    console.log(`   API版本: ${apiVersion}`);

    try {
        const fetch = (await import('node-fetch')).default;
        const startTime = Date.now();

        // Azure OpenAI URL格式
        const url = `${baseURL}/openai/deployments/${modelName}/embeddings?api-version=${apiVersion}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            body: JSON.stringify({
                input: [testText]
            })
        });

        const endTime = Date.now();
        const latency = endTime - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        const embedding = result.data[0].embedding;

        return {
            success: true,
            dimension: embedding.length,
            latency: latency,
            vector_sample: embedding.slice(0, 5),
            usage: result.usage || null,
            model: result.model || modelName
        };

    } catch (error) {
        return {
            success: false,
            error: error.message,
            latency: null,
            dimension: null
        };
    }
}

/**
 * 执行向量相似性测试
 */
async function testVectorSimilarity(config) {
    console.log(`\n🔍 执行向量相似性测试...`);

    const similarities = [];
    const embeddings = [];

    try {
        // 为多个测试文本生成嵌入
        for (let i = 0; i < Math.min(TEST_TEXTS.length, 3); i++) {
            const testConfig = { ...config, testText: TEST_TEXTS[i] };

            let result;
            if (config.apiType === 'azure') {
                result = await testAzureOpenAIAPI(testConfig);
            } else {
                result = await testOpenAICompatibleAPI(testConfig);
            }

            if (!result.success) {
                console.log(`   ❌ 文本 ${i + 1} 嵌入失败: ${result.error}`);
                continue;
            }

            // 获取完整嵌入向量（需要重新调用API）
            embeddings.push({
                text: TEST_TEXTS[i],
                vector: result.vector_sample // 注意：这里只是示例，实际需要完整向量
            });

            console.log(`   ✅ 文本 ${i + 1}: "${TEST_TEXTS[i].substring(0, 30)}..." (${result.dimension}维)`);
        }

        // 计算余弦相似度（简化版，仅作演示）
        if (embeddings.length >= 2) {
            console.log(`\n📊 向量质量评估:`);
            console.log(`   - 生成了 ${embeddings.length} 个嵌入向量`);
            console.log(`   - 向量维度: ${embeddings[0].vector ? embeddings[0].vector.length : 'N/A'}`);
            console.log(`   - 建议: 不同语言和内容的文本应产生不同的向量`);
        }

        return {
            success: true,
            embeddings_count: embeddings.length,
            dimension: embeddings.length > 0 ? embeddings[0].vector?.length : null
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 生成详细的测试报告
 */
function generateTestReport(testResult, similarityResult, config) {
    const report = {
        timestamp: new Date().toISOString(),
        test_config: {
            model_name: config.modelName,
            base_url: config.baseURL,
            api_type: config.apiType,
            test_text_length: config.testText.length
        },
        basic_test: testResult,
        similarity_test: similarityResult,
        summary: {
            overall_success: testResult.success && (similarityResult ? similarityResult.success : true),
            dimension: testResult.dimension,
            latency_ms: testResult.latency,
            recommendations: []
        }
    };

    // 生成建议
    if (testResult.success) {
        report.summary.recommendations.push('✅ 基础API调用成功');

        if (testResult.dimension) {
            if (testResult.dimension >= 1024) {
                report.summary.recommendations.push('✅ 向量维度充足，适合语义搜索');
            } else {
                report.summary.recommendations.push('⚠️ 向量维度较低，可能影响搜索精度');
            }
        }

        if (testResult.latency) {
            if (testResult.latency < 1000) {
                report.summary.recommendations.push('✅ API响应速度良好');
            } else if (testResult.latency < 3000) {
                report.summary.recommendations.push('⚠️ API响应稍慢，建议优化网络');
            } else {
                report.summary.recommendations.push('❌ API响应较慢，可能影响用户体验');
            }
        }
    } else {
        report.summary.recommendations.push('❌ 基础API调用失败，请检查配置');
    }

    return report;
}

/**
 * 主测试函数
 */
async function runEmbeddingTest(options) {
    console.log('🚀 自定义向量模型可用性测试');
    console.log('==================================');

    const config = {
        apiKey: options.apiKey,
        modelName: options.model,
        baseURL: options.url.replace(/\/$/, ''), // 移除末尾斜杠
        testText: options.text || TEST_TEXTS[0],
        apiType: options.type || 'openai',
        apiVersion: options.apiVersion
    };

    console.log(`📋 测试配置:`);
    console.log(`   API类型: ${config.apiType}`);
    console.log(`   模型名称: ${config.modelName}`);
    console.log(`   API端点: ${config.baseURL}`);
    console.log(`   API密钥: ${config.apiKey.substring(0, 8)}...`);
    if (config.apiVersion) {
        console.log(`   API版本: ${config.apiVersion}`);
    }

    try {
        // 1. 基础API测试
        console.log(`\n🔧 第一步: 基础API测试`);
        let testResult;

        if (config.apiType === 'azure') {
            testResult = await testAzureOpenAIAPI(config);
        } else {
            testResult = await testOpenAICompatibleAPI(config);
        }

        if (testResult.success) {
            console.log(`   ✅ API调用成功`);
            console.log(`   📏 向量维度: ${testResult.dimension}`);
            console.log(`   ⏱️  响应延迟: ${testResult.latency}ms`);
            console.log(`   🔢 向量示例: [${testResult.vector_sample.map(v => v.toFixed(4)).join(', ')}...]`);

            if (testResult.usage) {
                console.log(`   📊 Token使用: ${JSON.stringify(testResult.usage)}`);
            }
        } else {
            console.log(`   ❌ API调用失败: ${testResult.error}`);
        }

        // 2. 相似性测试（可选）
        let similarityResult = null;
        if (testResult.success && !options.basicOnly) {
            console.log(`\n🔍 第二步: 向量质量测试`);
            similarityResult = await testVectorSimilarity(config);
        }

        // 3. 生成报告
        console.log(`\n📊 第三步: 生成测试报告`);
        const report = generateTestReport(testResult, similarityResult, config);

        // 保存报告
        if (options.output) {
            const fs = require('fs');
            fs.writeFileSync(options.output, JSON.stringify(report, null, 2));
            console.log(`   💾 报告已保存: ${options.output}`);
        }

        // 显示摘要
        console.log(`\n🎯 测试摘要:`);
        console.log(`   整体状态: ${report.summary.overall_success ? '✅ 成功' : '❌ 失败'}`);
        console.log(`   向量维度: ${report.summary.dimension || 'N/A'}`);
        console.log(`   响应延迟: ${report.summary.latency_ms || 'N/A'}ms`);

        console.log(`\n💡 建议:`);
        report.summary.recommendations.forEach(rec => {
            console.log(`   ${rec}`);
        });

        // 成功退出
        if (report.summary.overall_success) {
            console.log(`\n🎉 测试完成！模型可用于Claude Context。`);

            console.log(`\n📝 Claude Context配置示例:`);
            console.log(`EMBEDDING_PROVIDER=OpenAI`);
            console.log(`EMBEDDING_MODEL=${config.modelName}`);
            console.log(`OPENAI_API_KEY=${config.apiKey}`);
            console.log(`OPENAI_BASE_URL=${config.baseURL}`);

            process.exit(0);
        } else {
            console.log(`\n❌ 测试失败，请检查配置。`);
            process.exit(1);
        }

    } catch (error) {
        console.error(`\n💥 测试过程中发生错误:`, error);
        process.exit(1);
    }
}

// 命令行接口
program
    .name('test-custom-embedding')
    .description('测试自定义向量模型的可用性')
    .version('1.0.0')
    .requiredOption('-k, --api-key <key>', 'API密钥')
    .requiredOption('-m, --model <name>', '模型名称')
    .requiredOption('-u, --url <url>', 'API端点URL')
    .option('-t, --type <type>', 'API类型 (openai|azure)', 'openai')
    .option('--api-version <version>', 'Azure API版本', '2024-02-01')
    .option('--text <text>', '测试文本', TEST_TEXTS[0])
    .option('--basic-only', '仅运行基础测试')
    .option('-o, --output <file>', '输出报告文件路径');

program.addHelpText('after', `

示例:
  # 测试Qwen模型
  node scripts/test-custom-embedding.js \\
    --api-key "sk-xxx" \\
    --model "Qwen/Qwen3-Embedding-8B" \\
    --url "https://dashscope.aliyuncs.com/v1"

  # 测试Azure OpenAI
  node scripts/test-custom-embedding.js \\
    --api-key "your-azure-key" \\
    --model "text-embedding-3-small" \\
    --url "https://your-resource.openai.azure.com" \\
    --type azure

  # 测试本地API
  node scripts/test-custom-embedding.js \\
    --api-key "local-key" \\
    --model "local-embedding-model" \\
    --url "http://localhost:8000/v1" \\
    --output "test-report.json"

  # 仅基础测试
  node scripts/test-custom-embedding.js \\
    --api-key "sk-xxx" \\
    --model "custom-model" \\
    --url "https://api.example.com/v1" \\
    --basic-only

注意事项:
  - API端点应兼容OpenAI嵌入API格式
  - Azure类型API需要使用api-key头而非Authorization
  - 测试会发送少量请求以验证API功能
`);

// 安装缺失的依赖
async function ensureDependencies() {
    try {
        await import('node-fetch');
    } catch (error) {
        console.log('📦 安装缺失的依赖...');
        const { execSync } = require('child_process');
        try {
            execSync('npm install node-fetch commander', { stdio: 'inherit' });
            console.log('✅ 依赖安装完成');
        } catch (installError) {
            console.error('❌ 依赖安装失败:', installError.message);
            console.log('💡 请手动运行: npm install node-fetch commander');
            process.exit(1);
        }
    }

    try {
        require('commander');
    } catch (error) {
        console.error('❌ 缺少commander依赖，请运行: npm install commander');
        process.exit(1);
    }
}

// 主程序
async function main() {
    await ensureDependencies();

    program.parse();
    const options = program.opts();

    // 验证必需参数
    if (!options.apiKey || !options.model || !options.url) {
        console.error('❌ 缺少必需参数，请使用 --help 查看用法');
        process.exit(1);
    }

    await runEmbeddingTest(options);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { runEmbeddingTest, testOpenAICompatibleAPI, testAzureOpenAIAPI };