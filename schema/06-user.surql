-- @label 用户
-- @group org
DEFINE TABLE user SCHEMAFULL;
DEFINE FIELD name ON user TYPE string COMMENT '用户名';
DEFINE FIELD display_name ON user TYPE string DEFAULT '' COMMENT '显示名称';
DEFINE FIELD password_hash ON user TYPE string COMMENT '密码哈希';
DEFINE FIELD role ON user TYPE string ASSERT $value IN ['管理员', '店员'] DEFAULT '店员' COMMENT '角色';
DEFINE FIELD created_at ON user TYPE datetime DEFAULT time::now();
