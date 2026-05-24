-- 用 CONTENT + type::thing 一次性创建互联数据，不需要 $after
CREATE product_category:jingshu CONTENT { name: '经书', sort_order: 1 };
CREATE product_category:faqi    CONTENT { name: '法器', sort_order: 2 };
CREATE product_category:nianzhu CONTENT { name: '念珠', sort_order: 3 };
CREATE product_category:xiang   CONTENT { name: '香品', sort_order: 4 };
CREATE product_category:foxiang CONTENT { name: '佛像', sort_order: 5 };
CREATE product_category:wenchuang CONTENT { name: '文创', sort_order: 6 };

CREATE product:p_jgj CONTENT { name: '金刚般若波罗蜜经', product_type: '商品', description: '精装硬壳，注音版', category: product_category:jingshu, base_price: 28, is_listed: true };
CREATE product:p_xj  CONTENT { name: '心经手抄本', product_type: '商品', description: '宣纸线装，毛笔小楷字帖', category: product_category:jingshu, base_price: 18, is_listed: true };
CREATE product:p_nz1 CONTENT { name: '紫檀念珠108颗', product_type: '商品', description: '印度小叶紫檀，8mm圆珠', category: product_category:nianzhu, base_price: 168, is_listed: true };
CREATE product:p_nz2 CONTENT { name: '星月菩提手持', product_type: '商品', description: '海南籽，10×8mm苹果珠', category: product_category:nianzhu, base_price: 88, is_listed: true };
CREATE product:p_x1  CONTENT { name: '老山檀线香', product_type: '商品', description: '印度老山檀，21cm细支，每管30支', category: product_category:xiang, base_price: 58, is_listed: true };
CREATE product:p_x2  CONTENT { name: '沉香盘香', product_type: '商品', description: '越南芽庄沉香，每盒48片', category: product_category:xiang, base_price: 128, is_listed: false };
CREATE product:p_deng CONTENT { name: '纯铜酥油灯座', product_type: '商品', description: '黄铜手工錾刻莲花纹，高15cm', category: product_category:faqi, base_price: 268, is_listed: true };
CREATE product:p_fo CONTENT { name: '迷你紫铜卧佛', product_type: '商品', description: '紫铜铸造，长12cm高6cm', category: product_category:foxiang, base_price: 98, is_listed: true };
CREATE product:p_sq CONTENT { name: '经文黄铜书签套装', product_type: '商品', description: '3枚装，心经/金刚经/大悲咒，配流苏', category: product_category:wenchuang, base_price: 36, is_listed: true };

CREATE product:p_act1 CONTENT { name: '端午节祈福法会', product_type: '活动', description: '法师领众诵经祈福，含素斋', base_price: 0, is_listed: true, start_date: d'2026-06-01T08:00:00Z', end_date: d'2026-06-05T18:00:00Z', capacity: 60 };
CREATE product:p_act2 CONTENT { name: '每周五禅修雅集', product_type: '活动', description: '每周五晚7-9点，明慧法师带领', base_price: 0, is_listed: true, cycle_description: '每周五 19:00-21:00', capacity: 30 };
CREATE product:p_act3 CONTENT { name: '佛像描金体验课', product_type: '活动', description: '亲手描金，含材料包', base_price: 68, is_listed: true, start_date: d'2026-06-10T14:00:00Z', end_date: d'2026-06-10T17:00:00Z', capacity: 20 };

