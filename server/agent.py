"""
如意 Agent Server v2 — 两段式处理
Step 1: LLM 生成 SQL + intent
Step 2: Server 执行 SQL → LLM 格式化为自然语言
"""
import asyncio
import json
import logging
import os
import re
import sys
from pathlib import Path

import yaml
from surrealdb import AsyncSurreal

ROOT = Path(__file__).resolve().parent

# ── 配置 ──

with open(ROOT / "config.yaml") as f:
    CFG = yaml.safe_load(f)

CFG["llm"]["api_key"] = os.getenv("DEEPSEEK_API_KEY") or CFG["llm"]["api_key"]
if not CFG["llm"]["api_key"]:
    raise RuntimeError("DEEPSEEK_API_KEY 未设置")

SDB = CFG["sdb"]
LLM = CFG["llm"]
PROMPTS = CFG["prompts"]
RT = CFG["runtime"]
PROMPTS_DIR = ROOT / PROMPTS["dir"]

# 消息去重：防止同一消息被并发处理多次（竞态条件）
_processing: set[str] = set()
_proc_lock = asyncio.Lock()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("ruyi-agent")


# ── 提示词 ──

def load_prompt(name: str) -> str:
    path = PROMPTS_DIR / name
    return path.read_text(encoding="utf-8") if path.exists() else ""


def build_system_prompt(user_role: str | None = None) -> str:
    from context import build_context
    parts = [
        load_prompt(PROMPTS["system"]),
        load_prompt(PROMPTS["actions"]),
        build_context(user_role),
    ]
    return "\n\n---\n\n".join(p for p in parts if p)


_prompt_cache: dict[str, str] = {}

def get_cached_prompt(role: str | None) -> str:
    key = role or "default"
    if key not in _prompt_cache:
        _prompt_cache[key] = build_system_prompt(role)
    return _prompt_cache[key]


# ── LLM ──

