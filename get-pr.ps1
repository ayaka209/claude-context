param(
    [Parameter(Mandatory=$true)]
    [int]$PRNumber
)

$UpstreamRepo = "zilliztech/claude-context"

Write-Host "正在合并 PR #$PRNumber from $UpstreamRepo..." -ForegroundColor Green

try {
    # 确保在主分支
    git checkout main
    if ($LASTEXITCODE -ne 0) { 
        throw "切换到main分支失败"
    }

    # 获取并checkout PR
    gh pr checkout $PRNumber --repo $UpstreamRepo
    if ($LASTEXITCODE -ne 0) { 
        throw "获取PR失败"
    }

    # 切回主分支并合并
    git checkout main
    if ($LASTEXITCODE -ne 0) { 
        throw "切换回main分支失败"
    }

    git merge --no-ff FETCH_HEAD -m "Merge PR #$PRNumber from $UpstreamRepo"
    if ($LASTEXITCODE -ne 0) { 
        throw "合并PR失败"
    }

    # 推送到你的fork
    git push origin main
    if ($LASTEXITCODE -ne 0) { 
        throw "推送失败"
    }

    Write-Host "PR #$PRNumber 合并完成！" -ForegroundColor Green
}
catch {
    Write-Host "错误: $_" -ForegroundColor Red
    exit 1
}