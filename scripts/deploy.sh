#!/bin/bash
# 把静态页面发布到自己的服务器（nginx 静态站点）
# 用法：先复制 scripts/deploy.env.example 为 scripts/deploy.env 并填写，然后执行  bash scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f scripts/deploy.env ] && source scripts/deploy.env
: "${DEPLOY_SERVER:?请在 scripts/deploy.env 中设置 DEPLOY_SERVER，例如 root@1.2.3.4}"
: "${DEPLOY_DEST:?请在 scripts/deploy.env 中设置 DEPLOY_DEST，例如 /var/www/example.com}"

python3 scripts/build.py            # 先用 data/ 重新生成题库并校验
rsync -az --delete --exclude ".DS_Store" index.html css js assets "$DEPLOY_SERVER:$DEPLOY_DEST/"
ssh "$DEPLOY_SERVER" "chown -R www-data:www-data $DEPLOY_DEST"
echo "已发布：${SITE_URL:-$DEPLOY_DEST}"
