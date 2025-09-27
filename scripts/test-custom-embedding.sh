#!/bin/bash

# 自定义向量模型可用性测试脚本 (Shell版本)
# 用于快速测试任意API密钥、模型名称和URL

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认值
DEFAULT_TEST_TEXT="Hello, this is a test text for embedding."
DEFAULT_API_TYPE="openai"
DEFAULT_API_VERSION="2024-02-01"

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

# 显示帮助信息
show_help() {
    cat << 'EOF'
自定义向量模型可用性测试脚本

用法: ./scripts/test-custom-embedding.sh [选项]

必需参数:
  -k, --api-key <key>        API密钥
  -m, --model <name>         模型名称
  -u, --url <url>            API端点URL

可选参数:
  -t, --type <type>          API类型 (openai|azure, 默认: openai)
  --api-version <version>    Azure API版本 (默认: 2024-02-01)
  --text <text>              测试文本 (默认: "Hello, this is a test...")
  --basic-only               仅运行基础连接测试
  -o, --output <file>        输出报告文件路径
  -h, --help                 显示帮助信息

示例:
  # 测试Qwen模型
  ./scripts/test-custom-embedding.sh \
    --api-key "sk-xxx" \
    --model "Qwen/Qwen3-Embedding-8B" \
    --url "https://dashscope.aliyuncs.com/v1"

  # 测试Azure OpenAI
  ./scripts/test-custom-embedding.sh \
    --api-key "your-azure-key" \
    --model "text-embedding-3-small" \
    --url "https://your-resource.openai.azure.com" \
    --type azure

  # 测试本地API
  ./scripts/test-custom-embedding.sh \
    --api-key "local-key" \
    --model "local-model" \
    --url "http://localhost:8000/v1" \
    --basic-only

注意事项:
  - API端点应兼容OpenAI嵌入API格式
  - Azure类型需要特殊的URL格式和认证方式
  - 脚本会发送测试请求验证API功能
EOF
}

# 检查依赖
check_dependencies() {
    local has_all=true

    if ! command -v curl >/dev/null 2>&1; then
        log_error "缺少curl命令"
        has_all=false
    fi

    if ! command -v jq >/dev/null 2>&1; then
        log_warning "缺少jq命令，JSON解析功能受限"
    fi

    if [ "$has_all" = false ]; then
        log_error "请安装缺失的依赖"
        exit 1
    fi
}

# 测试网络连接
test_connection() {
    local url=$1
    local desc=${2:-"API端点"}

    log_info "测试连接: $desc"
    log_info "URL: $url"

    if curl -s --max-time 10 --head "$url" >/dev/null 2>&1; then
        log_success "$desc 连接成功"
        return 0
    else
        # 尝试获取更详细的错误信息
        local curl_output=$(curl -s --max-time 10 -w "%{http_code}" "$url" 2>&1)
        log_warning "$desc 连接测试: $curl_output"
        return 1
    fi
}

# 测试OpenAI兼容API
test_openai_api() {
    local api_key=$1
    local model_name=$2
    local base_url=$3
    local test_text=$4

    log_info "测试OpenAI兼容API..."
    log_info "模型: $model_name"
    log_info "端点: $base_url"

    local api_url="${base_url%/}/embeddings"
    local start_time=$(date +%s%3N)

    local response=$(curl -s --max-time 30 \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $api_key" \
        -d "{
            \"model\": \"$model_name\",
            \"input\": [\"$test_text\"],
            \"encoding_format\": \"float\"
        }" \
        -w "HTTPSTATUS:%{http_code}" \
        "$api_url")

    local end_time=$(date +%s%3N)
    local latency=$((end_time - start_time))

    local http_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')

    if [ "$http_code" = "200" ]; then
        log_success "API调用成功"
        log_info "响应延迟: ${latency}ms"

        # 尝试解析JSON响应
        if command -v jq >/dev/null 2>&1; then
            local dimension=$(echo "$body" | jq -r '.data[0].embedding | length' 2>/dev/null)
            local usage=$(echo "$body" | jq -r '.usage' 2>/dev/null)

            if [ "$dimension" != "null" ] && [ "$dimension" != "" ]; then
                log_success "向量维度: $dimension"
            fi

            if [ "$usage" != "null" ] && [ "$usage" != "" ]; then
                log_info "Token使用: $usage"
            fi
        else
            log_info "响应长度: ${#body} 字符"
        fi

        return 0
    else
        log_error "API调用失败 (HTTP $http_code)"
        log_error "响应: $body"
        return 1
    fi
}

# 测试Azure OpenAI API
test_azure_api() {
    local api_key=$1
    local deployment_name=$2
    local base_url=$3
    local test_text=$4
    local api_version=$5

    log_info "测试Azure OpenAI API..."
    log_info "部署名称: $deployment_name"
    log_info "端点: $base_url"
    log_info "API版本: $api_version"

    local api_url="${base_url%/}/openai/deployments/$deployment_name/embeddings?api-version=$api_version"
    local start_time=$(date +%s%3N)

    local response=$(curl -s --max-time 30 \
        -H "Content-Type: application/json" \
        -H "api-key: $api_key" \
        -d "{
            \"input\": [\"$test_text\"]
        }" \
        -w "HTTPSTATUS:%{http_code}" \
        "$api_url")

    local end_time=$(date +%s%3N)
    local latency=$((end_time - start_time))

    local http_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')

    if [ "$http_code" = "200" ]; then
        log_success "Azure API调用成功"
        log_info "响应延迟: ${latency}ms"

        if command -v jq >/dev/null 2>&1; then
            local dimension=$(echo "$body" | jq -r '.data[0].embedding | length' 2>/dev/null)
            if [ "$dimension" != "null" ] && [ "$dimension" != "" ]; then
                log_success "向量维度: $dimension"
            fi
        fi

        return 0
    else
        log_error "Azure API调用失败 (HTTP $http_code)"
        log_error "响应: $body"
        return 1
    fi
}

# 生成配置建议
generate_config_suggestion() {
    local api_type=$1
    local model_name=$2
    local base_url=$3
    local api_key=$4

    echo
    log_success "测试成功！以下是Claude Context配置建议:"
    echo
    echo "# 在 ~/.context/.env 中添加以下配置:"
    echo "EMBEDDING_PROVIDER=OpenAI"
    echo "EMBEDDING_MODEL=$model_name"
    echo "OPENAI_API_KEY=$api_key"
    echo "OPENAI_BASE_URL=$base_url"
    echo
    echo "# 或设置为环境变量:"
    echo "export EMBEDDING_PROVIDER=OpenAI"
    echo "export EMBEDDING_MODEL=$model_name"
    echo "export OPENAI_API_KEY=$api_key"
    echo "export OPENAI_BASE_URL=$base_url"
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -k|--api-key)
                API_KEY="$2"
                shift 2
                ;;
            -m|--model)
                MODEL_NAME="$2"
                shift 2
                ;;
            -u|--url)
                BASE_URL="$2"
                shift 2
                ;;
            -t|--type)
                API_TYPE="$2"
                shift 2
                ;;
            --api-version)
                API_VERSION="$2"
                shift 2
                ;;
            --text)
                TEST_TEXT="$2"
                shift 2
                ;;
            --basic-only)
                BASIC_ONLY=true
                shift
                ;;
            -o|--output)
                OUTPUT_FILE="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 验证参数
