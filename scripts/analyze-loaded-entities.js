#!/usr/bin/env node

// 分析"Loaded Entities"问题 - 脱机版本
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function analyzeLoadedEntities() {
    console.log('🔍 分析 Loaded Entities 问题');
    console.log('=================================');

    // 读取快照文件
    const snapshotPath = path.join(require('os').homedir(), '.context', 'mcp-codebase-snapshot.json');

    if (!fs.existsSync(snapshotPath)) {
        console.log('❌ 快照文件不存在:', snapshotPath);
        return;
    }

    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    console.log('📄 快照文件信息:');
    console.log(`   格式版本: ${snapshot.formatVersion}`);
    console.log(`   最后更新: ${snapshot.lastUpdated}`);
    console.log('');

    // 分析每个代码库
    for (const [projectPath, projectInfo] of Object.entries(snapshot.codebases || {})) {
        console.log(`📁 项目: ${projectPath}`);
        console.log(`   状态: ${projectInfo.status}`);

        if (projectInfo.indexedFiles !== undefined) {
            console.log(`   已索引文件: ${projectInfo.indexedFiles}`);
        }

        if (projectInfo.totalChunks !== undefined) {
            console.log(`   总块数: ${projectInfo.totalChunks}`);
        }

        if (projectInfo.indexedChunks !== undefined) {
            console.log(`   已索引块数: ${projectInfo.indexedChunks}`);
        }

        if (projectInfo.indexingPercentage !== undefined) {
            console.log(`   索引进度: ${projectInfo.indexingPercentage}%`);
        }

        // 计算预期的集合名称
        const normalizedPath = path.resolve(projectPath);
        const hash = crypto.createHash('md5').update(normalizedPath).digest('hex');
        const expectedCollectionName = `hybrid_code_chunks_${hash.substring(0, 8)}`;
        console.log(`   预期集合名: ${expectedCollectionName}`);

        console.log(`   最后更新: ${projectInfo.lastUpdated}`);
        console.log('');
    }

    // 分析"Loaded Entities"可能的原因
    console.log('🔍 Loaded Entities 分析:');
    console.log('========================');
    console.log('');
    console.log('根据代码分析，"Loaded Entities"可能指的是:');
    console.log('1. Milvus集合当前加载到内存中的实体数量');
    console.log('2. 这可能受到以下因素影响:');
    console.log('   - Milvus集合的加载状态 (LoadState)');
    console.log('   - 内存限制或配置');
    console.log('   - 查询时的limit参数设置');
    console.log('   - 集合分片或分区策略');
    console.log('');

    // 检查两个路径问题
    const paths = Object.keys(snapshot.codebases || {});
    const relatedPaths = [];

    for (let i = 0; i < paths.length; i++) {
        for (let j = i + 1; j < paths.length; j++) {
            const path1 = paths[i];
            const path2 = paths[j];

            if (path1.includes(path2) || path2.includes(path1)) {
                relatedPaths.push([path1, path2]);
            }
        }
    }

    if (relatedPaths.length > 0) {
        console.log('🔍 路径重叠分析:');
        console.log('================');
        for (const [path1, path2] of relatedPaths) {
            console.log(`父子关系: ${path1} ↔ ${path2}`);
        }
        console.log('');
        console.log('说明: 这是正常行为，因为父项目和子项目可以分别索引');
        console.log('每个路径生成独立的集合，这样可以支持不同粒度的搜索');
    }

    // 具体分析turnbasedmmo_server项目
    const targetProject = 'D:\\dev\\kanata\\numadv\\turnbasedmmo_server';
    const projectInfo = snapshot.codebases[targetProject];

    if (projectInfo) {
        console.log('🎯 目标项目详细分析:');
        console.log('====================');
        console.log(`项目: ${targetProject}`);
        console.log(`总块数: ${projectInfo.totalChunks || 0}`);
        console.log(`已索引文件: ${projectInfo.indexedFiles || 0}`);
        console.log('');

        if (projectInfo.totalChunks > 28) {
            console.log('⚠️  潜在问题:');
            console.log(`   总块数 (${projectInfo.totalChunks}) >> Loaded Entities (28)`);
            console.log('');
            console.log('可能的原因:');
            console.log('1. Milvus查询默认limit限制 (代码中看到limit=16384)');
            console.log('2. 集合未完全加载到内存');
            console.log('3. 网络连接问题导致查询结果不完整');
            console.log('4. Milvus集合分片或分区配置');
            console.log('5. 向量数据库写入过程中出现部分失败');
        }
    }
}

analyzeLoadedEntities();