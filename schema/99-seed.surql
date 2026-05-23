-- 种子数据
INSERT INTO user { name: 'admin', display_name: '管理员', password_hash: crypto::sha256('admin123'), role: '管理员' };
INSERT INTO user { name: 'staff', display_name: '店员', password_hash: crypto::sha256('staff123'), role: '店员' };

INSERT INTO product_category { name: '经书' } RETURN id;
INSERT INTO product_category { name: '法器' } RETURN id;
INSERT INTO product_category { name: '香品' } RETURN id;

LET $cat1 = (SELECT id FROM product_category WHERE name = '经书')[0].id;
LET $cat2 = (SELECT id FROM product_category WHERE name = '法器')[0].id;
LET $cat3 = (SELECT id FROM product_category WHERE name = '香品')[0].id;

INSERT INTO product { name: '金刚经', base_price: 28, category: $cat1, sync_source_id: 'demo-p1' };
LET $p1 = (SELECT id FROM product WHERE name = '金刚经')[0].id;
INSERT INTO product { name: '紫檀念珠', base_price: 168, category: $cat2, sync_source_id: 'demo-p2' };
LET $p2 = (SELECT id FROM product WHERE name = '紫檀念珠')[0].id;
INSERT INTO product { name: '老山檀线香', base_price: 58, category: $cat3, sync_source_id: 'demo-p3' };
LET $p3 = (SELECT id FROM product WHERE name = '老山檀线香')[0].id;

INSERT INTO product_variant { sku: 'JGJ-001', name: '标准版', spu: $p1, base_price: 28 };
LET $v1 = (SELECT id FROM product_variant WHERE sku = 'JGJ-001')[0].id;
INSERT INTO product_variant { sku: 'NSF-001', name: '108颗', spu: $p2, base_price: 168 };
LET $v2 = (SELECT id FROM product_variant WHERE sku = 'NSF-001')[0].id;
INSERT INTO product_variant { sku: 'XZS-001', name: '细支', spu: $p3, base_price: 58 };

INSERT INTO pricing { variant: $v1, price: 38 };
INSERT INTO pricing { variant: $v2, price: 188 };
INSERT INTO store_inventory { variant: $v1, quantity: 50 };
INSERT INTO store_inventory { variant: $v2, quantity: 30 };