validate_args() {
    if [ -z "$API_KEY" ] || [ -z "$MODEL_NAME" ] || [ -z "$BASE_URL" ]; then
        log_error "缺少必需参数"
        echo
        show_help
        exit 1
    fi

    # 设置默认值
    API_TYPE=${API_TYPE:-$DEFAULT_API_TYPE}
    API_VERSION=${API_VERSION:-$DEFAULT_API_VERSION}
    TEST_TEXT=${TEST_TEXT:-$DEFAULT_TEST_TEXT}
    BASIC_ONLY=${BASIC_ONLY:-false}

    # 验证API类型
    if [ "$API_TYPE" != "openai" ] && [ "$API_TYPE" != "azure" ]; then
        log_error "不支持的API类型: $API_TYPE (支持: openai, azure)"
        exit 1
    fi
}

# 主函数
main() {
    echo "🚀 自定义向量模型可用性测试"
    echo "=================================="

    # 解析和验证参数
    parse_args "$@"
    validate_args

    # 检查依赖
    check_dependencies

    # 显示测试配置
    echo
    log_info "测试配置:"
    log_info "  API类型: $API_TYPE"
    log_info "  模型名称: $MODEL_NAME"
    log_info "  API端点: $BASE_URL"
    log_info "  API密钥: ${API_KEY:0:8}..."
    if [ "$API_TYPE" = "azure" ]; then
        log_info "  API版本: $API_VERSION"
    fi
    log_info "  测试文本: ${TEST_TEXT:0:50}..."

    # 1. 连接测试
    echo
    log_info "第一步: 连接测试"
    if ! test_connection "$BASE_URL" "API端点"; then
        log_warning "连接测试失败，但继续进行API测试"
    fi

    # 2. API功能测试
    echo
    log_info "第二步: API功能测试"

    local api_success=false

    if [ "$API_TYPE" = "azure" ]; then
        if test_azure_api "$API_KEY" "$MODEL_NAME" "$BASE_URL" "$TEST_TEXT" "$API_VERSION"; then
            api_success=true
        fi
    else
        if test_openai_api "$API_KEY" "$MODEL_NAME" "$BASE_URL" "$TEST_TEXT"; then
            api_success=true
        fi
    fi

    # 3. 生成结果报告
    echo
    log_info "第三步: 生成测试报告"

    local report_content="# 向量模型测试报告

## 测试配置
- 时间: $(date)
- API类型: $API_TYPE
- 模型名称: $MODEL_NAME
- API端点: $BASE_URL
- 测试文本: $TEST_TEXT

## 测试结果
- 连接测试: 已执行
- API功能测试: $([ "$api_success" = true ] && echo "成功" || echo "失败")

## 配置建议
$([ "$api_success" = true ] && echo "可用于Claude Context配置" || echo "需要检查API配置")
"

    if [ -n "$OUTPUT_FILE" ]; then
        echo "$report_content" > "$OUTPUT_FILE"
        log_success "报告已保存: $OUTPUT_FILE"
    fi

    # 4. 显示结果
    echo
    log_info "测试摘要:"
    if [ "$api_success" = true ]; then
        log_success "✅ 向量模型可用"
        generate_config_suggestion "$API_TYPE" "$MODEL_NAME" "$BASE_URL" "$API_KEY"

        echo
        log_info "后续步骤:"
        echo "1. 将配置添加到 ~/.context/.env"
        echo "2. 运行 Claude Context MCP 服务器"
        echo "3. 在Claude Code中使用语义搜索功能"

        exit 0
    else
        log_error "❌ 向量模型不可用"
        echo
        log_info "故障排除建议:"
        echo "- 检查API密钥是否正确"
        echo "- 验证模型名称是否存在"
        echo "- 确认API端点URL格式正确"
        echo "- 检查网络连接和防火墙设置"

        exit 1
    fi
}

# 运行主程序
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi