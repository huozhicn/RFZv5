"""
RFZv45 Agent Server — Schema Context Loader
从 menu-config.json + SDB INFOR FOR TABLE 生成 LLM 上下文
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MENU_CONFIG = ROOT / "admin-react" / "src" / "lib" / "menu-config.json"
# 兜底：VPS 部署路径
if not MENU_CONFIG.exists():
    MENU_CONFIG = Path(__file__).resolve().parent / "admin-react" / "src" / "lib" / "menu-config.json"

# ── 已知表关系和业务规则 ──
TABLE_HINTS: dict[str, str] = {
    "user": "平台/租户员工。字段: name, phone, current_role(角色), current_tenant(所属租户)。PERMISSIONS: 经理+管理员可见全部。",
    "membership": "RELATION: user → tenant。字段: role, store(门店员工必填), status。门店店长/店员绑定 store。",
    "tenant": "租户/寺庙机构。字段: name, tenant_type(福慧小店/福慧社区/国学机构/连锁总部/禅意馆/独立寺院)。",
    "store": "门店。字段: name, tenant→tenant, store_type。PERMISSIONS: 门店店长只能看/改自己门店。",
    "store_inventory": "门店库存。字段: store→store, variant→product_variant, quantity, inv_type(owned/consigned/self_built)。PERMISSIONS: 门店店长只看自己门店。",
    "inventory_count": "盘点记录。字段: store→store, variant→product_variant, expected_qty, actual_qty, diff, inv_type, task→sop_task。PERMISSIONS: 门店店长只看自己门店。",
    "product": "产品 SPU。字段: name, is_platform_catalog, owner_tenant。平台商品全员可见。",
    "product_variant": "产品 SKU。字段: spu→product, name, unit_price, retail_price。",
    "sales_order": "销售订单。字段: tenant→tenant, store→store, operator→user, order_type(法会项目/流通处供货/直销/分销), total_amount, status。PERMISSIONS: 门店店长看本租户。",
    "restock_request": "补货申请。字段: store→store, variant→product_variant, quantity, status。PERMISSIONS: 门店店长看自己门店。",
    "activity": "营销活动。字段: tenant→tenant, name, type, start_date, end_date, status。",
    "customer": "客户 CRM。字段: name, phone, org→organization, level, source。PERMISSIONS: 平台+经理可见。",
    "dharma_event": "法会活动。字段: name, temple, event_date, status(洽谈/筹备/执行/完成)。PERMISSIONS: 仅平台。",
    "sop_task": "SOP 任务。字段: title, task_type, assigned_to→user, store→store, status。PERMISSIONS: 租户内可见。",
    "product_return": "退换货。字段: tenant→tenant, order→sales_order, variant→product_variant, reason, status(待处理/已处理/已关闭)。",
    "agent_message": "Agent 对话消息。字段: user_input, response, actions, status, session_id, created_by→user。",
    "h5_user": "C端用户。字段: phone, nickname, avatar_url, tenant→tenant。",
    "order_item": "订单明细。字段: order→sales_order, variant→product_variant, quantity, unit_price。",
    "tenant_product_selection": "租户选品。字段: tenant→tenant, variant→product_variant, commission_rate。",
}

BUSINESS_RULES = [
    "门店店长（current_role='门店店长'）只能查看/操作自己门店的数据。门店通过 membership 表的 store 字段绑定。",
    "店员（current_role='店员'）权限同门店店长，但部分操作受限。",
    "经理（current_role='经理'）可以查看所有门店的数据。",
    "平台管理员（current_role='平台管理员'）拥有全部权限。",
    "业务员（current_role='业务员'）可以查看本租户的数据，负责客户和销售。",
    "查询库存应该优先查 store_inventory 表（门店库存），而不是 inbound/outbound（仓库出入库）。",
    "盘点数据在 inventory_count 表，通过 store 字段关联门店。",
    "用户说「看库存」「查库存」→ 查 store_inventory，按 store.name 分组展示。",
    "用户说「盘点」→ 查 inventory_count，展示差异（diff = actual_qty - expected_qty）。",
    "创建记录前必须确认所有 SCHEMAFULL 必填字段都有值。",
]

ACTION_TEMPLATES = """
可用的 actions 类型（放在 response 的 actions 数组中）：

1. navigate — 跳转到指定表
   { "type": "navigate", "route": "/tables/store_inventory" }

2. filter — 筛选当前表
   { "type": "filter", "field": "store", "value": "store:l6tcfoio5gefypz4frtq" }

3. data — 在对话中展示数据表格
   { "type": "data", "title": "库存概况", "columns": [{"key":"name","title":"名称"},...], "rows": [...] }

4. confirm — 需要用户确认的操作
   { "type": "confirm", "message": "确认删除吗？", "on_confirm": {"sql": "DELETE ...", "vars": {}} }

5. refresh — 刷新当前视图
   { "type": "refresh" }

注意：actions 必须是一个有效的 JSON 数组，不能为空。简单的信息回复不需要 actions。
"""


def load_menu() -> dict:
    """加载菜单配置"""
    with open(MENU_CONFIG) as f:
        return json.load(f)


def build_context(user_role: str | None = None) -> str:
    """构建 LLM 上下文"""
    menu = load_menu()
    
    parts = ["# RFZv45 数据库上下文\n"]
    
    # ── 表清单 ──
    parts.append("## 数据表\n")
    for group in menu.get("groups", []):
        parts.append(f"### {group['label']}")
        for t in group.get("tables", []):
            key = t["key"]
            label = t["label"]
            hint = TABLE_HINTS.get(key, "")
            parts.append(f"- **{key}** ({label}): {hint}")
        parts.append("")
    
    # ── 业务规则 ──
    parts.append("## 业务规则\n")
    for rule in BUSINESS_RULES:
        parts.append(f"- {rule}")
    
    # ── 当前用户 ──
    if user_role:
        parts.append(f"\n## 当前用户\n角色: {user_role}\n")
    
    # ── Action 模板 ──
    parts.append(f"\n## Action 格式\n{ACTION_TEMPLATES}\n")
    
    return "\n".join(parts)


if __name__ == "__main__":
    ctx = build_context("门店店长")
    print(ctx[:500])
    print(f"\n总长度: {len(ctx)} 字符")
