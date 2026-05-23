-- @label 会员
-- @group crm
DEFINE TABLE customer SCHEMAFULL;
DEFINE FIELD name ON customer TYPE string COMMENT '姓名';
DEFINE FIELD phone ON customer TYPE string DEFAULT '' COMMENT '电话';
DEFINE FIELD wechat ON customer TYPE string DEFAULT '' COMMENT '微信';
DEFINE FIELD address ON customer TYPE string DEFAULT '' COMMENT '地址';
DEFINE FIELD notes ON customer TYPE string DEFAULT '' COMMENT '备注';
DEFINE FIELD created_at ON customer TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON customer TYPE datetime DEFAULT time::now();
