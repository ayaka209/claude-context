#!/usr/bin/env node

// 重新索引项目并验证写入结果
const { Context } = require('../packages/core/dist/index.js');
const fs = require('fs');
const path = require('path');

async function reindexWithVerification() {
    console.log('🔄 重新索引项目并验证');
    console.log('=========================');

    // 从环境变量获取配置
    if (fs.existsSync('.env')) {
        require('dotenv').config();
    }

    const projectPath = 'D:/dev/kanata/numadv/turnbasedmmo_server';

    if (!fs.existsSync(projectPath)) {
        console.error('❌ 项目路径不存在:', projectPath);
        return;
    }

    try {
        // 先创建向量数据库和嵌入实例
        const { MilvusVectorDatabase, OpenAIEmbedding } = require('../packages/core/dist/index.js');

        const embedding = new OpenAIEmbedding({
            apiKey: process.env.OPENAI_API_KEY,
            model: process.env.EMBEDDING_MODEL || 'text-embedding-v4',
            baseURL: process.env.OPENAI_BASE_URL
        });

        const vectorDatabase = new MilvusVectorDatabase({
            address: process.env.ZILLIZ_ENDPOINT,
            token: process.env.ZILLIZ_TOKEN
        });

        // 初始化Context
        const context = new Context({
            embedding: embedding,
            vectorDatabase: vectorDatabase
        });

        console.log(`📁 开始重新索引: ${projectPath}`);
        console.log(`🔌 向量数据库: ${process.env.ZILLIZ_ENDPOINT}`);
        console.log(`🤖 嵌入模型: ${process.env.EMBEDDING_MODEL}`);
        console.log('');

        // 获取集合名称
        const collectionName = context.getCollectionName(projectPath);
        console.log(`📋 集合名称: ${collectionName}`);

        // 检查集合是否存在，如果存在则删除
        const vectorDB = context.vectorDatabase;
        const exists = await vectorDB.hasCollection(collectionName);

        if (exists) {
            console.log('🗑️  删除现有集合...');
            await vectorDB.dropCollection(collectionName);
            console.log('✅ 集合已删除');
        }

        let totalIndexed = 0;
        let totalFiles = 0;

        // 开始索引，带进度回调
        console.log('🚀 开始索引...');
        const startTime = Date.now();

        const result = await context.indexCodebase(
            projectPath,
            (progress) => {
                console.log(`📊 进度: ${progress.phase} - ${progress.current}/${progress.total} (${progress.percentage.toFixed(1)}%)`);
                if (progress.phase === 'Indexing files') {
                    totalFiles = progress.total;
                    totalIndexed = progress.current;
                }
            },
            true // forceReindex
        );

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        console.log('');
        console.log('✅ 索引完成!');
        console.log(`⏱️  用时: ${duration.toFixed(2)}秒`);
        console.log(`📁 处理文件: ${totalFiles}`);
        console.log(`📝 索引块数: ${totalIndexed}`);
        console.log('');

        // 验证步骤1: 检查集合是否存在
        console.log('🔍 验证步骤1: 检查集合存在');
        const collectionExists = await vectorDB.hasCollection(collectionName);
        console.log(`   集合存在: ${collectionExists ? '✅' : '❌'}`);

        if (!collectionExists) {
            console.error('❌ 验证失败: 集合不存在');
            return;
        }

        // 验证步骤2: 查询实体数量
        console.log('🔍 验证步骤2: 查询实体数量');
        try {
            // 查询少量数据验证连接
            const sampleData = await vectorDB.query(collectionName, '', ['id'], 10);
            console.log(`   样本查询: ${sampleData.length} 条记录`);

            // 查询更多数据估算总量
            const moreData = await vectorDB.query(collectionName, '', ['id'], 16384);
            console.log(`   大量查询: ${moreData.length} 条记录`);

            // 如果查询结果达到limit，说明可能还有更多数据
            if (moreData.length === 16384) {
                console.log('   ⚠️  数据量可能超过查询限制，尝试分批查询...');

                // 分批查询验证
                let offset = 0;
                let totalCount = 0;
                const batchSize = 1000;

                while (true) {
                    const batchData = await vectorDB.query(
                        collectionName,
                        `id >= ${offset}`,
                        ['id'],
                        batchSize
                    );

                    if (batchData.length === 0) break;

                    totalCount += batchData.length;
                    offset += batchSize;

                    console.log(`   批次 ${Math.floor(offset/batchSize)}: ${batchData.length} 条记录 (累计: ${totalCount})`);

                    if (batchData.length < batchSize) break;
                    if (offset > 50000) break; // 防止无限循环
                }

                console.log(`   📊 估算总数: ${totalCount} 条记录`);
            }

            // 验证步骤3: 数据完整性检查
            console.log('🔍 验证步骤3: 数据完整性检查');

            if (sampleData.length > 0) {
                const firstRecord = sampleData[0];
                console.log('   样本记录字段:', Object.keys(firstRecord));

                // 检查必要字段
                const requiredFields = ['id', 'file_path', 'content'];
                const hasAllFields = requiredFields.every(field => firstRecord.hasOwnProperty(field));
                console.log(`   必要字段完整: ${hasAllFields ? '✅' : '❌'}`);
            }

            // 验证步骤4: 搜索功能测试
            console.log('🔍 验证步骤4: 搜索功能测试');
            try {
                const searchResults = await context.search('function', { limit: 5 });
                console.log(`   搜索测试: 找到 ${searchResults.length} 条结果`);

                if (searchResults.length > 0) {
                    console.log(`   首个结果相关性: ${searchResults[0].score?.toFixed(4) || 'N/A'}`);
                }
            } catch (searchError) {
                console.log(`   搜索测试失败: ${searchError.message}`);
            }

            console.log('');
            console.log('🎉 验证完成!');
            console.log('📊 索引统计:');
            console.log(`   - 预期块数: ${totalIndexed}`);
            console.log(`   - 实际查询: ${moreData.length} 条`);
            console.log(`   - 数据一致性: ${totalIndexed === moreData.length ? '✅' : '⚠️  不一致'}`);

        } catch (queryError) {
            console.error('❌ 验证查询失败:', queryError.message);
        }

    } catch (error) {
        console.error('❌ 索引或验证失败:', error.message);
        console.error('详细错误:', error);
    }
}

reindexWithVerification().catch(console.error);