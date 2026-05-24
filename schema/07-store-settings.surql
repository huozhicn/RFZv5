-- 商城设置（H5 商城外观和内容配置）

-- @label 轮播图
-- @group store_settings
DEFINE TABLE carousel SCHEMAFULL;
DEFINE FIELD image_url ON carousel TYPE string COMMENT '图片地址';
DEFINE FIELD link_url ON carousel TYPE string DEFAULT '' COMMENT '跳转链接';
DEFINE FIELD sort_order ON carousel TYPE int DEFAULT 0 COMMENT '排序';
DEFINE FIELD is_active ON carousel TYPE bool DEFAULT true COMMENT '启用';
DEFINE FIELD created_at ON carousel TYPE datetime DEFAULT time::now();

-- @label 推荐商品
-- @group store_settings
DEFINE TABLE featured_product SCHEMAFULL;
DEFINE FIELD product ON featured_product TYPE record<product> COMMENT '商品';
DEFINE FIELD sort_order ON featured_product TYPE int DEFAULT 0 COMMENT '排序';
DEFINE FIELD created_at ON featured_product TYPE datetime DEFAULT time::now();

-- @label 流通处信息
-- @group store_settings
DEFINE TABLE store_info SCHEMAFULL;
DEFINE FIELD name ON store_info TYPE string COMMENT '流通处名称';
DEFINE FIELD address ON store_info TYPE string DEFAULT '' COMMENT '地址';
DEFINE FIELD phone ON store_info TYPE string DEFAULT '' COMMENT '电话';
DEFINE FIELD business_hours ON store_info TYPE string DEFAULT '' COMMENT '营业时间';
DEFINE FIELD description ON store_info TYPE string DEFAULT '' COMMENT '简介';
DEFINE FIELD logo_url ON store_info TYPE string DEFAULT '' COMMENT 'Logo';
DEFINE FIELD updated_at ON store_info TYPE datetime DEFAULT time::now();

-- @label 公告
-- @group store_settings
DEFINE TABLE announcement SCHEMAFULL;
DEFINE FIELD title ON announcement TYPE string COMMENT '标题';
DEFINE FIELD content ON announcement TYPE string COMMENT '内容';
DEFINE FIELD is_active ON announcement TYPE bool DEFAULT true COMMENT '启用';
DEFINE FIELD created_at ON announcement TYPE datetime DEFAULT time::now();
DEFINE FIELD link_type ON announcement TYPE option<string> COMMENT '跳转类型: product/activity';
DEFINE FIELD link_target ON announcement TYPE option<record> COMMENT '跳转目标 record ID';
