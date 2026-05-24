#!/usr/bin/env python3
"""
embed-proxy — 前端向量搜索代理
POST /api/embed  {"text": "线香"}  →  {"vector": [...]}

读同目录 config.yaml 的 siliconflow 段：
  siliconflow:
    api_key: sk-xxx
    model: Pro/BAAI/bge-m3
    base_url: https://api.siliconflow.cn/v1
"""
import json, sys, os
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import yaml
with open(ROOT / "config.yaml") as f:
    cfg = yaml.safe_load(f)

SF = cfg.get("siliconflow", {})
API_KEY = os.getenv("SILICONFLOW_API_KEY") or SF.get("api_key", "")
MODEL = SF.get("model", "Pro/BAAI/bge-m3")
BASE_URL = SF.get("base_url", "https://api.siliconflow.cn/v1")
PORT = int(SF.get("port", 19901))

if not API_KEY:
    print("FATAL: siliconflow.api_key 未设置", file=sys.stderr)
    sys.exit(1)

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path != "/api/embed":
            self.send_response(404)
            self._cors()
            self.end_headers()
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            text = body.get("text", "").strip()
            if not text:
                self._json(400, {"error": "text is empty"})
                return

            # 调 SiliconFlow API
            req_body = json.dumps({
                "model": MODEL,
                "input": text,
                "encoding_format": "float",
            }).encode()
            req = urllib.request.Request(
                f"{BASE_URL}/embeddings",
                data=req_body,
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
            vec = data["data"][0]["embedding"]
            self._json(200, {"vector": vec, "dimensions": len(vec)})

        except Exception as e:
            self._json(500, {"error": str(e)})

    def _json(self, code, data):
        self.send_response(code)
        self._cors()
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Type", "application/json")

    def log_message(self, fmt, *args):
        print(f"[embed] {args[0]}", file=sys.stderr)

if __name__ == "__main__":
    print(f"embed-proxy :{PORT} | model={MODEL}", file=sys.stderr)
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
