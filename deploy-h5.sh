#!/bin/bash
# H5 商城部署
set -euo pipefail

VPS_IP="212.64.90.2"
VPS_USER="ubuntu"
VPS_PASS="sFM@0@LhTY#Oi&"
TARGET="/var/www/m"

echo "════════════════════════════════════════"
echo "  H5 商城部署 → ${VPS_USER}@${VPS_IP}"
echo "════════════════════════════════════════"
echo ""

cd "$(dirname "$0")/h5-mall"

echo "  构建中..."
npm run build 2>&1 | tail -3

echo "  上传到 ${TARGET}/..."
sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" \
  "rm -rf ${TARGET}/*"
sshpass -p "${VPS_PASS}" scp -o StrictHostKeyChecking=no -r dist/* "${VPS_USER}@${VPS_IP}:${TARGET}/"

LOCAL_HASH=$(cd .. && git rev-parse --short HEAD)
echo "  ✅ H5 商城已部署 (v.${LOCAL_HASH})"

sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" \
  "echo '${VPS_PASS}' | sudo -S systemctl reload caddy" 2>/dev/null
echo "  ✅ Caddy 已重载"

cd ..

echo ""
echo "════════════════════════════════════════"
echo "  部署完成"
echo "  H5: https://m.rufazao.com"
echo "════════════════════════════════════════"
