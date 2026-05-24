#!/bin/bash
# ============================================================================
# RFZv5 Schema Import — 流通处数据库初始化
# ============================================================================
# NS: huozhi / DB: rfv5_dist
# ============================================================================

set -euo pipefail

VPS_IP="212.64.90.2"
VPS_USER="ubuntu"
VPS_PASS="sFM@0@LhTY#Oi&"
SDB_ENDPOINT="http://127.0.0.1:8000"
SDB_USER="root"
SDB_PASS="root"
NAMESPACE="huozhi"
DATABASE="rfv5_dist"
SCHEMA_DIR="/data/sdb/schema"

echo "════════════════════════════════════════"
echo "  RFZv5 Schema 导入 → ${NAMESPACE}/${DATABASE}"
echo "════════════════════════════════════════"
echo ""

# 先上传所有 schema 文件到 VPS
echo "  📤 上传 schema 文件..."
sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} \
  "mkdir -p ${SCHEMA_DIR}"
for f in schema/*.surql; do
  sshpass -p "${VPS_PASS}" scp -o StrictHostKeyChecking=no "$f" "${VPS_USER}@${VPS_IP}:${SCHEMA_DIR}/"
done
echo "  ✅ schema 文件已上传"
echo ""

# Phase A: surreal import（DEFINE TABLE / FIELD / INDEX）
echo "=== Phase A: 导入表结构 ==="
for f in 00-bootstrap 01-customer 02-pricing 03-inventory 04-order 05-restock 06-user 07-store-settings 10-agent; do
  echo "  [import] ${f}.surql..."
  sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "
    /usr/local/bin/surreal import \
      --endpoint ${SDB_ENDPOINT} \
      --username ${SDB_USER} \
      --password ${SDB_PASS} \
      --namespace ${NAMESPACE} \
      --database ${DATABASE} \
      ${SCHEMA_DIR}/${f}.surql
  " 2>&1 | grep -iE "error|already exists" || echo "    ✅"
done

echo ""
echo "=== Phase A2: 补齐已有表新增字段 ==="
sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "
  curl -s -u ${SDB_USER}:${SDB_PASS} \
    -H 'surreal-ns: ${NAMESPACE}' \
    -H 'surreal-db: ${DATABASE}' \
    '${SDB_ENDPOINT}/sql' \
    --data-binary \"
DEFINE FIELD product_type ON product TYPE string ASSERT \\\$value IN ['商品', '活动'] DEFAULT '商品' COMMENT '类型';
DEFINE FIELD is_listed ON product TYPE bool DEFAULT true COMMENT '上架';
DEFINE FIELD start_date ON product TYPE datetime DEFAULT NONE COMMENT '活动开始日期';
DEFINE FIELD end_date ON product TYPE datetime DEFAULT NONE COMMENT '活动截止日期';
DEFINE FIELD cycle_description ON product TYPE string DEFAULT '' COMMENT '周期说明';
DEFINE FIELD capacity ON product TYPE int DEFAULT 0 COMMENT '报名上限(0=不限)';
DEFINE FIELD payment_method ON sales_order TYPE string ASSERT \\\$value IN ['在线支付', '线下付款'] DEFAULT '在线支付' COMMENT '支付方式';
\"
" 2>&1 | grep -iE 'error' | head -3 || echo "  ✅ 字段已补齐"

echo ""
echo "=== Phase B: 导入种子数据 ==="
sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "
  /usr/local/bin/surreal import \
    --endpoint ${SDB_ENDPOINT} \
    --username ${SDB_USER} \
    --password ${SDB_PASS} \
    --namespace ${NAMESPACE} \
    --database ${DATABASE} \
    ${SCHEMA_DIR}/99-seed.surql
" 2>&1 | grep -iE "error" || echo "  ✅ 种子数据已导入"

echo ""
echo "=== Phase C: 验证 ==="
sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "
  curl -s -u ${SDB_USER}:${SDB_PASS} \
    -H 'surreal-ns: ${NAMESPACE}' \
    -H 'surreal-db: ${DATABASE}' \
    '${SDB_ENDPOINT}/sql' \
    --data-binary 'INFO FOR DB;'
" 2>&1 | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d[0]['result']
tables = r.get('tables', {})
print(f\"  表数量: {len(tables)}\")
for t in sorted(tables):
    print(f\"    📋 {t}\")
"

echo ""
echo "════════════════════════════════════════"
echo "  ✅ RFZv5 Schema 导入完成"
echo "════════════════════════════════════════"
