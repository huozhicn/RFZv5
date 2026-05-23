-- @label 补货申请
-- @group inventory
DEFINE TABLE restock_request SCHEMAFULL;
DEFINE FIELD variant ON restock_request TYPE record<product_variant> COMMENT 'SKU';
DEFINE FIELD quantity ON restock_request TYPE int DEFAULT 0 COMMENT '数量';
DEFINE FIELD reason ON restock_request TYPE string DEFAULT '' COMMENT '原因';
DEFINE FIELD status ON restock_request TYPE string ASSERT $value IN ['待处理', '已处理', '已拒绝'] DEFAULT '待处理' COMMENT '状态';
DEFINE FIELD created_by ON restock_request TYPE record<user> COMMENT '操作人';
DEFINE FIELD created_at ON restock_request TYPE datetime DEFAULT time::now();
