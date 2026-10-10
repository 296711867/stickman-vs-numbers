#!/usr/bin/env bash
# 字狂潮 v2 → GitHub stickman-vs-numbers 仓库 v2 分支 · 一键发布
# 用法：在本目录（字狂潮v2-全局货币/）运行：  bash push-v2.sh "提交说明"
set -e
REPO="$(dirname "$PWD")/火柴人大战数字"
SRC="$PWD"
MSG="${1:-docs: 字狂潮 v2 迭代更新}"

cd "$REPO"
# 0) main 上有未提交的跟踪文件改动时拒绝发布（防止误带 / 防止 rm 丢改动）
if [ -n "$(git status --porcelain | grep -v '^??')" ]; then
  echo "❌ main 有未提交改动，请先提交 main 再发布"; exit 1
fi

git rev-parse --verify v2 >/dev/null 2>&1 || git checkout -b v2
git checkout v2

# 1) 清空分支工作区。-f 必须有：暂存残留会让普通 rm 失败，被吞掉后私有文件会混入公开分支（已踩坑）
git rm -rfq . 2>/dev/null || true
# 2) git rm 会删掉 .gitignore，必须先恢复，否则软著资料等本地私有文件失去 ignore 保护（已踩坑）
git checkout main -- .gitignore
# 3) 拷入 v2 最新内容并提交
cp -r "$SRC"/. .
git add -A
git commit -m "$MSG"

# 4) 防泄漏闸门：commit 后校验 HEAD 树，私有目录 / wx harness / 备份文件 一律中止（不会 push）
if git -c core.quotepath=false ls-tree -r --name-only HEAD | grep -qE "软件著作权|_wxp/|\.bak$"; then
  echo "❌ 检测到私有文件混入，已回滚（未 push）"
  git reset -q --hard HEAD~1
  git checkout main
  exit 1
fi

git push origin v2
git checkout main
echo "✅ 已发布到 v2 分支，本地已切回 main"
