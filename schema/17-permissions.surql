-- 流通处 — 表权限（ALTER TABLE 语法）

ALTER TABLE user PERMISSIONS
  FOR select FULL
  FOR create,update,delete WHERE $auth.role = '管理员';

ALTER TABLE customer PERMISSIONS
  FOR select FULL
  FOR create,update,delete WHERE $auth.role = '管理员';

ALTER TABLE product PERMISSIONS FOR select FULL;
ALTER TABLE product_category PERMISSIONS FOR select FULL;
ALTER TABLE product_variant PERMISSIONS FOR select FULL;

ALTER TABLE pricing PERMISSIONS
  FOR select FULL
  FOR create,update,delete WHERE $auth.role = '管理员';

ALTER TABLE store_inventory PERMISSIONS
  FOR select FULL
  FOR create,update,delete WHERE $auth.role = '管理员';

ALTER TABLE inventory_count PERMISSIONS
  FOR select FULL
  FOR create,update,delete WHERE $auth.role = '管理员';

ALTER TABLE sales_order PERMISSIONS
  FOR select FULL
  FOR create,update WHERE $auth.role IN ['管理员', '店员']
  FOR delete WHERE $auth.role = '管理员';

ALTER TABLE order_item PERMISSIONS
  FOR select FULL
  FOR create,update WHERE $auth.role IN ['管理员', '店员']
  FOR delete WHERE $auth.role = '管理员';

ALTER TABLE restock_request PERMISSIONS
  FOR select FULL
  FOR create,update WHERE $auth.role IN ['管理员', '店员']
  FOR delete WHERE $auth.role = '管理员';

ALTER TABLE agent_message PERMISSIONS
  FOR select FULL
  FOR create,update WHERE $auth.role IN ['管理员', '店员']
  FOR delete WHERE $auth.role = '管理员';
