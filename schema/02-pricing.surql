-- @label 定价
-- @group product
DEFINE TABLE pricing SCHEMAFULL;
DEFINE FIELD variant ON pricing TYPE record<product_variant> COMMENT 'SKU';
DEFINE FIELD price ON pricing TYPE float COMMENT '售价';
DEFINE FIELD is_active ON pricing TYPE bool DEFAULT true COMMENT '启用';
DEFINE FIELD created_at ON pricing TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON pricing TYPE datetime DEFAULT time::now();
