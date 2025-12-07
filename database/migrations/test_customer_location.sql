-- 测试脚本：验证客户位置功能
-- 描述：测试CustomerLocation组件获取客户位置的功能
-- 创建：2025-12-07

-- 1. 检查orders表是否有receiver_location列
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'receiver_location';

-- 2. 检查logistics_trajectories表结构和数据
SELECT 
    lt.order_id,
    o.order_number,
    lt.status,
    ST_AsText(lt.location) as location_text,
    lt.timestamp
FROM logistics_trajectories lt
JOIN orders o ON lt.order_id = o.id
ORDER BY lt.order_id, lt.timestamp
LIMIT 10;

-- 3. 检查"馒头"商家的订单和轨迹数据
SELECT 
    o.id,
    o.order_number,
    o.customer_address,
    o.receiver_location,
    s.name as shop_name,
    COUNT(lt.id) as trajectory_count
FROM orders o
JOIN shops s ON o.shop_id = s.id
LEFT JOIN logistics_trajectories lt ON o.id = lt.order_id
WHERE s.name = '馒头'
GROUP BY o.id, o.order_number, o.customer_address, o.receiver_location, s.name
LIMIT 10;

-- 4. 检查"馒头"商家订单的delivered状态轨迹点
SELECT 
    o.id,
    o.order_number,
    lt.status,
    ST_AsText(lt.location) as location_text,
    lt.timestamp
FROM orders o
JOIN shops s ON o.shop_id = s.id
JOIN logistics_trajectories lt ON o.id = lt.order_id
WHERE s.name = '馒头'
AND lt.status = 'delivered'
ORDER BY o.order_number, lt.timestamp
LIMIT 10;

-- 5. 如果没有delivered状态的轨迹点，显示所有轨迹点
SELECT 
    o.id,
    o.order_number,
    lt.status,
    ST_AsText(lt.location) as location_text,
    lt.timestamp
FROM orders o
JOIN shops s ON o.shop_id = s.id
JOIN logistics_trajectories lt ON o.id = lt.order_id
WHERE s.name = '馒头'
ORDER BY o.order_number, lt.timestamp
LIMIT 20;

-- 6. 检查是否有订单没有receiver_location
SELECT 
    COUNT(*) as total_orders,
    COUNT(CASE WHEN receiver_location IS NULL THEN 1 END) as orders_without_receiver_location,
    COUNT(CASE WHEN receiver_location IS NOT NULL THEN 1 END) as orders_with_receiver_location
FROM orders o
JOIN shops s ON o.shop_id = s.id
WHERE s.name = '馒头';

-- 7. 更新所有订单的receiver_location（如果需要）
SELECT update_all_orders_receiver_location() AS updated_orders_count;

-- 8. 再次检查更新后的结果
SELECT 
    COUNT(*) as total_orders,
    COUNT(CASE WHEN receiver_location IS NULL THEN 1 END) as orders_without_receiver_location,
    COUNT(CASE WHEN receiver_location IS NOT NULL THEN 1 END) as orders_with_receiver_location
FROM orders o
JOIN shops s ON o.shop_id = s.id
WHERE s.name = '馒头';

-- 9. 显示一些示例数据
SELECT 
    o.id,
    o.order_number,
    o.customer_address,
    o.receiver_location,
    s.name as shop_name
FROM orders o
JOIN shops s ON o.shop_id = s.id
WHERE s.name = '馒头'
AND o.receiver_location IS NOT NULL
LIMIT 5;

SELECT '✅ 客户位置功能测试完成' AS status;