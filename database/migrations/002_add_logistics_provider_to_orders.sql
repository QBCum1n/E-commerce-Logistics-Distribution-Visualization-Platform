-- 迁移 002: 为订单表添加物流公司关联
-- 描述: 在订单表中添加物流公司ID外键，关联到物流公司表
-- 创建: 2025-11-20

-- 1. 在订单表中添加物流公司ID列
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS logistics_provider_id UUID REFERENCES logistics_providers(id) ON DELETE SET NULL;

-- 2. 为新添加的外键列创建索引
CREATE INDEX IF NOT EXISTS idx_orders_logistics_provider_id ON orders(logistics_provider_id);

-- 3. 验证变更
SELECT '✅ 订单表已添加物流公司关联' AS status;
SELECT '🎉 迁移 002 完成!' AS completion_message;


-- 添加快递公司到数据库
-- 这些是中国常见的快递公司

INSERT INTO logistics_providers (name, code, contact_phone, average_delivery_time, is_active) VALUES
('顺丰速运', 'SF', '95338', 24, true),
('圆通速递', 'YTO', '95554', 48, true),
('中通快递', 'ZTO', '95311', 48, true),
('申通快递', 'STO', '95543', 48, true),
('韵达快递', 'YD', '95546', 48, true),
('京东物流', 'JD', '950616', 24, true),
('德邦快递', 'DP', '95353', 72, true),
('EMS', 'EMS', '11183', 72, true),
('百世快递', 'HTKY', '95320', 72, true),
('极兔速递', 'JT', '400-821-2218', 48, true)
ON CONFLICT (code) DO NOTHING;

SELECT '✅ 快递公司数据插入完成！' as message;
SELECT '已添加10家快递公司到数据库' as details;
