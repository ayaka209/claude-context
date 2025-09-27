#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// 获取命令行参数
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
外部项目索引工具

用法:
  node scripts/index-project.js <项目路径> [选项]

选项:
  --env <文件路径>      指定.env配置文件路径 (默认: ./.env)
  --clean              清理现有索引后重新索引
  --force              强制重新索引，即使项目已存在
  --help, -h           显示此帮助信息

示例:
  node scripts/index-project.js /path/to/project
  node scripts/index-project.js /path/to/project --env /path/to/.env
  node scripts/index-project.js /path/to/project --clean
  node scripts/index-project.js "C:\\Users\\Dev\\MyProject" --force

配置要求:
  需要.env文件包含向量数据库和嵌入模型配置:
  - ZILLIZ_ENDPOINT (或 MILVUS_ENDPOINT)
  - ZILLIZ_TOKEN (或 MILVUS_TOKEN)
  - OPENAI_API_KEY (或其他嵌入模型的API密钥)
  - EMBEDDING_MODEL (可选，默认: text-embedding-3-small)

注意: 项目路径必须是有效的目录路径
`);
    process.exit(0);
}

// 解析参数
const projectPath = args[0];
const envIndex = args.indexOf('--env');
const envFile = envIndex !== -1 && envIndex + 1 < args.length ? args[envIndex + 1] : './.env';

const options = {
    clean: args.includes('--clean'),
    force: args.includes('--force'),
    envFile: envFile
};

// 加载环境变量
function loadEnvironmentConfig(envFile) {
    const resolvedEnvFile = path.resolve(envFile);

    if (!fs.existsSync(resolvedEnvFile)) {
        console.error(`❌ 错误: 配置文件不存在: ${resolvedEnvFile}`);
        console.log('💡 提示: 创建.env文件并包含以下配置:');
        console.log(`
