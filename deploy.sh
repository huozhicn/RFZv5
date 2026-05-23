     1|     1|#!/bin/bash
     2|     2|# ============================================================================
     3|     3|# RFZv5 部署脚本
     4|     4|# 构建 Admin 前端 → 推送到 VPS → 重载 Caddy
     5|     5|# ============================================================================
     6|     6|
     7|     7|set -euo pipefail
     8|     8|
     9|     9|VPS_IP="212.64.90.2"
    10|    10|VPS_USER="ubuntu"
    11|    11|VPS_PASS="sFM@0@LhTY#Oi&"
    12|    12|
    13|    13|echo "════════════════════════════════════════"
    14|    14|echo "  RFZv5 部署 → ${VPS_USER}@${VPS_IP}"
    15|    15|echo "════════════════════════════════════════"
    16|    16|echo ""
    17|    17|
    18|    18|cd admin-react
    19|    19|
    20|    20|echo "  构建中..."
    21|    21|npm run build 2>&1 | tail -3
    22|    22|
    23|    23|# 全量清空 VPS 目录（解决旧 hash 文件残留导致不同步）
    24|    24|echo "  上传到 /var/www/v5-dist/..."
    25|    25|sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" \
    26|    26|  "rm -rf /var/www/v5-dist/*"
    27|    27|sshpass -p "${VPS_PASS}" scp -o StrictHostKeyChecking=no -r dist/* "${VPS_USER}@${VPS_IP}:/var/www/v5-dist/"
    28|    28|
    29|    29|# 版本验证
    30|    30|LOCAL_HASH=$(git rev-parse --short HEAD)
    31|    31|echo "  ✅ admin 已部署 (v.${LOCAL_HASH})"
    32|    32|
    33|    33|# 重载 Caddy
    34|    34|sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" \
    35|    35|  "echo '${VPS_PASS}' | sudo -S systemctl reload caddy" 2>/dev/null
    36|    36|echo "  ✅ Caddy 已重载"
    37|    37|
    38|    38|cd ..
    39|    39|
    40|    40|echo ""
    41|    41|echo "════════════════════════════════════════"
    42|    42|echo "  部署完成"
    43|    43|echo "  Admin: https://admin.rufazao.com/v5"
    44|    44|echo "════════════════════════════════════════"
    45|    45|