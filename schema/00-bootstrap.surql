-- 流通处 数据库初始化
DEFINE NAMESPACE huozhi;
USE NS huozhi;
DEFINE DATABASE rfv5_dist;
USE DB rfv5_dist;

-- 管理员用户
DEFINE ACCESS agent_session ON DATABASE TYPE RECORD
  SIGNUP (CREATE user SET name = $name, password_hash = crypto::sha256($pass), role = '店员')
  SIGNIN (SELECT * FROM user WHERE name = $user AND password_hash = crypto::sha256($pass))
  DURATION FOR TOKEN 24h, FOR SESSION 7d;

-- @label 商品列表
-- @group product
DEFINE TABLE product SCHEMAFULL;
DEFINE FIELD name ON product TYPE string COMMENT '商品名称';
DEFINE FIELD product_type ON product TYPE string ASSERT $value IN ['商品', '活动'] DEFAULT '商品' COMMENT '类型';
DEFINE FIELD description ON product TYPE string DEFAULT '' COMMENT '商品介绍';
DEFINE FIELD main_image_url ON product TYPE string DEFAULT '' COMMENT '主图';
DEFINE FIELD detail_image_urls ON product TYPE array<string> DEFAULT [] COMMENT '详情图';
DEFINE FIELD category ON product TYPE option<record<product_category>> DEFAULT NONE COMMENT '类目';
DEFINE FIELD base_price ON product TYPE float DEFAULT 0 COMMENT '如法造基准价';
DEFINE FIELD is_listed ON product TYPE bool DEFAULT true COMMENT '上架';
DEFINE FIELD start_date ON product TYPE option<datetime> DEFAULT NONE COMMENT '活动开始日期';
DEFINE FIELD end_date ON product TYPE option<datetime> DEFAULT NONE COMMENT '活动截止日期';
DEFINE FIELD cycle_description ON product TYPE string DEFAULT '' COMMENT '周期说明';
DEFINE FIELD capacity ON product TYPE int DEFAULT 0 COMMENT '报名上限(0=不限)';
DEFINE FIELD sync_source_id ON product TYPE string DEFAULT '' COMMENT '如法造产品ID';
DEFINE FIELD synced_at ON product TYPE datetime DEFAULT time::now() COMMENT '同步时间';
DEFINE FIELD created_at ON product TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON product TYPE datetime DEFAULT time::now();

-- @label 产品类目
-- @group product
DEFINE TABLE product_category SCHEMAFULL;
DEFINE FIELD name ON product_category TYPE string COMMENT '类目名称';
DEFINE FIELD sort_order ON product_category TYPE int DEFAULT 0 COMMENT '排序';
DEFINE FIELD created_at ON product_category TYPE datetime DEFAULT time::now();

-- @label 产品SKU（子表，不在菜单显示）
-- @group _hidden
DEFINE TABLE product_variant SCHEMAFULL;
DEFINE FIELD sku ON product_variant TYPE string COMMENT 'SKU编码';
DEFINE FIELD name ON product_variant TYPE string COMMENT '规格名称';
DEFINE FIELD spu ON product_variant TYPE record<product> COMMENT '所属SPU';
DEFINE FIELD base_price ON product_variant TYPE float DEFAULT 0 COMMENT '如法造基准价';
DEFINE FIELD sync_source_id ON product_variant TYPE string DEFAULT '' COMMENT '如法造SKU ID';
DEFINE FIELD created_at ON product_variant TYPE datetime DEFAULT time::now();
