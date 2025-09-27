#!/usr/bin/env node

/**
 * 测试text-embedding-v4模型2048维度配置
 */

const { OpenAIEmbedding } = require('../packages/core/dist/embedding/openai-embedding.js');

async function testTextEmbeddingV4() {
    console.log('🚀 测试text-embedding-v4模型2048维度配置');
    console.log('============================================');

    try {
        // 配置text-embedding-v4模型，使用2048维度
        const embedding = new OpenAIEmbedding({
            model: 'text-embedding-v4',
            apiKey: 'sk-4b980779eff74ad58d80e23d99023bfc',
            baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            dimensions: 2048  // 自定义维度
        });

        console.log('📋 配置信息:');
        console.log(`   模型: text-embedding-v4`);
        console.log(`   自定义维度: 2048`);
        console.log(`   API端点: https://dashscope.aliyuncs.com/compatible-mode/v1`);

        // 1. 测试维度检测
        console.log('\n🔍 步骤1: 测试维度检测...');
        const detectedDim = await embedding.detectDimension('测试文本');
        console.log(`   检测到的维度: ${detectedDim}`);

        // 2. 测试单个文本嵌入
        console.log('\n📝 步骤2: 测试单个文本嵌入...');
        const result = await embedding.embed('这是一个测试文本，用于验证text-embedding-v4模型的2048维度配置是否正常工作。');

        console.log(`   ✅ 嵌入成功!`);
        console.log(`   向量维度: ${result.dimension}`);
        console.log(`   向量长度: ${result.vector.length}`);
        console.log(`   向量示例 (前10个值): [${result.vector.slice(0, 10).map(v => v.toFixed(4)).join(', ')}...]`);
        console.log(`   向量范围: min=${Math.min(...result.vector).toFixed(6)}, max=${Math.max(...result.vector).toFixed(6)}`);

        // 3. 测试批量嵌入
        console.log('\n📦 步骤3: 测试批量嵌入...');
        const batchTexts = [
            'Hello, this is the first test text.',
            '这是第二个测试文本，用中文编写。',
            'function test() { return "code example"; }'
        ];

        const batchResults = await embedding.embedBatch(batchTexts);
        console.log(`   ✅ 批量嵌入成功!`);
        console.log(`   处理文本数量: ${batchResults.length}`);

        batchResults.forEach((result, index) => {
            console.log(`   文本${index + 1}: 维度=${result.dimension}, 向量长度=${result.vector.length}`);
        });

        // 4. 验证结果
        console.log('\n✅ 步骤4: 验证结果...');

        const allCorrectDimension = [result, ...batchResults].every(r => r.dimension === 2048);
        const allCorrectVectorLength = [result, ...batchResults].every(r => r.vector.length === 2048);

        if (allCorrectDimension && allCorrectVectorLength) {
            console.log('   🎉 所有测试通过！text-embedding-v4模型成功配置为2048维度');

            console.log('\n📝 Claude Context配置示例:');
            console.log('```bash');
            console.log('# 在 ~/.context/.env 中添加以下配置:');
            console.log('EMBEDDING_PROVIDER=OpenAI');
            console.log('EMBEDDING_MODEL=text-embedding-v4');
            console.log('OPENAI_API_KEY=sk-4b980779eff74ad58d80e23d99023bfc');
            console.log('OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1');
            console.log('```');

            console.log('\n💡 注意: text-embedding-v4现在已预定义为2048维度');
            console.log('   如需使用其他维度，可通过程序配置 dimensions 参数');

            process.exit(0);
        } else {
            console.log('   ❌ 测试失败：维度不匹配');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);

        if (error.message.includes('MODULE_NOT_FOUND') || error.message.includes('Cannot find module')) {
            console.log('\n💡 请先构建项目:');
            console.log('   pnpm build:core');
        }

        process.exit(1);
    }
}

// 运行测试
if (require.main === module) {
    testTextEmbeddingV4().catch(console.error);
}

module.exports = { testTextEmbeddingV4 };