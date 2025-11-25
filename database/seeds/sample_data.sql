--测试数据

-- 物流公司
INSERT INTO logistics_providers (name, code, average_delivery_time) VALUES
('顺丰速运', 'SF', 24),
('圆通速递', 'YTO', 48)
ON CONFLICT (code) DO NOTHING;

-- 一个测试商家
INSERT INTO shops (id, name, owner_id) VALUES
('11111111-1111-1111-1111-111111111111', '测试商家', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 一个配送范围
INSERT INTO delivery_zones (shop_id, zone_name, zone_area) VALUES
('11111111-1111-1111-1111-111111111111', '测试区域', 
 ST_GeomFromText('POLYGON((121.47 31.18, 121.50 31.18, 121.50 31.20, 121.47 31.20, 121.47 31.18))', 4326))
ON CONFLICT DO NOTHING;

-- 三个测试订单（不同状态）
INSERT INTO orders (id, order_number, shop_id, customer_name, customer_phone, customer_address, total_amount, status) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'TEST001', '11111111-1111-1111-1111-111111111111', '测试用户', '13800138000', '测试地址1', 100.00, 'pending'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'TEST002', '11111111-1111-1111-1111-111111111111', '测试用户', '13800138000', '测试地址2', 200.00, 'shipping'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'TEST003', '11111111-1111-1111-1111-111111111111', '测试用户', '13800138000', '测试地址3', 300.00, 'delivered')
ON CONFLICT (id) DO NOTHING;

SELECT '✅ 简化测试数据插入完成！' as message;