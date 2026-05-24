-- @label 收货地址
-- @group _hidden
DEFINE TABLE customer_address SCHEMAFULL;
DEFINE FIELD customer ON customer_address TYPE record<customer> COMMENT '所属客户';
DEFINE FIELD contact_name ON customer_address TYPE string COMMENT '收货人';
DEFINE FIELD contact_phone ON customer_address TYPE string COMMENT '联系电话';
DEFINE FIELD full_address ON customer_address TYPE string COMMENT '完整地址';
DEFINE FIELD is_default ON customer_address TYPE bool DEFAULT false COMMENT '默认地址';
DEFINE FIELD created_at ON customer_address TYPE datetime DEFAULT time::now();