async def call_llm(system: str, user: str, temp: float = 0.3) -> str:
    import httpx
    body = {
        "model": LLM["model"],
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temp,
        "max_tokens": LLM.get("max_tokens", 2000),
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{LLM['base_url']}/chat/completions",
            headers={"Authorization": f"Bearer {LLM['api_key']}", "Content-Type": "application/json"},
            json=body,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


def parse_json_from_response(content: str) -> dict:
    """从 LLM 回复中提取 JSON 对象"""
    m = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", content)
    if m:
        try: return json.loads(m.group(1))
        except json.JSONDecodeError: pass
    m = re.search(r"(\{[\s\S]*?\})", content)
    if m:
        try: return json.loads(m.group(1))
        except json.JSONDecodeError: pass
    return {}


def parse_actions_from_response(content: str) -> list:
    m = re.search(r"```(?:json)?\s*(\[[\s\S]*?\])\s*```\s*$", content)
    if m:
        try: return json.loads(m.group(1))
        except json.JSONDecodeError: pass
    m = re.search(r"(\[[\s\S]*?\])\s*$", content)
    if m:
        try:
            a = json.loads(m.group(1))
            return a if isinstance(a, list) else []
        except json.JSONDecodeError: pass
    return []


# ── SDB ──

def _extract_rows(result) -> list:
    if isinstance(result, list):
        if result and isinstance(result[0], dict) and "result" in result[0]:
            return result[0]["result"] or []
        if result and isinstance(result[0], list):
            return result[0]
        return result
    return []


async def get_user_info(db: AsyncSurreal, user_id: str) -> dict:
    try:
        rows = _extract_rows(await db.query(
            f"SELECT id, name, display_name, role FROM {user_id}"
        ))
        return rows[0] if rows else {}
    except Exception as e:
        log.warning(f"获取用户 {user_id} 信息失败: {e}")
    return {}


async def get_user_store(db: AsyncSurreal, user_id: str) -> str | None:
    """流通处无多租户/多门店，直接返回 None"""
    return None


# ── 消息处理 ──

async def process_message(db: AsyncSurreal, msg: dict, sem: asyncio.Semaphore):
    record_id = msg["id"]           # 保留原始 RecordID，给 DB 查询用
    msg_id = str(record_id)         # 转字符串，给 _processing set 用

    # ── 去重：同一消息不重复处理 ──
    async with _proc_lock:
        if msg_id in _processing:
            log.info(f"跳过 {msg_id}: 已在处理中")
            return
        _processing.add(msg_id)

    try:
        async with sem:
            user_input = msg.get("user_input", "") or ""
            created_by = str(msg.get("created_by", ""))

            # ── 原子认领：确认消息仍是 pending 才处理 ──
            check = await db.query(f"SELECT status FROM {record_id};")
            rows = _extract_rows(check)
            current_status = rows[0].get("status") if rows else None
            if current_status != "pending":
                log.info(f"跳过 {msg_id}: 状态已是 {current_status}")
                return

            log.info(f"处理 {msg_id}: {user_input[:80]}")

            try:
                await db.query(f"UPDATE {record_id} SET status = 'processing';")

                # ── 用户上下文 ──
                user = await get_user_info(db, created_by) if created_by else {}
                role = user.get("role")
                store_id = await get_user_store(db, created_by) if created_by else None

                # ── Step 1: LLM 生成 SQL ──
                step1_prompt = get_cached_prompt(role)
                step1_msg = user_input
                if store_id:
                    step1_msg = (
                        f"当前用户绑定的门店: {store_id}\n\n"
                        f"用户名: {user.get('name', '未知')}\n"
                        f"用户消息: {user_input}"
                    )
                # 也把用户角色注入
                step1_msg = f"[用户角色: {role or '未知'}]\n{step1_msg}"

                response1 = await call_llm(step1_prompt, step1_msg, temp=0.1)
                plan = parse_json_from_response(response1)
                intent = plan.get("intent", "chat")

                log.info(f"  {msg_id} intent={intent} sql={str(plan.get('sql',''))[:80]}")

                final_response = ""
                final_actions = []

                if intent == "chat":
                    # 纯聊天，直接返回
                    final_response = response1.split("```")[0].strip()
                    # 从 Step1 回复中提取 actions
                    final_actions = parse_actions_from_response(response1)

                elif intent in ("query", "action"):
                    sql = plan.get("sql", "")
                    vars_dict = plan.get("vars", {})

                    if not sql:
                        final_response = "抱歉，我无法理解这个查询。请换个说法试试？"
                    else:
                        # 注入 store_id 变量（如果用户是门店店长/店员）
                        if store_id:
                            vars_dict["store"] = store_id

                        # SDB SDK 参数化查询可能不兼容 $变量，直接字符串替换
                        for k, v in vars_dict.items():
                            sql = sql.replace(f"${k}", str(v))

                        log.info(f"  {msg_id} sql={sql[:120]}")

                        # 去掉 SQL 中的 ```sql ``` 标记
                        sql = re.sub(r"```(?:sql)?\s*", "", sql).strip()
                        sql = sql.rstrip("```").strip()

                        try:
                            db_result = await db.query(sql)
                            rows = _extract_rows(db_result)
                            log.info(f"  {msg_id} SQL 结果: {len(rows)} 行")

                            if intent == "query":
                                # ── Step 2: LLM 格式化 ──
                                rows_json = json.dumps(rows[:50], ensure_ascii=False, default=str)  # 最多 50 行
                                step2_msg = (
                                    f"用户的原始问题: {user_input}\n\n"
                                    f"SQL 查询结果 (共 {len(rows)} 条):\n{rows_json}\n\n"
                                    f"请用自然语言格式化展示这些结果。如果数据超过 10 条请选重要的列。"
                                )
                                formatted = await call_llm(step1_prompt, step2_msg, temp=0.5)
                                final_response = formatted
                                final_actions = parse_actions_from_response(formatted)
                            else:
                                # action 类型
                                final_response = f"✅ 操作完成。影响了 {len(rows) if rows else '?'} 条记录。"
                        except Exception as db_err:
                            log.error(f"  {msg_id} SQL 执行失败: {db_err}")
                            final_response = f"查询出错了: {str(db_err)[:200]}。可能是表名或字段名不对，请换个说法试试。"
                else:
                    final_response = response1.split("```")[0].strip()

                # ── 回写 ──
                await db.query(
                    "UPDATE $rec SET response = $resp, actions = $acts, status = 'done', processed_at = time::now();",
                    {"rec": record_id, "resp": final_response, "acts": final_actions},
                )
                log.info(f"完成 {msg_id}")

            except Exception as e:
                log.error(f"处理 {msg_id} 失败: {e}")
                try:
                    await db.query(
                        "UPDATE $rec SET response = $err, status = 'error', processed_at = time::now();",
                        {"rec": record_id, "err": f"处理失败: {str(e)[:500]}"},
                    )
                except Exception:
                    log.error(f"连回写错误都失败了: {msg_id}")
    finally:
        async with _proc_lock:
            _processing.discard(msg_id)


# ── 主循环 ──

async def run_agent(db: AsyncSurreal, sem: asyncio.Semaphore):
    """单次运行：连接、处理积压、监听"""
    try:
        await db.connect()
        await db.signin({"user": SDB["username"], "pass": SDB["password"]})
        await db.use(SDB["namespace"], SDB["database"])
        log.info(f"SDB 已连接: {SDB['url']}")

        # 积压处理
        result = await db.query(
            f"SELECT * FROM agent_message WHERE status = 'pending' ORDER BY created_at LIMIT {RT['backlog_limit']};"
        )
        backlog = _extract_rows(result)
        if backlog:
            log.info(f"积压消息: {len(backlog)} 条")
            await asyncio.gather(*[process_message(db, m, sem) for m in backlog if isinstance(m, dict)])

        # LIVE SELECT
        try:
            live_id = await db.live("LIVE SELECT * FROM agent_message WHERE status = 'pending'")
            log.info(f"LIVE SELECT: {live_id}")

            async def on_msg(message: dict):
                data = message.get("result", message)
                if isinstance(data, dict) and data.get("status") == "pending":
                    mid = str(data.get("id", ""))
                    async with _proc_lock:
                        if mid in _processing:
                            return
                    asyncio.create_task(process_message(db, data, sem))

            await db.subscribe_live(live_id, on_msg)
        except Exception as e:
            log.warning(f"subscribe_live 失败 ({e})，回退轮询")
            while True:
                try:
                    result = await db.query(
                        "SELECT * FROM agent_message WHERE status = 'pending' ORDER BY created_at LIMIT 5;"
                    )
                    for m in _extract_rows(result):
                        if isinstance(m, dict):
                            mid = str(m.get("id", ""))
                            async with _proc_lock:
                                if mid in _processing:
                                    continue
                            asyncio.create_task(process_message(db, m, sem))
                except Exception as e2:
                    log.error(f"轮询错误: {e2}")
                    raise  # 不可恢复，触发外层重连
                await asyncio.sleep(RT["poll_fallback_seconds"])

    except Exception as e:
        log.error(f"连接断开: {e}")
        try:
            await db.close()
        except Exception:
            pass


async def main():
    log.info(f"如意 Agent v2 启动 | 模型: {LLM['model']} | 并发: {RT['max_concurrent']}")

    for role in [None, "管理员", "店员"]:
        get_cached_prompt(role)
    log.info(f"提示词缓存就绪 ({len(_prompt_cache)} 个角色)")

    sem = asyncio.Semaphore(RT["max_concurrent"])

    while True:
        db = AsyncSurreal(SDB["url"])
        try:
            await run_agent(db, sem)
        except Exception as e:
            log.error(f"运行异常: {e}")
        try:
            await db.close()
        except Exception:
            pass
        log.info("5 秒后重连...")
        await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(main())