CREATE product_variant:v_jgj  CONTENT { sku: 'JGJ-STD', name: '标准版', spu: product:p_jgj, base_price: 28 };
CREATE product_variant:v_xj   CONTENT { sku: 'XJ-STD',  name: '标准版', spu: product:p_xj,  base_price: 18 };
CREATE product_variant:v_nz1  CONTENT { sku: 'NZ-108',  name: '108颗', spu: product:p_nz1, base_price: 168 };
CREATE product_variant:v_nz2  CONTENT { sku: 'XY-114',  name: '114颗', spu: product:p_nz2, base_price: 88 };
CREATE product_variant:v_x1   CONTENT { sku: 'LS-XI',   name: '细支',  spu: product:p_x1,  base_price: 58 };
CREATE product_variant:v_x1c  CONTENT { sku: 'LS-CU',   name: '粗支',  spu: product:p_x1,  base_price: 68 };
CREATE product_variant:v_x2   CONTENT { sku: 'CX-PX',   name: '盘香',  spu: product:p_x2,  base_price: 128 };
CREATE product_variant:v_deng CONTENT { sku: 'SDG-001', name: '标准款', spu: product:p_deng, base_price: 268 };
CREATE product_variant:v_sq   CONTENT { sku: 'SQ-SET3', name: '3枚套装', spu: product:p_sq,  base_price: 36 };
CREATE product_variant:v_a1   CONTENT { sku: 'ACT-DW',  name: '标准', spu: product:p_act1, base_price: 0 };
CREATE product_variant:v_a2   CONTENT { sku: 'ACT-CX',  name: '标准', spu: product:p_act2, base_price: 0 };
CREATE product_variant:v_a3   CONTENT { sku: 'ACT-MX',  name: '标准', spu: product:p_act3, base_price: 68 };

CREATE pricing:p1  CONTENT { variant: product_variant:v_jgj, price: 38, is_active: true };
CREATE pricing:p2  CONTENT { variant: product_variant:v_xj,  price: 22, is_active: true };
CREATE pricing:p3  CONTENT { variant: product_variant:v_nz1, price: 198, is_active: true };
CREATE pricing:p4  CONTENT { variant: product_variant:v_nz2, price: 98, is_active: true };
CREATE pricing:p5  CONTENT { variant: product_variant:v_x1,  price: 68, is_active: true };
CREATE pricing:p6  CONTENT { variant: product_variant:v_x1c, price: 78, is_active: true };
CREATE pricing:p7  CONTENT { variant: product_variant:v_deng, price: 298, is_active: true };
CREATE pricing:p8  CONTENT { variant: product_variant:v_sq,  price: 42, is_active: true };

CREATE store_inventory:i1 CONTENT { variant: product_variant:v_jgj, quantity: 50 };
CREATE store_inventory:i2 CONTENT { variant: product_variant:v_xj,  quantity: 80 };
CREATE store_inventory:i3 CONTENT { variant: product_variant:v_nz1, quantity: 15 };
CREATE store_inventory:i4 CONTENT { variant: product_variant:v_nz2, quantity: 25 };
CREATE store_inventory:i5 CONTENT { variant: product_variant:v_x1,  quantity: 100 };
CREATE store_inventory:i6 CONTENT { variant: product_variant:v_x1c, quantity: 40 };
CREATE store_inventory:i7 CONTENT { variant: product_variant:v_deng, quantity: 8 };
CREATE store_inventory:i8 CONTENT { variant: product_variant:v_sq,  quantity: 60 };

CREATE customer:cus1 CONTENT { name: '赵居士', phone: '13800001001', wechat: 'zhaojushi', address: '上海市普陀区真如镇', notes: '常来参加禅修雅集' };
CREATE customer:cus2 CONTENT { name: '钱阿姨', phone: '13900002002', address: '上海市静安区', notes: '每个月来请香' };
CREATE customer:cus3 CONTENT { name: '孙女士', phone: '13700003003', wechat: 'sun_organic', address: '杭州市西湖区', notes: '线上客户' };
CREATE customer:cus4 CONTENT { name: '李师兄', phone: '13600004004', wechat: 'li_li_bro', address: '北京市海淀区' };
CREATE customer:cus5 CONTENT { name: '周老师', phone: '13500005005', address: '上海市长宁区', notes: '书画老师' };

