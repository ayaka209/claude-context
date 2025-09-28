#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// 获取命令行参数
const args = process.argv.slice(2);

function showHelp() {
    console.log(`
索引日志查看器
==============

用法:
  node scripts/view-logs.js [选项] [项目名称]

选项:
  --list                     列出所有可用的日志文件
  --latest [项目名称]         显示指定项目的最新日志
  --follow [项目名称]         实时跟踪最新日志文件
  --path <日志文件路径>       显示指定日志文件
  --clean                    清理超过7天的旧日志文件
  --help, -h                显示此帮助信息

示例:
  node scripts/view-logs.js --list
  node scripts/view-logs.js --latest turnbasedmmo_server
  node scripts/view-logs.js --follow turnbasedmmo_server
  node scripts/view-logs.js --path ~/.context/logs/index-myproject-2024-01-01T10-00-00.log
  node scripts/view-logs.js --clean

日志格式:
  每行日志都是JSON格式，包含timestamp、level、project、message和可选的data字段
`);
}

function getLogDirectory() {
    return path.join(os.homedir(), '.context', 'logs');
}

function listLogFiles() {
    const logDir = getLogDirectory();

    if (!fs.existsSync(logDir)) {
        console.log('📁 日志目录不存在: ' + logDir);
        return;
    }

    const files = fs.readdirSync(logDir)
        .filter(file => file.startsWith('index-') && file.endsWith('.log'))
        .map(file => {
            const filePath = path.join(logDir, file);
            const stats = fs.statSync(filePath);

            // Parse project name from filename: index-projectname-timestamp.log
            const match = file.match(/^index-(.+?)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.log$/);
            const projectName = match ? match[1] : 'unknown';

            return {
                name: file,
                path: filePath,
                project: projectName,
                size: stats.size,
                mtime: stats.mtime
            };
        })
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    if (files.length === 0) {
        console.log('📁 没有找到日志文件');
        return;
    }

    console.log(`📋 找到 ${files.length} 个日志文件:\n`);

    // Group by project
    const projects = {};
    files.forEach(file => {
        if (!projects[file.project]) {
            projects[file.project] = [];
        }
        projects[file.project].push(file);
    });

    Object.keys(projects).forEach(project => {
        console.log(`📂 项目: ${project}`);
        projects[project].forEach((file, index) => {
            const sizeKB = Math.round(file.size / 1024);
            const timeStr = file.mtime.toLocaleString('zh-CN');
            const latest = index === 0 ? ' [最新]' : '';

            console.log(`   ${index + 1}. ${file.name} (${sizeKB}KB, ${timeStr})${latest}`);
        });
        console.log();
    });
}

