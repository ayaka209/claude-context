#!/bin/bash

# 向量模型可用性测试脚本 (Shell版本)
# 提供快速的环境检查和基础验证

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查命令是否存在
check_command() {
    if command -v $1 >/dev/null 2>&1; then
        log_success "$1 已安装"
        return 0
    else
        log_error "$1 未安装"
        return 1
    fi
}

# 检查环境变量
check_env_var() {
    local var_name=$1
    local var_desc=$2

    if [ -n "${!var_name}" ]; then
        local var_length=${#!var_name}
        log_success "$var_desc: ✓ [长度: $var_length]"
        return 0
    else
        log_warning "$var_desc: ✗ [未设置]"
        return 1
    fi
}

# 加载环境文件
load_env_file() {
    local env_file="$HOME/.context/.env"

    if [ -f "$env_file" ]; then
        log_info "加载环境文件: $env_file"
        set -a
        source "$env_file"
        set +a
        return 0
    else
        log_warning "环境文件不存在: $env_file"
        return 1
    fi
}

# 测试网络连接
test_connection() {
    local url=$1
    local desc=$2

    log_info "测试连接: $desc"

    if curl -s --max-time 10 --head "$url" >/dev/null 2>&1; then
        log_success "$desc 连接成功"
        return 0
    else
        log_error "$desc 连接失败"
        return 1
    fi
}

# 检查Node.js和npm
check_prerequisites() {
    echo "🔍 检查先决条件..."

    local has_all=true

    if ! check_command "node"; then
        has_all=false
    else
        local node_version=$(node --version)
        log_info "Node.js版本: $node_version"
    fi

    if ! check_command "pnpm"; then
        if ! check_command "npm"; then
            has_all=false
        else
            log_warning "建议安装pnpm: npm install -g pnpm"
        fi
    fi

    if ! check_command "curl"; then
        has_all=false
    fi

    if [ "$has_all" = false ]; then
        log_error "缺少必要的依赖，请先安装"
        exit 1
    fi
}

# 检查OpenAI配置
check_openai_config() {
    echo -e "\n🤖 检查OpenAI配置..."

    local configured=true

    if ! check_env_var "OPENAI_API_KEY" "OpenAI API Key"; then
        configured=false
    fi

    if check_env_var "OPENAI_BASE_URL" "OpenAI Base URL"; then
        log_info "使用自定义端点: $OPENAI_BASE_URL"
    else
        log_info "使用默认OpenAI端点"
    fi

    if [ "$configured" = true ]; then
        log_success "OpenAI配置完整"

        # 测试OpenAI连接
        if [ -n "$OPENAI_BASE_URL" ]; then
            test_connection "$OPENAI_BASE_URL" "自定义OpenAI端点"
        else
            test_connection "https://api.openai.com" "OpenAI官方API"
        fi
    else
        log_warning "OpenAI配置不完整"
    fi

    return $([[ "$configured" == "true" ]] && echo 0 || echo 1)
}

# 检查Azure OpenAI配置
check_azure_openai_config() {
    echo -e "\n☁️  检查Azure OpenAI配置..."

    local configured=true

    if ! check_env_var "AZURE_OPENAI_API_KEY" "Azure OpenAI API Key"; then
        configured=false
    fi

    if ! check_env_var "AZURE_OPENAI_ENDPOINT" "Azure OpenAI Endpoint"; then
        configured=false
    fi

    check_env_var "AZURE_OPENAI_API_VERSION" "Azure OpenAI API Version"
    check_env_var "AZURE_OPENAI_DEPLOYMENT_NAME" "Azure OpenAI Deployment Name"

    if [ "$configured" = true ]; then
        log_success "Azure OpenAI配置完整"

        if [ -n "$AZURE_OPENAI_ENDPOINT" ]; then
            test_connection "$AZURE_OPENAI_ENDPOINT" "Azure OpenAI端点"
        fi
    else
        log_warning "Azure OpenAI配置不完整"
    fi

    return $([[ "$configured" == "true" ]] && echo 0 || echo 1)
}

# 检查其他提供商
check_other_providers() {
    echo -e "\n🌐 检查其他提供商配置..."

    # VoyageAI
    if check_env_var "VOYAGEAI_API_KEY" "VoyageAI API Key"; then
        log_success "VoyageAI配置完整"
        test_connection "https://api.voyageai.com" "VoyageAI API"
    fi

    # Gemini
    if check_env_var "GEMINI_API_KEY" "Gemini API Key"; then
        log_success "Gemini配置完整"
        if [ -n "$GEMINI_BASE_URL" ]; then
            test_connection "$GEMINI_BASE_URL" "自定义Gemini端点"
        else
            test_connection "https://generativelanguage.googleapis.com" "Gemini API"
        fi
    fi

    # Ollama
    local ollama_host=${OLLAMA_HOST:-"http://127.0.0.1:11434"}
    log_info "Ollama主机: $ollama_host"

    if test_connection "$ollama_host" "Ollama服务"; then
        log_success "Ollama服务可用"

        # 尝试获取模型列表
        if curl -s "$ollama_host/api/tags" >/dev/null 2>&1; then
            log_success "Ollama API响应正常"
        else
            log_warning "Ollama API可能未正确配置"
        fi
    fi
}

# 检查Milvus配置
check_milvus_config() {
    echo -e "\n🗄️  检查Milvus配置..."

    local configured=false

    if check_env_var "MILVUS_TOKEN" "Milvus Token (Zilliz Cloud)"; then
        configured=true
        log_info "使用Zilliz Cloud"
    fi

    if check_env_var "MILVUS_ADDRESS" "Milvus Address"; then
        configured=true
        log_info "Milvus地址: $MILVUS_ADDRESS"

        # 提取主机和端口进行连接测试
        if [[ $MILVUS_ADDRESS =~ ^https?:// ]]; then
            test_connection "$MILVUS_ADDRESS" "Milvus HTTP服务"
        else
            local host_port=(${MILVUS_ADDRESS//:/ })
            local host=${host_port[0]}
            local port=${host_port[1]:-19530}

            log_info "测试Milvus连接: $host:$port"
            if timeout 5 bash -c "</dev/tcp/$host/$port" 2>/dev/null; then
                log_success "Milvus服务端口可达"
            else
                log_warning "Milvus服务端口不可达"
            fi
        fi
    fi

    if [ "$configured" = false ]; then
        log_warning "Milvus配置不完整，需要MILVUS_TOKEN或MILVUS_ADDRESS"
    fi
}

# 运行完整测试
run_full_test() {
    echo -e "\n🧪 运行完整测试..."

    if [ -f "scripts/test-embedding.js" ]; then
        log_info "运行Node.js测试脚本..."
        node scripts/test-embedding.js
    else
        log_warning "未找到Node.js测试脚本"
    fi
}

# 生成配置模板
generate_config_template() {
    local config_file="$HOME/.context/.env.example"

    log_info "生成配置模板: $config_file"

    mkdir -p "$(dirname "$config_file")"

    cat > "$config_file" << 'EOF'
# Claude Context 环境变量配置模板
# 复制此文件到 ~/.context/.env 并填入实际值

# =============================================================================
# 嵌入提供商配置
# =============================================================================

# 嵌入提供商: OpenAI, AzureOpenAI, VoyageAI, Gemini, Ollama
EMBEDDING_PROVIDER=OpenAI

# 嵌入模型 (提供商相关)
EMBEDDING_MODEL=text-embedding-3-small

# =============================================================================
# OpenAI配置 (也用于Qwen兼容接口)
# =============================================================================

# OpenAI API密钥
OPENAI_API_KEY=your-openai-api-key-here

# OpenAI基础URL (可选，用于自定义端点，如Qwen)
# OPENAI_BASE_URL=https://dashscope.aliyuncs.com/v1

# =============================================================================
# Azure OpenAI配置
# =============================================================================

# AZURE_OPENAI_API_KEY=your-azure-openai-api-key-here
# AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
# AZURE_OPENAI_API_VERSION=2024-02-01
# AZURE_OPENAI_DEPLOYMENT_NAME=text-embedding-3-small-deployment

# =============================================================================
# 其他提供商配置
# =============================================================================

# VoyageAI API密钥
# VOYAGEAI_API_KEY=your-voyageai-api-key-here

# Google Gemini API密钥
# GEMINI_API_KEY=your-gemini-api-key-here

# Ollama配置
# OLLAMA_HOST=http://127.0.0.1:11434
# OLLAMA_MODEL=nomic-embed-text

# =============================================================================
# 向量数据库配置
# =============================================================================

# Milvus地址
MILVUS_ADDRESS=your-milvus-endpoint

# Milvus令牌 (Zilliz Cloud)
MILVUS_TOKEN=your-zilliz-cloud-api-key

# =============================================================================
# 其他配置
# =============================================================================

# 嵌入批处理大小
EMBEDDING_BATCH_SIZE=100

# 代码分割器类型
SPLITTER_TYPE=ast
EOF

    log_success "配置模板已生成: $config_file"
}

# 显示帮助信息
show_help() {
    cat << 'EOF'
向量模型可用性测试脚本

用法: ./scripts/test-embedding.sh [选项]

选项:
  --help, -h           显示帮助信息
  --full-test          运行完整测试(包括Node.js脚本)
  --template           生成配置模板
  --check-only         仅检查配置，不测试连接

环境变量:
  可以设置在 ~/.context/.env 或系统环境变量中

示例:
  ./scripts/test-embedding.sh                 # 基础检查
  ./scripts/test-embedding.sh --full-test     # 完整测试
  ./scripts/test-embedding.sh --template      # 生成配置模板
EOF
}

# 主函数
main() {
    echo "🚀 向量模型可用性测试"
    echo "========================"

    # 解析命令行参数
    local run_full_test=false
    local check_only=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --full-test)
                run_full_test=true
                shift
                ;;
            --template)
                generate_config_template
                exit 0
                ;;
            --check-only)
                check_only=true
                shift
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # 检查先决条件
    check_prerequisites

    # 加载环境文件
    load_env_file

    # 检查各种配置
    local openai_ok=false
    local azure_ok=false

    if check_openai_config; then
        openai_ok=true
    fi

    if check_azure_openai_config; then
        azure_ok=true
    fi

    check_other_providers
    check_milvus_config

    # 运行完整测试
    if [ "$run_full_test" = true ] && [ "$check_only" = false ]; then
        run_full_test
    fi

    # 总结
    echo -e "\n📊 检查总结:"

    if [ "$openai_ok" = true ] || [ "$azure_ok" = true ]; then
        log_success "至少有一个嵌入提供商已配置"
    else
        log_warning "没有完整配置的嵌入提供商"
        echo "💡 建议运行: $0 --template 生成配置模板"
    fi

    echo -e "\n🔗 相关资源:"
    echo "  - 配置文档: docs/qwen-embedding-setup.md"
    echo "  - 生成模板: $0 --template"
    echo "  - 完整测试: $0 --full-test"
}

# 运行主程序
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi