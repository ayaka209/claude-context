#!/usr/bin/env node

// 检查 Milvus 集合的加载状态和实体数量

const { MilvusVectorDatabase } = require('../packages/core/dist/index.js');
const fs = require('fs');

async function checkLoadState() {
    console.log('🔍 检查 Milvus 集合加载状态');
    console.log('==============================');

    // 从环境变量或 .env 获取配置
    if (fs.existsSync('.env')) {
        require('dotenv').config();
    }

    const endpoint = process.env.ZILLIZ_ENDPOINT || process.env.MILVUS_ADDRESS;
    const token = process.env.ZILLIZ_TOKEN || process.env.MILVUS_TOKEN;

    if (!endpoint || !token) {
        console.error('❌ 缺少向量数据库配置');
        return;
    }

    try {
        const vectorDB = new MilvusVectorDatabase({
            address: endpoint,
            token: token
        });

        // 获取所有集合
        console.log('📋 获取所有集合...');
        const collections = await vectorDB.listCollections();
        console.log(`找到 ${collections.length} 个集合\n`);

        for (const collectionName of collections) {
            console.log(`🗂️  集合: ${collectionName}`);

            try {
                // 获取集合客户端进行更详细的检查
                const client = vectorDB.client;

                if (client) {
                    // 检查加载状态
                    const loadState = await client.getLoadState({
                        collection_name: collectionName
                    });

                    console.log(`   加载状态: ${loadState.state}`);

                    // 获取集合统计信息
                    try {
                        const stats = await client.getCollectionStatistics({
                            collection_name: collectionName
                        });

                        console.log(`   统计信息:`, stats);

                        if (stats.stats) {
                            for (const stat of stats.stats) {
                                console.log(`     ${stat.key}: ${stat.value}`);
                            }
                        }
                    } catch (statsError) {
                        console.log(`   获取统计信息失败: ${statsError.message}`);
                    }

                    // 尝试查询少量数据
                    try {
                        const queryResult = await vectorDB.query(collectionName, '', ['id'], 5);
                        console.log(`   查询测试 (前5条): 成功，返回 ${queryResult.length} 条记录`);
                    } catch (queryError) {
                        console.log(`   查询测试失败: ${queryError.message}`);
                    }

                    // 获取集合描述
                    try {
                        const description = await client.describeCollection({
                            collection_name: collectionName
                        });
                        console.log(`   字段数量: ${description.schema?.fields?.length || 0}`);
                        if (description.schema?.description) {
                            console.log(`   描述: ${description.schema.description}`);
                        }
                    } catch (descError) {
                        console.log(`   获取描述失败: ${descError.message}`);
                    }
                }

            } catch (error) {
                console.log(`   检查失败: ${error.message}`);
            }

            console.log('');
        }

    } catch (error) {
        console.error('❌ 操作失败:', error.message);
    }
}

checkLoadState().catch(console.error);