CREATE sales_order:so1 CONTENT { order_no: 'SO20260501001', customer: customer:cus1, total_amount: 334, status: '已完成', payment_method: '在线支付', sync_status: 'synced', created_by: user:admin };
CREATE order_item:oi1a CONTENT { order: sales_order:so1, variant: product_variant:v_nz1, quantity: 1, unit_price: 198, amount: 198 };
CREATE order_item:oi1b CONTENT { order: sales_order:so1, variant: product_variant:v_x1,  quantity: 2, unit_price: 68,  amount: 136 };

CREATE sales_order:so2 CONTENT { order_no: 'SO20260510002', customer: customer:cus2, total_amount: 68, status: '待付款', payment_method: '线下付款', notes: '钱阿姨店里选的还没付钱', sync_status: 'pending', created_by: user:admin };
CREATE order_item:oi2  CONTENT { order: sales_order:so2,  variant: product_variant:v_x1,  quantity: 1, unit_price: 68,  amount: 68 };

CREATE sales_order:so3 CONTENT { order_no: 'SO20260515003', customer: customer:cus3, total_amount: 132, status: '已付款', payment_method: '在线支付', notes: '杭州孙女士网上下单', sync_status: 'pending', created_by: user:admin };
CREATE order_item:oi3a CONTENT { order: sales_order:so3,  variant: product_variant:v_sq,  quantity: 1, unit_price: 42,  amount: 42 };
CREATE order_item:oi3b CONTENT { order: sales_order:so3,  variant: product_variant:v_nz2, quantity: 1, unit_price: 90,  amount: 90 };

CREATE sales_order:so4 CONTENT { order_no: 'SO20260518004', customer: customer:cus4, total_amount: 22, status: '已取消', payment_method: '线下付款', notes: '李师兄说不要了', sync_status: 'pending', created_by: user:admin };
CREATE order_item:oi4  CONTENT { order: sales_order:so4,  variant: product_variant:v_xj,  quantity: 1, unit_price: 22,  amount: 22 };

CREATE sales_order:so5 CONTENT { order_no: 'SO20260520005', customer: customer:cus5, total_amount: 60, status: '已发货', payment_method: '在线支付', notes: '周老师微信转账', sync_status: 'synced', created_by: user:admin };
CREATE order_item:oi5  CONTENT { order: sales_order:so5,  variant: product_variant:v_xj,  quantity: 3, unit_price: 20,  amount: 60 };

CREATE sales_order:so6 CONTENT { order_no: 'SO20260524006', customer: customer:cus1, total_amount: 298, status: '待付款', payment_method: '在线支付', notes: '刚下的单', sync_status: 'pending', created_by: user:admin };
CREATE order_item:oi6  CONTENT { order: sales_order:so6,  variant: product_variant:v_deng, quantity: 1, unit_price: 298, amount: 298 };

CREATE store_info:si1 CONTENT { name: '如法流通处·上海真如店', address: '上海市普陀区真如镇兰溪路', phone: '021-51234567', business_hours: '周一至周日 8:30-18:00', description: '清净庄严，如法流通。法物结缘，广种福田。' };

CREATE carousel:c1 CONTENT { image_url: '', link_url: '', sort_order: 1, is_active: true };
CREATE carousel:c2 CONTENT { image_url: '', link_url: '', sort_order: 2, is_active: true };
CREATE carousel:c3 CONTENT { image_url: '', link_url: '', sort_order: 3, is_active: true };

CREATE announcement:a1 CONTENT { title: '端午节祈福法会报名开始', content: '6月1日-5日，恭请法师领众诵经祈福。名额有限，提前报名。', is_active: true, link_type: 'activity', link_target: product:p_act1 };
CREATE announcement:a2 CONTENT { title: '每周五禅修雅集恢复通知', content: '自6月起每周五晚7点明慧法师带领禅修。欢迎参加，随喜。', is_active: true, link_type: 'activity', link_target: product:p_act2 };

CREATE featured_product:fp1 CONTENT { product: product:p_nz1, sort_order: 1 };
CREATE featured_product:fp2 CONTENT { product: product:p_x1,  sort_order: 2 };
CREATE featured_product:fp3 CONTENT { product: product:p_sq,  sort_order: 3 };