ZILLIZ_ENDPOINT=your_zilliz_endpoint
ZILLIZ_TOKEN=your_zilliz_token
OPENAI_API_KEY=your_openai_api_key
EMBEDDING_MODEL=text-embedding-3-small
`);
        process.exit(1);
    }

    console.log(`📄 使用配置文件: ${resolvedEnvFile}`);

    // 读取.env文件
    try {
        const envContent = fs.readFileSync(resolvedEnvFile, 'utf8');
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

        // 验证必需的配置
        const requiredKeys = ['ZILLIZ_ENDPOINT', 'ZILLIZ_TOKEN'];
        const missingKeys = requiredKeys.filter(key =>
            !envVars[key] && !envVars[key.replace('ZILLIZ', 'MILVUS')]
        );

        if (missingKeys.length > 0) {
            console.error(`❌ 错误: 缺少必需的配置项: ${missingKeys.join(', ')}`);
            console.log('💡 请在.env文件中添加这些配置项');
            process.exit(1);
        }

        // 验证嵌入模型配置
        const hasEmbeddingConfig = envVars['OPENAI_API_KEY'] ||
                                 envVars['GOOGLE_API_KEY'] ||
                                 envVars['VOYAGE_API_KEY'] ||
                                 envVars['OLLAMA_ENDPOINT'];

        if (!hasEmbeddingConfig) {
            console.warn('⚠️  警告: 未检测到嵌入模型API密钥，可能需要以下之一:');
            console.warn('   - OPENAI_API_KEY');
            console.warn('   - GOOGLE_API_KEY');
            console.warn('   - VOYAGE_API_KEY');
            console.warn('   - OLLAMA_ENDPOINT');
        }

        return envVars;
    } catch (error) {
        console.error(`❌ 错误: 无法读取配置文件: ${error.message}`);
        process.exit(1);
    }
}

// 验证项目路径
function validateProjectPath(projectPath) {
    if (!projectPath) {
        console.error('❌ 错误: 必须提供项目路径');
        process.exit(1);
    }

    const resolvedPath = path.resolve(projectPath);

    if (!fs.existsSync(resolvedPath)) {
        console.error(`❌ 错误: 项目路径不存在: ${resolvedPath}`);
        process.exit(1);
    }

    if (!fs.statSync(resolvedPath).isDirectory()) {
        console.error(`❌ 错误: 路径不是目录: ${resolvedPath}`);
        process.exit(1);
    }

    return resolvedPath;
}

// 获取快照文件路径
function getSnapshotPath() {
    const contextDir = path.join(os.homedir(), '.context');
    return path.join(contextDir, 'mcp-codebase-snapshot.json');
}

// 读取快照文件
function readSnapshot() {
    const snapshotPath = getSnapshotPath();

    if (!fs.existsSync(snapshotPath)) {
        return { codebases: [] };
    }

    try {
        const content = fs.readFileSync(snapshotPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.warn(`⚠️  警告: 无法读取快照文件: ${error.message}`);
        return { codebases: [] };
    }
}

// 写入快照文件
function writeSnapshot(snapshot) {
    const snapshotPath = getSnapshotPath();
    const contextDir = path.dirname(snapshotPath);

    // 确保目录存在
    if (!fs.existsSync(contextDir)) {
        fs.mkdirSync(contextDir, { recursive: true });
    }

    try {
        fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
        return true;
    } catch (error) {
        console.error(`❌ 错误: 无法写入快照文件: ${error.message}`);
        return false;
    }
}

// 清理项目索引
function cleanProjectIndex(projectPath, snapshot) {
    const normalizedPath = path.normalize(projectPath);

    // 处理不同版本的快照格式
    if (Array.isArray(snapshot.codebases)) {
        // v1 格式：codebases 是数组
        const originalLength = snapshot.codebases.length;
        snapshot.codebases = snapshot.codebases.filter(codebase => {
            const codebasePath = path.normalize(codebase.path || codebase.rootPath);
            return codebasePath !== normalizedPath;
        });

        const removedCount = originalLength - snapshot.codebases.length;
        if (removedCount > 0) {
            console.log(`🧹 已清理 ${removedCount} 个现有索引记录`);
        }
    } else if (typeof snapshot.codebases === 'object') {
        // v2 格式：codebases 是对象
        if (snapshot.codebases[normalizedPath]) {
            delete snapshot.codebases[normalizedPath];
            console.log(`🧹 已清理现有索引记录: ${normalizedPath}`);
        }
    }

    return snapshot;
}

// 启动MCP服务器进行索引
function startIndexing(projectPath, envVars) {
    return new Promise((resolve, reject) => {
        console.log(`🚀 开始索引项目: ${projectPath}`);

        // 构建MCP服务器命令
        const mcpServerPath = path.join(__dirname, '..', 'packages', 'mcp', 'dist', 'index.js');

        if (!fs.existsSync(mcpServerPath)) {
            console.error('❌ 错误: MCP服务器未构建，请先运行 pnpm build:mcp');
            reject(new Error('MCP server not built'));
            return;
        }

        // 设置环境变量
        const env = {
            ...process.env,
            ...envVars,  // 合并.env文件中的配置
            CLAUDE_CONTEXT_PROJECT_PATH: projectPath,
            CLAUDE_CONTEXT_AUTO_INDEX: 'true'
        };

        // 启动MCP服务器
        const mcpProcess = spawn('node', [mcpServerPath], {
            env,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        mcpProcess.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;

            // 显示进度信息
            if (text.includes('indexing') || text.includes('progress') || text.includes('完成')) {
                console.log(`📊 ${text.trim()}`);
            }
        });

        mcpProcess.stderr.on('data', (data) => {
            const text = data.toString();
            errorOutput += text;

            // 显示错误但不立即失败
            if (text.includes('error') || text.includes('Error')) {
                console.error(`⚠️  ${text.trim()}`);
            }
        });

        mcpProcess.on('close', (code) => {
            if (code === 0) {
                console.log('✅ 索引完成');
                resolve();
            } else {
                console.error(`❌ 索引失败，退出码: ${code}`);
                if (errorOutput) {
                    console.error('错误详情:', errorOutput);
                }
                reject(new Error(`Indexing failed with code ${code}`));
            }
        });

        mcpProcess.on('error', (error) => {
            console.error(`❌ 启动索引进程失败: ${error.message}`);
            reject(error);
        });

        // 设置超时（5分钟）
        setTimeout(() => {
            mcpProcess.kill();
            reject(new Error('索引超时'));
        }, 5 * 60 * 1000);
    });
}

// 模拟索引过程（如果MCP服务器不可用）
function simulateIndexing(projectPath, snapshot) {
    const normalizedPath = path.normalize(projectPath);

    // 创建新的索引记录
    const newCodebase = {
        status: 'indexing',
        progress: 0,
        totalFiles: 0,
        indexedFiles: 0,
        totalChunks: 0,
        indexedChunks: 0,
        lastUpdated: new Date().toISOString(),
        version: '2.0'
    };

    // 根据快照格式添加记录
    if (Array.isArray(snapshot.codebases)) {
        // v1 格式：codebases 是数组
        newCodebase.path = normalizedPath;
        newCodebase.name = path.basename(normalizedPath);
        snapshot.codebases.push(newCodebase);
    } else if (typeof snapshot.codebases === 'object') {
        // v2 格式：codebases 是对象
        if (!snapshot.codebases) {
            snapshot.codebases = {};
        }
        snapshot.codebases[normalizedPath] = newCodebase;
    } else {
        // 初始化为v2格式
        snapshot.codebases = {};
        snapshot.codebases[normalizedPath] = newCodebase;
    }

    if (writeSnapshot(snapshot)) {
        console.log('📝 已添加索引记录到快照文件');
        console.log('💡 提示: 请启动 Claude Context MCP 服务器以完成实际索引');
        return true;
    }

    return false;
}

// 主函数
async function main() {
    try {
        const resolvedPath = validateProjectPath(projectPath);
        console.log(`📁 项目路径: ${resolvedPath}`);

        // 加载环境变量配置
        const envVars = loadEnvironmentConfig(options.envFile);

        // 读取当前快照
        let snapshot = readSnapshot();

        // 检查项目是否已存在
        let existingProject = null;

        // 处理不同版本的快照格式
        if (Array.isArray(snapshot.codebases)) {
            // v1 格式：codebases 是数组
            existingProject = snapshot.codebases.find(codebase => {
                const codebasePath = path.normalize(codebase.path || codebase.rootPath);
                return codebasePath === path.normalize(resolvedPath);
            });
        } else if (typeof snapshot.codebases === 'object') {
            // v2 格式：codebases 是对象
            const normalizedPath = path.normalize(resolvedPath);
            existingProject = snapshot.codebases[normalizedPath] ? {
                path: normalizedPath,
                ...snapshot.codebases[normalizedPath]
            } : null;
        }

        if (existingProject && !options.force && !options.clean) {
            console.log('⚠️  项目已存在于索引中');
            console.log(`   状态: ${existingProject.status}`);
            console.log(`   进度: ${existingProject.progress || 0}%`);
            console.log('💡 使用 --force 强制重新索引，或 --clean 清理后重新索引');
            process.exit(0);
        }

        // 清理现有索引（如果需要）
        if (options.clean || options.force) {
            snapshot = cleanProjectIndex(resolvedPath, snapshot);
        }

        // 尝试启动实际索引
        try {
            await startIndexing(resolvedPath, envVars);
        } catch (error) {
            console.warn(`⚠️  无法启动MCP服务器索引: ${error.message}`);
            console.log('🔄 回退到模拟索引模式');

            if (!simulateIndexing(resolvedPath, snapshot)) {
                console.error('❌ 模拟索引也失败了');
                process.exit(1);
            }
        }

        console.log('🎉 索引操作完成');
        console.log('💡 使用以下命令检查索引状态:');
        console.log(`   node scripts/check-index-status.js --path "${resolvedPath}"`);

    } catch (error) {
        console.error(`❌ 操作失败: ${error.message}`);
        process.exit(1);
    }
}

// 运行主函数
main().catch(error => {
    console.error(`❌ 未处理的错误: ${error.message}`);
    process.exit(1);
});