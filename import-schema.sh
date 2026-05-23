     1|     1|#!/bin/bash
     2|     2|# ============================================================================
     3|     3|# RFZv5 Schema Import Script for SurrealDB 3.0.5
     4|     4|# ============================================================================
     5|     5|#
     6|     6|# 目标: 将 RFZv4 全部 schema 导入到远程 VPS 的 SurrealDB 实例
     7|     7|# 命名空间: huozhi
     8|     8|# 数据库:   rfv5_dist
     9|     9|#
    10|    10|# ============================================================================
    11|    11|# 为什么写得这么啰嗦？
    12|    12|# ============================================================================
    13|    13|#
    14|    14|# 踩过的坑:
    15|    15|#   1. cat *.surql | surreal sql → 不支持 $value 参数，报 Parse error
    16|    16|#   2. surreal import --endpoint ws://  → WS 协议不支持 import
    17|    17|#   3. surreal import --endpoint http:// → 只支持 DEFINE TABLE/FIELD/INDEX 语句，
    18|    18|#      DEFINE FUNCTION / DEFINE EVENT / ALTER TABLE / DEFINE ACCESS 必须走 REST API
    19|    19|#   4. REST API header 必须用小写: surreal-ns / surreal-db (不是 Surreal-NS)
    20|    20|#   5. schema 文件里的 \ 续行符是 2.x 语法，3.0.5 不支持，sed 去掉
    21|    21|#
    22|    22|# 正确流程:
    23|    23|#   Phase A: surreal import (HTTP)  → DEFINE TABLE, FIELD, INDEX
    24|    24|#   Phase B: REST API /sql endpoint → DEFINE FUNCTION, EVENT, ACCESS, ALTER TABLE
    25|    25|#
    26|    26|# ============================================================================
    27|    27|
    28|    28|set -euo pipefail
    29|    29|
    30|    30|# ── 配置 ──────────────────────────────────────────────────────────
    31|    31|VPS_IP="212.64.90.2"
    32|    32|VPS_USER="ubuntu"
    33|    33|VPS_PASS="sFM@0@LhTY#Oi&"
    34|    34|SDB_ENDPOINT="http://127.0.0.1:8000"
    35|    35|SDB_USER="root"
    36|    36|SDB_PASS="root"
    37|    37|NAMESPACE="huozhi"
    38|    38|DATABASE="rfv5_dist"
    39|    39|SCHEMA_DIR="/data/sdb/schema"
    40|    40|
    41|    41|# ── Phase A: 用 surreal import 导入纯 DEFINE 语句 ─────────────────
    42|    42|# 这些文件只包含 DEFINE TABLE / DEFINE FIELD / DEFINE INDEX
    43|    43|# surreal import 对这类语句最稳定
    44|    44|IMPORT_FILES=(
    45|    45|  "01-identity.surql"
    46|    46|  "02-tenant.surql"
    47|    47|  "03-product.surql"
    48|    48|  "04-product-selection.surql"
    49|    49|  "05-inventory.surql"
    50|    50|  "05b-store-inventory.surql"
    51|    51|  "06-order.surql"
    52|    52|  "07-crm.surql"
    53|    53|  "08-activity.surql"
    54|    54|  "09-finance.surql"
    55|    55|  "10-commission.surql"
    56|    56|  "11-h5-user.surql"
    57|    57|  "12-h5-content.surql"
    58|    58|  "13-dharma-event.surql"
    59|    59|  "14-docs.surql"
    60|    60|  "20-agent.surql"
    61|    61|)
    62|    62|
    63|    63|# ── Phase B: 用 REST API 导入非纯 DEFINE 语句 ─────────────────────
    64|    64|# 这些文件包含 DEFINE FUNCTION, DEFINE EVENT, ALTER TABLE, DEFINE ACCESS
    65|    65|# surreal import 不支持这些，必须走 /sql endpoint
    66|    66|#
    67|    67|# 注意: 文件中有 2.x 的 \ 续行符，需要在发送前用 sed 去掉
    68|    68|REST_FILES=(
    69|    69|  "15-functions.surql"
    70|    70|  "16-events.surql"
    71|    71|  "17-permissions.surql"
    72|    72|  "18-access.surql"
    73|    73|)
    74|    74|
    75|    75|# ============================================================================
    76|    76|# Phase A: Import DEFINE-only files
    77|    77|# ============================================================================
    78|    78|echo "=== Phase A: Importing DEFINE statements ==="
    79|    79|echo "  目标: ${NAMESPACE}/${DATABASE}"
    80|    80|echo "  方式: surreal import (HTTP)"
    81|    81|echo ""
    82|    82|
    83|    83|# 先导入种子文件 (设置 NS/DB 上下文)
    84|    84|sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "
    85|    85|  /usr/local/bin/surreal import \
    86|    86|    --endpoint ${SDB_ENDPOINT} \
    87|    87|    --username ${SDB_USER} \
    88|    88|    --password ${SDB_PASS} \
    89|    89|    --namespace ${NAMESPACE} \
    90|    90|    --database ${DATABASE} \
    91|    91|    ${SCHEMA_DIR}/00-init.surql
    92|    92|" 2>&1
    93|    93|
    94|    94|for f in "${IMPORT_FILES[@]}"; do
    95|    95|  echo "  [import] ${f}..."
    96|    96|  sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "
    97|    97|    /usr/local/bin/surreal import \
    98|    98|      --endpoint ${SDB_ENDPOINT} \
    99|    99|      --username ${SDB_USER} \
   100|   100|      --password ${SDB_PASS} \
   101|   101|      --namespace ${NAMESPACE} \
   102|   102|      --database ${DATABASE} \
   103|   103|      ${SCHEMA_DIR}/${f}
   104|   104|  " 2>&1 | grep -E "error|ERROR|executed" || true
   105|   105|done
   106|   106|
   107|   107|echo ""
   108|   108|echo "=== Phase A 完成 ==="
   109|   109|
   110|   110|# ============================================================================
   111|   111|# Phase B: REST API for non-DEFINE statements
   112|   112|# ============================================================================
   113|   113|echo ""
   114|   114|echo "=== Phase B: Importing FUNCTIONS / EVENTS / PERMISSIONS / ACCESS ==="
   115|   115|echo "  方式: REST API /sql endpoint"
   116|   116|echo "  ⚠️  会自动去掉 2.x 续行符 \\"
   117|   117|echo ""
   118|   118|
   119|   119|for f in "${REST_FILES[@]}"; do
   120|   120|  echo "  [rest] ${f}..."
   121|   121|  sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "
   122|   122|    # 去掉 2.x 的 \ 续行符（3.0.5 不支持）
   123|   123|    TMPFILE=\$(mktemp)
   124|   124|    sed 's/\\\\$//g' ${SCHEMA_DIR}/${f} > \$TMPFILE
   125|   125|    curl -s -u ${SDB_USER}:${SDB_PASS} \
   126|   126|      -H 'Content-Type: text/plain' \
   127|   127|      -H 'surreal-ns: ${NAMESPACE}' \
   128|   128|      -H 'surreal-db: ${DATABASE}' \
   129|   129|      '${SDB_ENDPOINT}/sql' \
   130|   130|      --data-binary @\$TMPFILE 2>&1 | python3 -c "
   131|   131|import sys, json
   132|   132|d = json.load(sys.stdin)
   133|   133|errs = [r for r in d if r.get('status') != 'OK']
   134|   134|if errs:
   135|   135|    for e in errs[:5]:
   136|   136|        msg = str(e.get('result', '?'))
   137|   137|        # 'already exists' 不算错（幂等导入）
   138|   138|        if 'already exists' not in msg:
   139|   139|            print('  ⚠️  ' + msg[:120])
   140|   140|else:
   141|   141|    print('  ✅')
   142|   142|" 2>&1
   143|   143|    rm -f \$TMPFILE
   144|   144|  "
   145|   145|done
   146|   146|
   147|   147|echo ""
   148|   148|echo "=== 全部完成 ==="
   149|   149|echo "  NS/DB: ${NAMESPACE}/${DATABASE}"
   150|   150|echo "  端点:   ${SDB_ENDPOINT}"
   151|   151|echo ""
   152|   152|