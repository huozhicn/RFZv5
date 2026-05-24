#!/usr/bin/env python3
"""
生成产品 embedding → 写入 SDB

用法:
  python3 embed-products.py          # 全部产品
  python3 embed-products.py --id product:p_jgj  # 单个
"""
import json, sys, os, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))

# 先找 config.yaml: 同目录 > server/config.yaml
CFG_PATH = Path(__file__).parent / "config.yaml"
if not CFG_PATH.exists():
    CFG_PATH = Path(__file__).parent.parent / "server" / "config.yaml"

import yaml
with open(CFG_PATH) as f:
    cfg = yaml.safe_load(f)

SF = cfg["siliconflow"]
API_KEY = os.getenv("SILICONFLOW_API_KEY") or SF["api_key"]
BASE = SF["base_url"]
MODEL = SF.get("model", "Pro/BAAI/bge-m3")

SDB = cfg["sdb"]
SDB_URL = SDB["url"].replace("ws://", "http://").replace("wss://", "https://")

def sdb_query(sql):
    req = urllib.request.Request(
        f"{SDB_URL}/sql",
        data=sql.encode(),
        headers={
            "Content-Type": "text/plain",
            "Accept": "application/json",
            "Surreal-NS": SDB["namespace"],
            "Surreal-DB": SDB["database"],
        },
    )
    # basic auth
    import base64
    cred = base64.b64encode(f"{SDB['username']}:{SDB['password']}".encode()).decode()
    req.add_header("Authorization", f"Basic {cred}")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())

def embed(text):
    """调用 SiliconFlow bge-m3 生成 1024 维向量"""
    body = json.dumps({"model": MODEL, "input": text, "encoding_format": "float"}).encode()
    req = urllib.request.Request(
        f"{BASE}/embeddings",
        data=body,
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
    return [round(v, 6) for v in data["data"][0]["embedding"]]

def process_one(rid):
    # 获取产品文本
    result = sdb_query(f"SELECT name, description FROM {rid}")
    rows = result[0].get("result", [])
    if not rows:
        print(f"  ⚠️ {rid} 不存在"); return
    row = rows[0]
    text = f"{row.get('name','')} {row.get('description','')}".strip()
    if not text:
        print(f"  ⚠️ {rid} 无文本"); return

    print(f"  {rid}: {text[:60]}...")
    try:
        vec = embed(text)
    except Exception as e:
        print(f"  ❌ Embedding 失败: {e}"); return

    vec_json = json.dumps(vec)
    r = sdb_query(f"UPDATE {rid} SET content_embedding = {vec_json}")
    status = r[0].get("status", "?")
    print(f"  {'✅' if status=='OK' else '❌'} {status} (维度 {len(vec)})")

def process_all():
    r = sdb_query("SELECT id, name FROM product")
    rows = r[0].get("result", [])
    print(f"共 {len(rows)} 个产品\n")
    for row in rows:
        process_one(row["id"])

if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--id":
        process_one(sys.argv[2])
    else:
        process_all()
