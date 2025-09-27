#!/usr/bin/env node

/**
 * 向量模型可用性测试脚本
 * 用于验证嵌入模型配置和连接性
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIGS = {
    'OpenAI': {
        provider: 'OpenAI',
        models: [
            'text-embedding-3-small',
            'text-embedding-3-large',
            'text-embedding-ada-002'
        ],
        requiredEnvs: ['OPENAI_API_KEY'],
        optionalEnvs: ['OPENAI_BASE_URL']
    },
    'Qwen': {
        provider: 'OpenAI', // Qwen使用OpenAI兼容接口
        models: [
            'Qwen/Qwen3-Embedding-8B',
            'Qwen/Qwen3-Embedding-4B',
            'Qwen/Qwen3-Embedding-0.6B'
        ],
        requiredEnvs: ['OPENAI_API_KEY', 'OPENAI_BASE_URL'],
        optionalEnvs: []
    },
    'Azure OpenAI': {
        provider: 'AzureOpenAI',
        models: ['text-embedding-3-small-deployment'],
        requiredEnvs: ['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_ENDPOINT'],
        optionalEnvs: ['AZURE_OPENAI_API_VERSION', 'AZURE_OPENAI_DEPLOYMENT_NAME']
    },
    'VoyageAI': {
        provider: 'VoyageAI',
        models: ['voyage-code-3', 'voyage-3-large'],
        requiredEnvs: ['VOYAGEAI_API_KEY'],
        optionalEnvs: []
    },
    'Gemini': {
        provider: 'Gemini',
        models: ['gemini-embedding-001'],
        requiredEnvs: ['GEMINI_API_KEY'],
        optionalEnvs: ['GEMINI_BASE_URL']
    },
    'Ollama': {
        provider: 'Ollama',
        models: ['nomic-embed-text', 'mxbai-embed-large'],
        requiredEnvs: [],
        optionalEnvs: ['OLLAMA_HOST', 'OLLAMA_MODEL']
    }
};

// 读取环境变量
function loadEnvVars() {
    const envVars = { ...process.env };

    // 尝试读取 ~/.context/.env
    const homeDir = require('os').homedir();
    const contextEnvPath = path.join(homeDir, '.context', '.env');

    if (fs.existsSync(contextEnvPath)) {
        console.log(`📋 Loading environment from ${contextEnvPath}`);
        const envContent = fs.readFileSync(contextEnvPath, 'utf-8');
        const lines = envContent.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [key, ...valueParts] = trimmed.split('=');
                const value = valueParts.join('=');
                envVars[key.trim()] = value.trim();
            }
        }
    }

    return envVars;
}

// 检查环境变量配置
function checkEnvConfig(providerName, config, envVars) {
    console.log(`\n🔍 检查 ${providerName} 配置...`);

    const results = {
        provider: providerName,
        configured: true,
        missing: [],
        present: [],
        issues: []
    };

    // 检查必需的环境变量
    for (const envVar of config.requiredEnvs) {
        if (envVars[envVar]) {
            results.present.push(`${envVar}=✅ [长度: ${envVars[envVar].length}]`);
        } else {
            results.missing.push(envVar);
            results.configured = false;
        }
    }

    // 检查可选的环境变量
    for (const envVar of config.optionalEnvs) {
        if (envVars[envVar]) {
            results.present.push(`${envVar}=✅ [${envVars[envVar]}]`);
        }
    }

    // 特殊检查
    if (providerName === 'Qwen' && !envVars['OPENAI_BASE_URL']) {
        results.issues.push('Qwen模型需要设置OPENAI_BASE_URL指向兼容的API端点');
    }

    if (providerName === 'Ollama') {
        const host = envVars['OLLAMA_HOST'] || 'http://127.0.0.1:11434';
        results.present.push(`OLLAMA_HOST=✅ [${host}]`);
    }

    return results;
}

// 测试嵌入模型连接性
async function testEmbeddingConnection(providerName, config, envVars) {
    console.log(`\n🧪 测试 ${providerName} 连接性...`);

    const testResult = {
        provider: providerName,
        success: false,
        error: null,
        dimensions: {},
        latency: null
    };

    try {
        // 动态导入核心模块
        const { Context } = await import('../packages/core/dist/context.js');
        const embeddingModules = {
            'OpenAI': await import('../packages/core/dist/embedding/openai-embedding.js'),
            'AzureOpenAI': await import('../packages/core/dist/embedding/azure-openai-embedding.js'),
            'VoyageAI': await import('../packages/core/dist/embedding/voyageai-embedding.js'),
            'Gemini': await import('../packages/core/dist/embedding/gemini-embedding.js'),
            'Ollama': await import('../packages/core/dist/embedding/ollama-embedding.js')
        };

        const EmbeddingClass = embeddingModules[config.provider];
        if (!EmbeddingClass) {
            throw new Error(`不支持的提供商: ${config.provider}`);
        }

        // 为每个模型测试
        for (const model of config.models.slice(0, 1)) { // 只测试第一个模型
            console.log(`   测试模型: ${model}`);

            const startTime = Date.now();

            // 构建配置对象
            let embeddingConfig = {};

            if (config.provider === 'OpenAI') {
                embeddingConfig = {
                    model: model,
                    apiKey: envVars['OPENAI_API_KEY'],
                    ...(envVars['OPENAI_BASE_URL'] && { baseURL: envVars['OPENAI_BASE_URL'] })
                };
            } else if (config.provider === 'AzureOpenAI') {
                embeddingConfig = {
                    deploymentName: envVars['AZURE_OPENAI_DEPLOYMENT_NAME'] || model,
                    azureEndpoint: envVars['AZURE_OPENAI_ENDPOINT'],
                    apiKey: envVars['AZURE_OPENAI_API_KEY'],
                    apiVersion: envVars['AZURE_OPENAI_API_VERSION'] || '2024-02-01'
                };
            } else if (config.provider === 'VoyageAI') {
                embeddingConfig = {
                    model: model,
                    apiKey: envVars['VOYAGEAI_API_KEY']
                };
            } else if (config.provider === 'Gemini') {
                embeddingConfig = {
                    model: model,
                    apiKey: envVars['GEMINI_API_KEY'],
                    ...(envVars['GEMINI_BASE_URL'] && { baseURL: envVars['GEMINI_BASE_URL'] })
                };
            } else if (config.provider === 'Ollama') {
                embeddingConfig = {
                    model: model,
                    host: envVars['OLLAMA_HOST'] || 'http://127.0.0.1:11434'
                };
            }

            const embedding = new EmbeddingClass.default(embeddingConfig);

            // 测试维度检测
            const dimension = await embedding.detectDimension('测试文本');
            testResult.dimensions[model] = dimension;

            // 测试实际嵌入
            const result = await embedding.embed('这是一个测试文本，用于验证嵌入模型是否正常工作。');

            const endTime = Date.now();
            testResult.latency = endTime - startTime;
            testResult.success = true;

            console.log(`   ✅ 模型 ${model} 测试成功`);
            console.log(`   📏 向量维度: ${dimension}`);
            console.log(`   ⏱️  延迟: ${testResult.latency}ms`);

            break; // 只测试第一个模型
        }

    } catch (error) {
        testResult.error = error.message;
        console.log(`   ❌ 测试失败: ${error.message}`);
    }

    return testResult;
}

// 生成测试报告
function generateReport(envResults, connectionResults) {
    const report = {
        timestamp: new Date().toISOString(),
        platform: process.platform,
        nodeVersion: process.version,
        summary: {
            totalProviders: envResults.length,
            configuredProviders: envResults.filter(r => r.configured).length,
            successfulConnections: connectionResults.filter(r => r.success).length
        },
        environmentCheck: envResults,
        connectionTest: connectionResults,
        recommendations: []
    };

    // 生成建议
    const unconfigured = envResults.filter(r => !r.configured);
    if (unconfigured.length > 0) {
        report.recommendations.push({
            type: 'configuration',
            message: `以下提供商需要配置: ${unconfigured.map(r => r.provider).join(', ')}`
        });
    }

    const failedConnections = connectionResults.filter(r => !r.success);
    if (failedConnections.length > 0) {
        report.recommendations.push({
            type: 'connection',
            message: `以下提供商连接失败: ${failedConnections.map(r => r.provider).join(', ')}`
        });
    }

    const successfulProviders = connectionResults.filter(r => r.success);
    if (successfulProviders.length > 0) {
        report.recommendations.push({
            type: 'success',
            message: `可用的提供商: ${successfulProviders.map(r => r.provider).join(', ')}`
        });
    }

    return report;
}

// 主函数
async function main() {
    console.log('🚀 向量模型可用性测试');
    console.log('========================');

    try {
        // 1. 加载环境变量
        const envVars = loadEnvVars();
        console.log(`🔧 已加载 ${Object.keys(envVars).length} 个环境变量`);

        // 2. 检查环境配置
        console.log('\n📋 第一步: 检查环境变量配置');
        const envResults = [];

        for (const [providerName, config] of Object.entries(TEST_CONFIGS)) {
            const result = checkEnvConfig(providerName, config, envVars);
            envResults.push(result);

            if (result.configured) {
                console.log(`   ✅ ${providerName}: 已配置`);
                if (result.present.length > 0) {
                    result.present.forEach(item => console.log(`      ${item}`));
                }
            } else {
                console.log(`   ❌ ${providerName}: 缺少配置`);
                result.missing.forEach(missing => console.log(`      缺少: ${missing}`));
            }

            if (result.issues.length > 0) {
                result.issues.forEach(issue => console.log(`      ⚠️  ${issue}`));
            }
        }

        // 3. 测试连接性（仅测试已配置的提供商）
        console.log('\n🔌 第二步: 测试连接性');
        const connectionResults = [];

        // 首先构建项目
        console.log('📦 构建核心包...');
        try {
            execSync('pnpm build:core', { stdio: 'inherit' });
        } catch (error) {
            console.error('❌ 构建失败，跳过连接测试');
            return;
        }

        const configuredProviders = envResults.filter(r => r.configured);

        for (const envResult of configuredProviders) {
            const config = TEST_CONFIGS[envResult.provider];
            const testResult = await testEmbeddingConnection(envResult.provider, config, envVars);
            connectionResults.push(testResult);
        }

        // 4. 生成报告
        console.log('\n📊 第三步: 生成测试报告');
        const report = generateReport(envResults, connectionResults);

        // 保存报告
        const reportPath = 'embedding-test-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // 显示摘要
        console.log('\n🎯 测试摘要:');
        console.log(`   总提供商数: ${report.summary.totalProviders}`);
        console.log(`   已配置提供商: ${report.summary.configuredProviders}`);
        console.log(`   成功连接提供商: ${report.summary.successfulConnections}`);
        console.log(`   报告已保存: ${reportPath}`);

        // 显示建议
        if (report.recommendations.length > 0) {
            console.log('\n💡 建议:');
            report.recommendations.forEach(rec => {
                const icon = rec.type === 'success' ? '✅' : rec.type === 'configuration' ? '⚙️' : '🔧';
                console.log(`   ${icon} ${rec.message}`);
            });
        }

        // 成功退出
        if (report.summary.successfulConnections > 0) {
            console.log('\n🎉 至少有一个提供商可用！');
            process.exit(0);
        } else {
            console.log('\n⚠️  没有可用的提供商');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
        process.exit(1);
    }
}

// 命令行参数处理
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
向量模型可用性测试脚本

用法: node scripts/test-embedding.js [选项]

选项:
  --help, -h     显示帮助信息

环境变量配置:
  将配置放在 ~/.context/.env 或系统环境变量中

支持的提供商:
  - OpenAI: OPENAI_API_KEY, OPENAI_BASE_URL
  - Qwen: OPENAI_API_KEY, OPENAI_BASE_URL (使用OpenAI兼容接口)
  - Azure OpenAI: AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT
  - VoyageAI: VOYAGEAI_API_KEY
  - Gemini: GEMINI_API_KEY, GEMINI_BASE_URL
  - Ollama: OLLAMA_HOST, OLLAMA_MODEL

示例:
  node scripts/test-embedding.js
    `);
    process.exit(0);
}

// 运行主程序
if (require.main === module) {
    main();
}

module.exports = { main };