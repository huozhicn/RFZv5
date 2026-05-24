#!/usr/bin/env python3
"""从 VPS SurrealDB 生成 schema.json — 兼容两种字段格式"""
import json, subprocess, sys, re

VPS = "ubuntu@212.64.90.2"
VPS_PASS = "sFM@0@LhTY#Oi&"
NS, DB = "huozhi", "rfv5_dist"

def ssh(cmd):
    r = subprocess.run(["sshpass","-p",VPS_PASS,"ssh","-o","StrictHostKeyChecking=no",VPS, cmd],
        capture_output=True, text=True, timeout=30)
    return r.stdout

def sdb(sql):
    h = f"curl -s -u root:root 'http://127.0.0.1:8000/sql' -H 'Surreal-NS: {NS}' -H 'Surreal-DB: {DB}' -H 'Accept: application/json' --data-binary @- <<'EOF'\n{sql}\nEOF"
    out = ssh(h)
    try:
        data = json.loads(out)
        if isinstance(data, list) and data[0].get("status") == "OK":
            return data[0].get("result", data[0])
    except: pass
    return None

def parse_define_field(s):
    """Parse 'DEFINE FIELD name ON table TYPE kind ...'"""
    m = re.match(r"DEFINE FIELD (\w+) ON \w+ TYPE (\S+)(.*)", s)
    if not m: return None
    name, kind = m.group(1), m.group(2)
    rest = m.group(3)
    comment = ""
    cm = re.search(r"COMMENT\s+'([^']*)'", rest)
    if cm: comment = cm.group(1)
    assert_val = None
    am = re.search(r"ASSERT\s+(.+?)(?:\s+COMMENT|\s+PERMISSIONS|\s+DEFAULT|\s*$)", rest)
    if am: assert_val = am.group(1).strip()
    return {"name": name, "kind": resolve_kind_from_define(s), "comment": comment, "assert": assert_val, "default": None}

def resolve_kind_from_define(s):
    """Parse DEFINE FIELD ... TYPE ... from the full string"""
    # Handle 'TYPE none | record<product_category>'
    m = re.match(r"DEFINE FIELD \w+ ON \w+ TYPE (.+?)(?:\s+DEFAULT|\s+COMMENT|\s+PERMISSIONS|\s*$)", s)
    if not m: return "string"
    type_str = m.group(1).strip()
    # If it's 'none | actual_type', extract the actual type
    if ' | ' in type_str:
        parts = type_str.split(' | ')
        # Skip 'none', take the first non-none part
        for p in parts:
            p = p.strip()
            if p != 'none':
                return p
    return type_str

def gen():
    r = sdb("INFO FOR DB")
    if not r: return None
    tables = r.get("tables", {})
    skip = {"agent_message", "order_item"}
    schema = {}
    
    for t in sorted(tables):
        if t in skip: continue
        print(f"  {t}...", end=" ", flush=True)
        info = sdb(f"INFO FOR TABLE {t}")
        if not info: print("✗"); continue
        
        fields_info = info.get("fields", {})
        fields = []
        for fn, fi in fields_info.items():
            if ".*" in fn: continue
            
            if isinstance(fi, str):
                # DEFINE FIELD string format
                parsed = parse_define_field(fi)
                if parsed:
                    fields.append(parsed)
            elif isinstance(fi, dict):
                fields.append({
                    "name": fn,
"kind": fi.get("kind", "string"),
                    "comment": fi.get("comment", ""),
                    "assert": fi.get("assert") or None,
                    "default": fi.get("default") or None,
                })
        
        schema[t] = {"name": t, "fields": fields}
        recs = [f["name"] for f in fields if f["kind"].startswith("record")]
        print(f"{len(fields)}f records={recs}")
    
    return schema

if __name__ == "__main__":
    s = gen()
    if s:
        p = "/home/wang/rufazao-distribution/admin-react/public/schema.json"
        with open(p, "w") as f: json.dump(s, f, indent=2, ensure_ascii=False)
        print(f"\n✅ {p} ({len(s)} tables)")
        for t in sorted(s):
            fs = s[t]["fields"]
            kinds = {f["kind"] for f in fs}
            if "none" in kinds or "option" in kinds:
                print(f"  ⚠️ {t}: {kinds}")
    else:
        sys.exit(1)
