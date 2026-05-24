-- product 表追加向量搜索支持
-- 在已有 product 表上增量添加

-- 向量字段
DEFINE FIELD content_embedding ON product TYPE option<array<float>> COMMENT '语义搜索向量(bge-m3 1024维)';

-- HNSW 向量索引
DEFINE INDEX idx_product_vec ON product FIELDS content_embedding 
  HNSW DIMENSION 1024 DIST COSINE TYPE F32;
PERMISSIONS FULL;
