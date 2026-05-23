"""
RFZv5 Agent Server — 流通处 Schema Context Loader
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# ── 流通处表结构和业务规则 ──

TABLE_HINTS: dict[str, str] = {
    "user": "系统用户。字段: name, display_name, role(管理员/店员)。管理员全部权限，店员可操作销售和库存。",
    "customer": "会员信息。字段: name, phone, wechat, address, notes。",
    "product": "产品 SPU（从如法造同步）。字段: name, description, main_image_url, category→product_category, base_price, sync_source_id(如法造产品ID)。",
    "product_category": "产品类目。字段: name, sort_order。",
    "product_variant": "产品 SKU。字段: sku, name, spu→product, base_price, sync_source_id。",
    "pricing": "自主定价表。字段: variant→product_variant, price(流通处售价), is_active。",
    "store_inventory": "门店库存。字段: variant→product_variant, quantity(当前库存)。",
    "sales_order": "销售订单。字段: order_no, customer→customer(可选), total_amount, status(待付款/已付款/已发货/已完成/已取消), sync_status(pending/synced/failed), created_by→user, notes。",
    "order_item": "订单明细。字段: order→sales_order, variant→product_variant, quantity, unit_price, amount。",
    "restock_request": "补货申请（向如法造订货）。字段: variant→product_variant, quantity, reason, status(待处理/已处理/已拒绝), created_by→user。",
    "inventory_count": "盘点记录。字段: variant→product_variant, prev_stock(盘点前库存), actual_stock(实盘库存), diff(差异), reason, counted_by→user。",
    "agent_message": "Agent 对话消息。字段: user_input, response, attachments, actions, status, session_id, created_by→user。",
}

BUSINESS_RULES = [
    "管理员（role='管理员'）拥有全部权限，可查看/操作所有数据。",
    "店员（role='店员'）可以操作销售、查看库存，但可能部分管理功能受限。",
    "产品数据从如法造同步（只读），定价、库存、订单、会员是流通处自有数据。",
    "查询库存 > store_inventory 表，通过 variant 关联 product_variant。",
    "创建订单时，必须同时创建 sales_order 和 order_item，用 order→sales_order 关联。",
    "order_item.amount = quantity * unit_price，由内置函数自动计算。",
    "product_variant 的定价在 pricing 表，用户可选定价 is_active=true 的记录。",
    "补货申请 restock_request 是向如法造总部申请补货，需要选择 variant 和 quantity。",
    "盘点 inventory_count 记录了盘前库存(prev_stock)和实盘库存(actual_stock)，diff = actual_stock - prev_stock。",
    "用户说「看库存」「还有多少货」> 查 store_inventory JOIN product_variant。",
    "用户说「卖出去」「开单」> 先确认要卖什么 SKU、数量、客户(可选)，然后创建 sales_order + order_item。",
    "用户说「补货」「进货」> 创建 restock_request。",
    "创建记录前必须确认所有 SCHEMAFULL 必填字段都有值。",
    "record<> 类型的字段（如 variant、spu、customer）传参时用裸 record ID，不加引号。",
]

ACTION_TEMPLATES = """
可用的 actions 类型（放在 response 的 actions 数组中）：

1. navigate — 跳转到指定表
   { "type": "navigate", "route": "/tables/sales_order" }

2. filter — 筛选当前表（按字段过滤）
   { "type": "filter", "field": "status", "value": "待付款" }

3. data — 在对话中展示数据表格
   { "type": "data", "title": "库存概况", "columns": [{"key":"name","title":"名称"},...], "rows": [...] }

4. confirm — 需要用户确认的操作
   { "type": "confirm", "message": "确认删除吗？", "on_confirm": {"sql": "DELETE ...", "vars": {}} }

5. refresh — 刷新当前视图
   { "type": "refresh" }

注意：actions 必须是一个有效的 JSON 数组。简单的信息回复不需要 actions。
"""


def build_context(user_role: str | None = None) -> str:
    """构建 LLM 上下文"""
    parts = ["# 流通处管理系统 数据库上下文\n"]

    # ── 表清单 ──
    parts.append("## 数据表\n")
    for key in sorted(TABLE_HINTS):
        hint = TABLE_HINTS[key]
        parts.append(f"- **{key}**: {hint}")

    # ── 业务规则 ──
    parts.append("\n## 业务规则\n")
    for rule in BUSINESS_RULES:
        parts.append(f"- {rule}")

    # ── 当前用户 ──
    if user_role:
        parts.append(f"\n## 当前用户\n角色: {user_role}\n")

    # ── Action 模板 ──
    parts.append(f"\n## Action 格式\n{ACTION_TEMPLATES}\n")

    return "\n".join(parts)


if __name__ == "__main__":
    ctx = build_context("店员")
    print(ctx[:500])
    print(f"\n总长度: {len(ctx)} 字符")
