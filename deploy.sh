#!/bin/bash
# RFZv5 部署 — Admin 前端
set -euo pipefail

VPS_IP="212.64.90.2"
VPS_USER="ubuntu"
VPS_PASS="sFM@0@LhTY#Oi&"

echo "════════════════════════════════════════"
echo "  RFZv5 部署 → ${VPS_USER}@${VPS_IP}"
echo "════════════════════════════════════════"
echo ""

cd admin-react

echo "  构建中..."
npm run build 2>&1 | tail -3

echo "  上传到 /var/www/v5-dist/..."
sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" \
  "rm -rf /var/www/v5-dist/*"
sshpass -p "${VPS_PASS}" scp -o StrictHostKeyChecking=no -r dist/* "${VPS_USER}@${VPS_IP}:/var/www/v5-dist/"

LOCAL_HASH=$(git rev-parse --short HEAD)
echo "  ✅ admin 已部署 (v.${LOCAL_HASH})"

sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" \
  "echo '${VPS_PASS}' | sudo -S systemctl reload caddy" 2>/dev/null
echo "  ✅ Caddy 已重载"

cd ..

echo ""
echo "════════════════════════════════════════"
echo "  部署完成"
echo "  Admin: https://admin.rufazao.com/v5"
echo "════════════════════════════════════════"
