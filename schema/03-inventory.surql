-- @label 库存查看
-- @group inventory
DEFINE TABLE store_inventory SCHEMAFULL;
DEFINE FIELD variant ON store_inventory TYPE record<product_variant> COMMENT 'SKU';
DEFINE FIELD quantity ON store_inventory TYPE int DEFAULT 0 COMMENT '数量';
DEFINE FIELD updated_at ON store_inventory TYPE datetime DEFAULT time::now();

-- @label 盘点
-- @group inventory
DEFINE TABLE inventory_count SCHEMAFULL;
DEFINE FIELD variant ON inventory_count TYPE record<product_variant> COMMENT 'SKU';
DEFINE FIELD prev_stock ON inventory_count TYPE int DEFAULT 0 COMMENT '盘点前库存';
DEFINE FIELD actual_stock ON inventory_count TYPE int DEFAULT 0 COMMENT '实盘库存';
DEFINE FIELD diff ON inventory_count TYPE int DEFAULT 0 COMMENT '差异';
DEFINE FIELD reason ON inventory_count TYPE string DEFAULT '' COMMENT '原因';
DEFINE FIELD counted_by ON inventory_count TYPE record<user> COMMENT '盘点人';
DEFINE FIELD created_at ON inventory_count TYPE datetime DEFAULT time::now();
