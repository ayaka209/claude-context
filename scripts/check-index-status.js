#!/usr/bin/env node

/**
 * 检查索引进度状态脚本
 * 用于从外部检查Claude Context的索引进度
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 快照文件路径
const SNAPSHOT_FILE_PATH = path.join(os.homedir(), '.context', 'mcp-codebase-snapshot.json');

/**
 * 读取快照文件
 */
function loadSnapshot() {
    try {
        if (!fs.existsSync(SNAPSHOT_FILE_PATH)) {
            return null;
        }

        const data = fs.readFileSync(SNAPSHOT_FILE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('❌ 读取快照文件失败:', error.message);
        return null;
    }
}

/**
 * 检查是否为V2格式
 */
function isV2Format(snapshot) {
    return snapshot && snapshot.formatVersion === 'v2';
}

/**
 * 获取代码库状态信息
 */
function getCodebaseInfo(snapshot, codebasePath) {
    if (!snapshot) return null;

    if (isV2Format(snapshot)) {
        return snapshot.codebases[codebasePath] || null;
    } else {
        // V1格式兼容性
        const indexedCodebases = snapshot.indexedCodebases || [];
        if (indexedCodebases.includes(codebasePath)) {
            return {
                status: 'indexed',
                indexedFiles: 0,
                totalChunks: 0,
                indexStatus: 'completed',
                lastUpdated: snapshot.lastUpdated || 'unknown'
            };
        }

        // 检查索引中的代码库
        let indexingCodebases = [];
        let progress = 0;

        if (Array.isArray(snapshot.indexingCodebases)) {
            indexingCodebases = snapshot.indexingCodebases;
        } else if (snapshot.indexingCodebases && typeof snapshot.indexingCodebases === 'object') {
            indexingCodebases = Object.keys(snapshot.indexingCodebases);
            progress = snapshot.indexingCodebases[codebasePath] || 0;
        }

        if (indexingCodebases.includes(codebasePath)) {
            return {
                status: 'indexing',
                indexingPercentage: progress,
                lastUpdated: snapshot.lastUpdated || 'unknown'
            };
        }

        return null;
    }
}

/**
 * 获取所有代码库状态
 */
function getAllCodebasesStatus(snapshot) {
    if (!snapshot) return [];

    const results = [];

    if (isV2Format(snapshot)) {
        for (const [codebasePath, info] of Object.entries(snapshot.codebases)) {
            // 检查路径是否仍然存在
            const exists = fs.existsSync(codebasePath);
            results.push({
                path: codebasePath,
                exists: exists,
                ...info
            });
        }
    } else {
        // V1格式兼容性
        const indexedCodebases = snapshot.indexedCodebases || [];
        for (const codebasePath of indexedCodebases) {
            const exists = fs.existsSync(codebasePath);
            results.push({
                path: codebasePath,
                exists: exists,
                status: 'indexed',
                indexedFiles: 0,
                totalChunks: 0,
                indexStatus: 'completed',
                lastUpdated: snapshot.lastUpdated || 'unknown'
            });
        }

        // 添加索引中的代码库
        let indexingCodebases = [];
        if (Array.isArray(snapshot.indexingCodebases)) {
            indexingCodebases = snapshot.indexingCodebases.map(path => ({ path, progress: 0 }));
        } else if (snapshot.indexingCodebases && typeof snapshot.indexingCodebases === 'object') {
            indexingCodebases = Object.entries(snapshot.indexingCodebases).map(([path, progress]) => ({ path, progress }));
        }

        for (const { path: codebasePath, progress } of indexingCodebases) {
            const exists = fs.existsSync(codebasePath);
            results.push({
                path: codebasePath,
                exists: exists,
                status: 'indexing',
                indexingPercentage: progress,
                lastUpdated: snapshot.lastUpdated || 'unknown'
            });
        }
    }

    return results;
}

/**
 * 格式化状态显示
 */
function formatStatus(info) {
    if (!info) return '未找到';

    switch (info.status) {
        case 'indexed':
            return `✅ 已索引 (${info.indexedFiles || 0} 文件, ${info.totalChunks || 0} 块)`;
        case 'indexing':
            return `🔄 索引中 (${info.indexingPercentage || 0}%)`;
        case 'indexfailed':
            return `❌ 索引失败: ${info.errorMessage || '未知错误'}`;
        default:
            return `❓ 未知状态: ${info.status}`;
    }
}

/**
 * 格式化时间
 */
function formatTime(timeString) {
    if (!timeString || timeString === 'unknown') return '未知';

    try {
        const date = new Date(timeString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch {
        return timeString;
    }
}

/**
 * 显示摘要信息
 */
function showSummary(codebases) {
    const summary = {
        total: codebases.length,
        indexed: 0,
        indexing: 0,
        failed: 0,
        notFound: 0
    };

    for (const codebase of codebases) {
        if (!codebase.exists) {
            summary.notFound++;
            continue;
        }

        switch (codebase.status) {
            case 'indexed':
                summary.indexed++;
                break;
            case 'indexing':
                summary.indexing++;
                break;
            case 'indexfailed':
                summary.failed++;
                break;
        }
    }

    console.log('\n📊 状态摘要:');
    console.log(`   总计: ${summary.total}`);
    console.log(`   已索引: ${summary.indexed}`);
    console.log(`   索引中: ${summary.indexing}`);
    console.log(`   失败: ${summary.failed}`);
    console.log(`   路径不存在: ${summary.notFound}`);

    return summary;
}

/**
 * 主函数
 */
function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    console.log('🔍 Claude Context 索引状态检查器');
    console.log('================================');

    const snapshot = loadSnapshot();

    if (!snapshot) {
        console.log('❌ 未找到快照文件或文件无效');
        console.log(`📁 快照文件路径: ${SNAPSHOT_FILE_PATH}`);
        console.log('💡 请确保已运行Claude Context MCP服务器');
        process.exit(1);
    }

    console.log(`📁 快照文件: ${SNAPSHOT_FILE_PATH}`);
    console.log(`📅 格式版本: ${isV2Format(snapshot) ? 'v2' : 'v1'}`);
    console.log(`🕐 最后更新: ${formatTime(snapshot.lastUpdated)}`);

    if (command === '--path' && args[1]) {
        // 检查特定路径
        const targetPath = path.resolve(args[1]);
        console.log(`\n🎯 检查路径: ${targetPath}`);

        const info = getCodebaseInfo(snapshot, targetPath);
        if (info) {
            console.log(`   状态: ${formatStatus(info)}`);
            console.log(`   最后更新: ${formatTime(info.lastUpdated)}`);

            if (info.status === 'indexing') {
                console.log(`   进度: ${info.indexingPercentage || 0}%`);
            } else if (info.status === 'indexed') {
                console.log(`   文件数: ${info.indexedFiles || 0}`);
                console.log(`   代码块数: ${info.totalChunks || 0}`);
                console.log(`   索引状态: ${info.indexStatus === 'completed' ? '完成' : '达到限制'}`);
            } else if (info.status === 'indexfailed' && info.lastAttemptedPercentage) {
                console.log(`   失败前进度: ${info.lastAttemptedPercentage}%`);
            }
        } else {
            console.log('   状态: ❓ 未找到记录');
        }

        // 检查路径是否存在
        if (fs.existsSync(targetPath)) {
            console.log('   路径: ✅ 存在');
        } else {
            console.log('   路径: ❌ 不存在');
        }

    } else if (command === '--json') {
        // 输出JSON格式
        const codebases = getAllCodebasesStatus(snapshot);
        console.log(JSON.stringify({
            snapshotPath: SNAPSHOT_FILE_PATH,
            formatVersion: isV2Format(snapshot) ? 'v2' : 'v1',
            lastUpdated: snapshot.lastUpdated,
            codebases: codebases
        }, null, 2));

    } else if (command === '--summary') {
        // 仅显示摘要
        const codebases = getAllCodebasesStatus(snapshot);
        showSummary(codebases);

    } else if (command === '--watch') {
        // 监控模式
        console.log('\n👀 监控模式 (按 Ctrl+C 退出)');

        let lastUpdate = snapshot.lastUpdated;

        const watchInterval = setInterval(() => {
            const currentSnapshot = loadSnapshot();
            if (currentSnapshot && currentSnapshot.lastUpdated !== lastUpdate) {
                lastUpdate = currentSnapshot.lastUpdated;
                console.log(`\n🔄 检测到更新: ${formatTime(lastUpdate)}`);

                const codebases = getAllCodebasesStatus(currentSnapshot);
                const indexingCodebases = codebases.filter(c => c.status === 'indexing');

                if (indexingCodebases.length > 0) {
                    console.log('📈 索引进度:');
                    for (const codebase of indexingCodebases) {
                        console.log(`   ${path.basename(codebase.path)}: ${codebase.indexingPercentage || 0}%`);
                    }
                } else {
                    showSummary(codebases);
                }
            }
        }, 2000); // 每2秒检查一次

        // 优雅退出
        process.on('SIGINT', () => {
            clearInterval(watchInterval);
            console.log('\n👋 监控已停止');
            process.exit(0);
        });

    } else {
        // 默认显示所有状态
        console.log('\n📋 所有代码库状态:');

        const codebases = getAllCodebasesStatus(snapshot);

        if (codebases.length === 0) {
            console.log('   无代码库记录');
        } else {
            for (const codebase of codebases) {
                const pathDisplay = codebase.path.length > 60
                    ? '...' + codebase.path.slice(-57)
                    : codebase.path;

                console.log(`\n📂 ${pathDisplay}`);
                console.log(`   状态: ${formatStatus(codebase)}`);
                console.log(`   路径: ${codebase.exists ? '✅ 存在' : '❌ 不存在'}`);
                console.log(`   更新: ${formatTime(codebase.lastUpdated)}`);
            }
        }

        showSummary(codebases);
    }

    // 显示可用命令
    if (!command || command === '--help') {
        console.log('\n💡 可用命令:');
        console.log('   node scripts/check-index-status.js                    # 显示所有状态');
        console.log('   node scripts/check-index-status.js --path <路径>      # 检查特定路径');
        console.log('   node scripts/check-index-status.js --summary         # 仅显示摘要');
        console.log('   node scripts/check-index-status.js --json           # JSON格式输出');
        console.log('   node scripts/check-index-status.js --watch          # 监控模式');
        console.log('   node scripts/check-index-status.js --help           # 显示帮助');
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    loadSnapshot,
    getCodebaseInfo,
    getAllCodebasesStatus,
    formatStatus,
    SNAPSHOT_FILE_PATH
};