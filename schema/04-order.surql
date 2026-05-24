-- @label 销售订单
-- @group sales
DEFINE TABLE sales_order SCHEMAFULL;
DEFINE FIELD order_no ON sales_order TYPE string COMMENT '订单号';
DEFINE FIELD customer ON sales_order TYPE record<customer> DEFAULT NONE COMMENT '客户';
DEFINE FIELD total_amount ON sales_order TYPE float DEFAULT 0 COMMENT '总金额';
DEFINE FIELD status ON sales_order TYPE string ASSERT $value IN ['待付款', '已付款', '已发货', '已完成', '已取消'] DEFAULT '待付款' COMMENT '状态';
DEFINE FIELD payment_method ON sales_order TYPE string ASSERT $value IN ['在线支付', '线下付款'] DEFAULT '在线支付' COMMENT '支付方式';
DEFINE FIELD notes ON sales_order TYPE string DEFAULT '' COMMENT '备注';
DEFINE FIELD sync_status ON sales_order TYPE string ASSERT $value IN ['pending', 'synced', 'failed'] DEFAULT 'pending' COMMENT '同步状态';
DEFINE FIELD synced_at ON sales_order TYPE datetime DEFAULT NONE COMMENT '同步时间';
DEFINE FIELD created_by ON sales_order TYPE record<user> COMMENT '操作人';
DEFINE FIELD created_at ON sales_order TYPE datetime DEFAULT time::now();

-- @label 订单明细（子表，不在菜单显示）
-- @group _hidden
DEFINE TABLE order_item SCHEMAFULL;
DEFINE FIELD order ON order_item TYPE record<sales_order> COMMENT '订单';
DEFINE FIELD variant ON order_item TYPE record<product_variant> COMMENT 'SKU';
DEFINE FIELD quantity ON order_item TYPE int DEFAULT 1 COMMENT '数量';
DEFINE FIELD unit_price ON order_item TYPE float DEFAULT 0 COMMENT '单价';
DEFINE FIELD amount ON order_item TYPE float DEFAULT 0 COMMENT '小计';
