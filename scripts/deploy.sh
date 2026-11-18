#!/bin/bash
# 把静态页面发布到自己的服务器（nginx 静态站点）
# 用法：先复制 scripts/deploy.env.example 为 scripts/deploy.env 并填写，然后执行  bash scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f scripts/deploy.env ] && source scripts/deploy.env
: "${DEPLOY_SERVER:?请在 scripts/deploy.env 中设置 DEPLOY_SERVER，例如 root@1.2.3.4}"
: "${DEPLOY_DEST:?请在 scripts/deploy.env 中设置 DEPLOY_DEST，例如 /var/www/example.com}"

# 可选：本机开了代理软件导致 22 端口连不上时，在 deploy.env 里设置 DEPLOY_SOCKS=127.0.0.1:端口，经 SOCKS 代理连接
SSH_CMD=(ssh); RSH="ssh"
if [ -n "${DEPLOY_SOCKS:-}" ]; then
  SSH_CMD=(ssh -o "ProxyCommand=nc -X 5 -x $DEPLOY_SOCKS %h %p")
  RSH="ssh -o 'ProxyCommand=nc -X 5 -x $DEPLOY_SOCKS %h %p'"
fi

python3 scripts/build.py            # 先用 data/ 重新生成题库并校验
rsync -az --delete --exclude ".DS_Store" -e "$RSH" index.html css js assets "$DEPLOY_SERVER:$DEPLOY_DEST/"
# 写入版本号：脚本和样式地址带 ?v=版本号（可长期缓存）；页面发现新版本时提示刷新
VER=$(date +%s)
"${SSH_CMD[@]}" "$DEPLOY_SERVER" "sed -i 's/__BUILD__/$VER/g' $DEPLOY_DEST/index.html $DEPLOY_DEST/js/sync.js && echo $VER > $DEPLOY_DEST/version.txt && chown -R www-data:www-data $DEPLOY_DEST"
echo "已发布：${SITE_URL:-$DEPLOY_DEST}"