function getLatestLogFile(projectName) {
    const logDir = getLogDirectory();

    if (!fs.existsSync(logDir)) {
        return null;
    }

    const files = fs.readdirSync(logDir)
        .filter(file => {
            if (!file.startsWith('index-') || !file.endsWith('.log')) {
                return false;
            }

            if (projectName) {
                const match = file.match(/^index-(.+?)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.log$/);
                return match && match[1] === projectName;
            }

            return true;
        })
        .map(file => ({
            name: file,
            path: path.join(logDir, file),
            mtime: fs.statSync(path.join(logDir, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    return files.length > 0 ? files[0].path : null;
}

function formatLogEntry(line) {
    try {
        const entry = JSON.parse(line);

        // Color codes
        const colors = {
            info: '\x1b[36m',    // cyan
            warn: '\x1b[33m',    // yellow
            error: '\x1b[31m',   // red
            debug: '\x1b[90m',   // gray
            reset: '\x1b[0m'
        };

        const color = colors[entry.level] || '';
        const timestamp = new Date(entry.timestamp).toLocaleString('zh-CN');

        let output = `${color}[${entry.level.toUpperCase()}]${colors.reset} ${timestamp} [${entry.project}] ${entry.message}`;

        if (entry.data && Object.keys(entry.data).length > 0) {
            output += '\n  ' + JSON.stringify(entry.data, null, 2).split('\n').join('\n  ');
        }

        return output;
    } catch (error) {
        return line; // Return original line if parsing fails
    }
}

function viewLogFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`❌ 日志文件不存在: ${filePath}`);
        return;
    }

    console.log(`📖 查看日志文件: ${filePath}`);
    console.log('=' .repeat(80));

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');

    lines.forEach(line => {
        if (line.trim()) {
            console.log(formatLogEntry(line));
        }
    });
}

function followLogFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`❌ 日志文件不存在: ${filePath}`);
        return;
    }

    console.log(`👀 实时跟踪日志文件: ${filePath}`);
    console.log('按 Ctrl+C 退出');
    console.log('=' .repeat(80));

    let lastSize = 0;

    function checkForUpdates() {
        try {
            const stats = fs.statSync(filePath);

            if (stats.size > lastSize) {
                const content = fs.readFileSync(filePath, 'utf8');
                const newContent = content.slice(lastSize);

                newContent.trim().split('\n').forEach(line => {
                    if (line.trim()) {
                        console.log(formatLogEntry(line));
                    }
                });

                lastSize = stats.size;
            }
        } catch (error) {
            console.error(`读取日志文件时出错: ${error.message}`);
        }
    }

    // Initial read
    checkForUpdates();

    // Poll for updates every 1 second
    const interval = setInterval(checkForUpdates, 1000);

    // Handle Ctrl+C
    process.on('SIGINT', () => {
        console.log('\n👋 停止跟踪日志文件');
        clearInterval(interval);
        process.exit(0);
    });
}

function cleanOldLogs() {
    const logDir = getLogDirectory();

    if (!fs.existsSync(logDir)) {
        console.log('📁 日志目录不存在');
        return;
    }

    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7天前
    const files = fs.readdirSync(logDir)
        .filter(file => file.startsWith('index-') && file.endsWith('.log'));

    let deletedCount = 0;

    files.forEach(file => {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime.getTime() < cutoffTime) {
            fs.unlinkSync(filePath);
            console.log(`🗑️  删除旧日志: ${file}`);
            deletedCount++;
        }
    });

    console.log(`🧹 清理完成，删除了 ${deletedCount} 个旧日志文件`);
}

// 主逻辑
if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    showHelp();
    process.exit(0);
}

if (args.includes('--list')) {
    listLogFiles();
} else if (args.includes('--latest')) {
    const projectIndex = args.indexOf('--latest');
    const projectName = projectIndex + 1 < args.length ? args[projectIndex + 1] : null;

    const latestLogFile = getLatestLogFile(projectName);

    if (latestLogFile) {
        viewLogFile(latestLogFile);
    } else {
        console.log(`❌ 没有找到${projectName ? ` 项目 "${projectName}" 的` : ''}日志文件`);
    }
} else if (args.includes('--follow')) {
    const projectIndex = args.indexOf('--follow');
    const projectName = projectIndex + 1 < args.length ? args[projectIndex + 1] : null;

    const latestLogFile = getLatestLogFile(projectName);

    if (latestLogFile) {
        followLogFile(latestLogFile);
    } else {
        console.log(`❌ 没有找到${projectName ? ` 项目 "${projectName}" 的` : ''}日志文件`);
    }
} else if (args.includes('--path')) {
    const pathIndex = args.indexOf('--path');

    if (pathIndex + 1 < args.length) {
        const logPath = args[pathIndex + 1];
        viewLogFile(path.resolve(logPath));
    } else {
        console.error('❌ 使用 --path 选项时必须指定日志文件路径');
        process.exit(1);
    }
} else if (args.includes('--clean')) {
    cleanOldLogs();
} else {
    console.error('❌ 未知选项。使用 --help 查看帮助信息');
    process.exit(1);
}