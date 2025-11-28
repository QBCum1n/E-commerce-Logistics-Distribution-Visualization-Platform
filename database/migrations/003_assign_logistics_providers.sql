-- 为现有订单分配物流公司
-- 此脚本将为没有物流公司的订单随机分配一个活跃的物流公司

-- 首先检查是否有需要分配物流公司的订单
DO $$
DECLARE
    order_count INTEGER;
    provider_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO order_count FROM orders 
    WHERE logistics_provider_id IS NULL;
    
    SELECT COUNT(*) INTO provider_count FROM logistics_providers 
    WHERE is_active = true;
    
    IF order_count = 0 THEN
        RAISE NOTICE '所有订单都已分配物流公司';
    ELSIF provider_count = 0 THEN
        RAISE NOTICE '没有可用的活跃物流公司';
    ELSE
        RAISE NOTICE '将为 % 个订单分配物流公司，共有 % 个可用物流公司', order_count, provider_count;
    END IF;
END $$;

-- 为没有物流公司的订单随机分配一个活跃的物流公司
UPDATE orders
SET logistics_provider_id = (
    SELECT id 
    FROM logistics_providers 
    WHERE is_active = true 
    ORDER BY RANDOM() 
    LIMIT 1
)
WHERE logistics_provider_id IS NULL;

-- 验证结果
SELECT 
    '物流公司分配结果' as info,
    (SELECT COUNT(*) FROM orders) as total_orders,
    (SELECT COUNT(*) FROM orders WHERE logistics_provider_id IS NOT NULL) as orders_with_provider,
    (SELECT COUNT(*) FROM logistics_providers WHERE is_active = true) as active_providers;

SELECT '✅ 物流公司分配完成！' as message;