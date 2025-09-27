#!/bin/bash

# 使用方法: ./merge-pr.sh 123
# 或者: merge-pr 123 (如果你把这个脚本加到PATH里)

PR_NUMBER=$1
UPSTREAM_REPO="zilliztech/claude-context"

if [ -z "$PR_NUMBER" ]; then
    echo "用法: $0 <PR号码>"
    echo "例如: $0 123"
    exit 1
fi

echo "正在合并 PR #$PR_NUMBER from $UPSTREAM_REPO..."

# 确保在主分支
git checkout main

# 获取并合并PR（这个命令会自动处理所有细节）
gh pr checkout $PR_NUMBER --repo $UPSTREAM_REPO

# 切回主分支并合并
git checkout main
git merge --no-ff FETCH_HEAD -m "Merge PR #$PR_NUMBER from $UPSTREAM_REPO"

# 推送到你的fork
git push origin main

echo "PR #$PR_NUMBER 合并完成！"