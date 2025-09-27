#!/usr/bin/env node

const { Context, MilvusVectorDatabase, OpenAIEmbedding } = require('../packages/core/dist/index.js');
const fs = require('fs');
const path = require('path');

async function checkMilvusCollections() {
    console.log('🔍 检查 Milvus 集合状态');
    console.log('================================');

    // 检查环境变量 - 支持多种变量名
    const zillizEndpoint = process.env.ZILLIZ_ENDPOINT || process.env.MILVUS_ADDRESS;
    const zillizToken = process.env.ZILLIZ_TOKEN || process.env.MILVUS_TOKEN;

    if (!zillizEndpoint || !zillizToken) {
        console.error('❌ 缺少向量数据库配置');
        console.log('💡 需要设置以下环境变量之一:');
        console.log('   ZILLIZ_ENDPOINT + ZILLIZ_TOKEN 或 MILVUS_ADDRESS + MILVUS_TOKEN');

        // 尝试从 .env 文件读取
        const dotenvPath = '.env';
        if (fs.existsSync(dotenvPath)) {
            console.log('📄 尝试从 .env 文件读取配置...');
            require('dotenv').config({ path: dotenvPath });

            const envEndpoint = process.env.ZILLIZ_ENDPOINT || process.env.MILVUS_ADDRESS;
            const envToken = process.env.ZILLIZ_TOKEN || process.env.MILVUS_TOKEN;

            if (!envEndpoint || !envToken) {
                console.error('❌ .env 文件中也缺少必要配置');
                process.exit(1);
            }
        } else {
            process.exit(1);
        }
    }

    try {
        // 初始化向量数据库
        const vectorDatabase = new MilvusVectorDatabase({
            address: zillizEndpoint || process.env.ZILLIZ_ENDPOINT || process.env.MILVUS_ADDRESS,
            token: zillizToken || process.env.ZILLIZ_TOKEN || process.env.MILVUS_TOKEN
        });

        // 列出所有集合
        console.log('📋 获取所有集合...');
        const collections = await vectorDatabase.listCollections();
        console.log(`\n找到 ${collections.length} 个集合:`);

        for (const collectionName of collections) {
            console.log(`\n🗂️  集合: ${collectionName}`);

            try {
                // 检查集合是否存在
                const exists = await vectorDatabase.hasCollection(collectionName);
                console.log(`   存在: ${exists ? '✅' : '❌'}`);

                if (exists) {
                    // 获取集合统计信息
                    try {
                        const stats = await vectorDatabase.query(collectionName, '', ['id'], 1);
                        console.log(`   查询测试: ✅`);

                        // 尝试获取更多统计信息
                        const moreStats = await vectorDatabase.query(collectionName, '', ['id'], 100);
                        console.log(`   实体数量 (前100): ${moreStats.length}`);

                    } catch (queryError) {
                        console.log(`   查询失败: ❌ ${queryError.message}`);
                    }
                }
            } catch (error) {
                console.log(`   检查失败: ❌ ${error.message}`);
            }
        }

        // 检查快照文件中的路径对应的集合
        console.log('\n🗂️  检查快照文件对应的集合...');
        const snapshotPath = path.join(require('os').homedir(), '.context', 'mcp-codebase-snapshot.json');

        if (fs.existsSync(snapshotPath)) {
            const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
            const crypto = require('crypto');

            for (const [projectPath, projectInfo] of Object.entries(snapshot.codebases || {})) {
                const hash = crypto.createHash('md5').update(path.resolve(projectPath)).digest('hex');
                const expectedCollectionName = `hybrid_code_chunks_${hash.substring(0, 8)}`;

                console.log(`\n📁 项目: ${projectPath}`);
                console.log(`   快照状态: ${projectInfo.status}`);
                console.log(`   预期集合名: ${expectedCollectionName}`);

                const collectionExists = collections.includes(expectedCollectionName);
                console.log(`   集合存在: ${collectionExists ? '✅' : '❌'}`);

                if (collectionExists) {
                    try {
                        const stats = await vectorDatabase.query(expectedCollectionName, '', ['id'], 1000);
                        console.log(`   实际实体数量: ${stats.length}`);
                    } catch (error) {
                        console.log(`   查询实体失败: ${error.message}`);
                    }
                }
            }
        } else {
            console.log('❌ 快照文件不存在');
        }

    } catch (error) {
        console.error('❌ 检查失败:', error.message);
        process.exit(1);
    }
}

checkMilvusCollections().catch(console.error);