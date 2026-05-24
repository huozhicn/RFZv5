#!/usr/bin/env python3
"""从 VPS SurrealDB 生成 schema.json + 从 .surql 注释提取 @label/@group"""
import json, subprocess, sys, re, os
from pathlib import Path

VPS = "ubuntu@212.64.90.2"
VPS_PASS = "sFM@0@LhTY#Oi&"
NS, DB = "huozhi", "rfv5_dist"
SCHEMA_DIR = Path(__file__).resolve().parent.parent / "schema"

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

def parse_surql_annotations():
    """Parse @label and @group from all .surql files. Returns {table_name: {label, group}}."""
    annotations = {}
    for fpath in sorted(SCHEMA_DIR.glob("*.surql")):
        current_table = None
        pending_label = None
        pending_group = None
        with open(fpath) as f:
            for line in f:
                line = line.strip()
                # Capture @label / @group before DEFINE TABLE
                m = re.match(r'-- @label (.+)', line)
                if m:
                    pending_label = m.group(1).strip()
                    continue
                m = re.match(r'-- @group (.+)', line)
                if m:
                    pending_group = m.group(1).strip()
                    continue
                # DEFINE TABLE — capture accumulated annotations
                m = re.match(r'DEFINE TABLE (\w+)', line)
                if m:
                    tname = m.group(1)
                    annotations[tname] = {
                        'label': pending_label or tname,
                        'group': pending_group or 'default',
                    }
                    pending_label = None
                    pending_group = None
    return annotations

def gen():
    r = sdb("INFO FOR DB")
    if not r: return None
    tables = r.get("tables", {})
    skip = {"agent_message", "order_item"}
    schema = {}
    
    # Parse @label/@group from .surql files
    annotations = parse_surql_annotations()
    
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
        
        ann = annotations.get(t, {})
        schema[t] = {
            "name": t,
            "label": ann.get("label", t),
            "group": ann.get("group", "default"),
            "fields": fields,
        }
        recs = [f["name"] for f in fields if f["kind"].startswith("record")]
        print(f"{len(fields)}f group={schema[t]['group']} records={recs}")
    
    return schema
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
