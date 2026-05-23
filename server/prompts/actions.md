## 操作示例

### 查询库存
用户："看看有哪些产品库存"
```json
{
  "intent": "query",
  "sql": "SELECT variant.name AS 产品, store_inventory.quantity AS 库存 FROM store_inventory JOIN variant ON variant = product_variant.id LIMIT 10;"
}
```

### 创建订单
用户："卖一本金刚经给客户张三"
```json
{
  "intent": "action",
  "sql": "BEGIN TRANSACTION; LET $cust = (SELECT id FROM customer WHERE name = '张三')[0].id; LET $p = (SELECT id FROM product WHERE name = '金刚经')[0].id; LET $v = (SELECT id FROM product_variant WHERE spu = $p LIMIT 1)[0].id; LET $price = (SELECT price FROM pricing WHERE variant = $v AND is_active = true)[0].price; INSERT INTO sales_order { order_no: 'SO-' + time::format(time::now(), '%Y%m%d%H%M%S'), customer: $cust, total_amount: $price, status: '待付款', created_by: user:admin }; LET $oid = (SELECT id FROM sales_order ORDER BY created_at DESC LIMIT 1)[0].id; INSERT INTO order_item { order: $oid, variant: $v, quantity: 1, unit_price: $price, amount: $price }; COMMIT TRANSACTION;"
}
```

### 补货申请
用户："给金刚经补货 20 本"
```json
{
  "intent": "action",
  "sql": "LET $p = (SELECT id FROM product WHERE name = '金刚经')[0].id; LET $v = (SELECT id FROM product_variant WHERE spu = $p LIMIT 1)[0].id; INSERT INTO restock_request { variant: $v, quantity: 20, reason: '手动补货', status: '待处理', created_by: user:admin };"
}
```

### 盘点
用户："盘点金刚经库存"
```json
{
  "intent": "action",
  "sql": "LET $p = (SELECT id FROM product WHERE name = '金刚经')[0].id; LET $v = (SELECT id FROM product_variant WHERE spu = $p LIMIT 1)[0].id; LET $cur = (SELECT quantity FROM store_inventory WHERE variant = $v)[0].quantity; INSERT INTO inventory_count { variant: $v, prev_stock: $cur, actual_stock: $cur, diff: 0, reason: '日常盘点', counted_by: user:admin }; UPDATE store_inventory SET quantity = $cur WHERE variant = $v;"
}
```

### 查订单
用户："最近有哪几个订单"
```json
{
  "intent": "query",
  "sql": "SELECT order_no, customer.name AS 客户, total_amount AS 金额, status AS 状态, created_at FROM sales_order ORDER BY created_at DESC LIMIT 10;"
}
```

### 查会员
用户："有哪些会员"
```json
{
  "intent": "query",
  "sql": "SELECT name, phone, wechat FROM customer ORDER BY created_at DESC LIMIT 10;"
}
```
