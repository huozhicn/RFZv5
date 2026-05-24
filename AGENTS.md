# AGENTS.md — RFZv5 Agent 工作指令

## 🚨 最高原则：Schema 是唯一真相源

**schema/ 目录下的 .surql 文件是唯一被修改的源文件。**

1. 任何 DB 结构变更 → **先改本地 .surql** → git commit → 再导入实例
2. **绝对禁止直接在 DB 上改表结构**
3. 调试时不得已临时改了 DB → **立刻回写到本地 .surql 并 commit**

---

## 架构总览

```
RFZv5 = 两个独立系统

  如法造 (Rufazao)           流通处 (Distribution)
  ────────────────           ─────────────────────
  产品主数据                  H5 在线商城
  供应链管理                  独立 DB
  CRM                        独立管理后台
  订单履约                    独立域名
                             从如法造导入产品
                             订单回传如法造
```

详见 `ARCHITECTURE.md`。

## 流通处 — 当前唯一在做的系统

### 数据边界

| 自有数据 | 从如法造同步（只读） |
|----------|---------------------|
| customer（会员） | product（SPU） |
| sales_order（订单） | product_variant（SKU） |
| order_item（订单明细） | product_category（类目） |
| store_inventory（库存） | |
| inventory_count（盘点） | |
| restock_request（补货） | |

### 角色

- 管理员：全部权限
- 店员：销售、查看库存

### 技术栈

- 前端：React 19 + TypeScript + Vite
- 后端：SurrealDB 3.0
- Agent：Python + DeepSeek
- 部署：VPS + Caddy + systemd

## 继承 v45 的成功模式

1. **Schema-driven UI** — SchemaTable / DetailPanel 从 .surql 自动生成
2. **ChatPanel + Agent** — 两段式处理（LLM 生成 SQL → 执行 → 格式化）
3. **菜单从注释驱动** — `-- @label` / `-- @group`
4. **FIELD_ZH 映射** — 所有字段名中文显示
5. **配置外置** — LLM prompt / API Key 独立于代码
6. **单一真相源** — .surql 是唯一的 schema 定义
7. **零第三方 UI 库** — 纯 React + CSS

## 抛弃 v45 的包袱

- ❌ 多租户（tenant 字段）— 流通处自己的 DB，不需要
- ❌ 6 种角色权限 — 只有 2 种
- ❌ 复杂的跨表 FETCH — 表少，关系简单
- ❌ 40+ 张表 — 流通处只需要 16 张

## agent_message 通信协议（不变）

```sql
INSERT INTO agent_message {
  user_input: $msg,
  status: 'pending',
  session_id: $sid,
  created_by: $uid
};
```

## 构建部署

```bash
cd admin-react && npm run build
bash deploy.sh
bash import-schema.sh
```

## H5 商城

独立部署在 `m.rufazao.com`，前端直连 SDB（visitor 只读 + 订单直写）。

### 页面清单 (15 页)

| 页面 | 路由 | TabBar | 说明 |
|------|------|:---:|------|
| 首页 | `/` | ✅ | 轮播、分类、活动横滑、推荐、公告 |
| 商品列表 | `/products` | ✅ | 分类Tab + 活动Tab + 搜索 |
| 商品详情 | `/product/:id` | - | 变体选择 + 加购 |
| 活动列表 | `/activities` | ✅ | 进行中/往期分区 |
| 活动详情 | `/activity/:id` | - | 直接报名弹窗（不经过购物车） |
| 购物车 | `/cart` | ✅ | localStorage |
| 确认下单 | `/checkout` | - | 地址选择 + 支付方式 |
| 订单详情 | `/order/:id` | - | 需登录或 just_placed_order token |
| 我的 | `/orders` | ✅ | 登录后看订单/活动报名 |
| 登录 | `/login` | - | 手机号+密码 |
| 编辑资料 | `/profile/edit` | - | |
| 修改密码 | `/profile/password` | - | |
| 搜索 | `/search` | - | CONTAINS 全文搜索 |
| 流通处介绍 | `/store` | - | 静态页 |
| 收货地址 | `/address` | - | 多地址管理 |

### 导航规则

- **所有页面**统一顶部三栏导航：`🏠 回家` | `标题居中` | `🔍 搜索`
- 首页不显示🏠（已在首页），搜索页不显示🔍（避免死循环）
- TabBar 只在 5 个主页面显示

### 安全规则

- 订单详情强制鉴权——未登录重定向到 `/login`
- 登录用户只能查看自己的订单（`WHERE customer=$cid`）
- 未登录用户下单/报名后通过 `sessionStorage just_placed_order` token 临时查看
- 禁止匿名手机号查订单

## SDB 3.0 常见坑

### ORDER BY 字段必须在 SELECT 中

```sql
-- ❌ 错误：SDB 3.0 报 400 "Missing order idiom"
SELECT id, name FROM product ORDER BY created_at DESC

-- ✅ 正确
SELECT id, name, created_at FROM product ORDER BY created_at DESC
```

### record<> 字段插值不加引号

```sql
-- ❌ 错误
customer: 'user:admin'

-- ✅ 正确
customer: user:admin
```
