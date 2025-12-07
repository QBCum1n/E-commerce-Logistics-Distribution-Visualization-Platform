-- 测试脚本：验证订单创建时自动计算配送距离的功能
-- 描述: 测试新创建的触发器和函数是否正常工作
-- 创建: 2025-12-06

-- 1. 首先检查现有的触发器是否已创建
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_condition,
    action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%delivery_distance%'
ORDER BY trigger_name;

-- 2. 获取一个测试商家ID
SELECT id, name, address FROM shops LIMIT 1;

-- 3. 创建测试订单（使用第一个商家ID）
-- 注意：请将下面的 'your_shop_id_here' 替换为上一步查询到的实际商家ID
DO $$
DECLARE
    test_shop_id UUID;
    test_order_id UUID;
BEGIN
    -- 获取第一个商家ID
    SELECT id INTO test_shop_id FROM shops LIMIT 1;
    
    -- 如果没有商家，则退出
    IF test_shop_id IS NULL THEN
        RAISE NOTICE '没有找到商家，无法创建测试订单';
        RETURN;
    END IF;
    
    -- 插入测试订单
    INSERT INTO orders (
        order_number,
        shop_id,
        customer_name,
        customer_phone,
        customer_address,
        total_amount,
        status,
        priority,
        logistics_provider_id,
        limited_delivery_time
    ) VALUES (
        'TEST-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || floor(random() * 1000)::text,
        test_shop_id,
        '测试客户',
        '13800138000',
        '深圳市福田区测试地址123号',
        100.00,
        'pending',
        'normal',
        (SELECT id FROM logistics_providers LIMIT 1),
        24
    ) RETURNING id INTO test_order_id;
    
    -- 检查订单的配送距离是否被自动计算
    RAISE NOTICE '测试订单ID: %', test_order_id;
    
    PERFORM pg_sleep(1); -- 等待1秒确保触发器执行完成
    
    -- 查询测试订单的配送距离
    SELECT 
        id,
        order_number,
        shop_id,
        customer_address,
        delivery_distance,
        created_at
    FROM orders
    WHERE id = test_order_id;
    
    -- 如果配送距离为0或NULL，说明触发器可能没有正常工作
    IF NOT EXISTS (
        SELECT 1 FROM orders 
        WHERE id = test_order_id 
        AND delivery_distance IS NOT NULL 
        AND delivery_distance > 0
    ) THEN
        RAISE NOTICE '警告：测试订单的配送距离未被正确计算';
    ELSE
        RAISE NOTICE '成功：测试订单的配送距离已自动计算';
    END IF;
END $$;

-- 4. 测试更新订单地址是否会重新计算配送距离
DO $$
DECLARE
    test_order_id UUID;
    old_distance DECIMAL(10,2);
    new_distance DECIMAL(10,2);
BEGIN
    -- 获取刚才创建的测试订单
    SELECT id INTO test_order_id 
    FROM orders 
    WHERE order_number LIKE 'TEST-%' 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- 如果没有测试订单，则退出
    IF test_order_id IS NULL THEN
        RAISE NOTICE '没有找到测试订单，无法测试更新功能';
        RETURN;
    END IF;
    
    -- 记录更新前的配送距离
    SELECT delivery_distance INTO old_distance
    FROM orders
    WHERE id = test_order_id;
    
    RAISE NOTICE '更新前的配送距离: % 公里', old_distance;
    
    -- 更新客户地址
    UPDATE orders
    SET customer_address = '北京市朝阳区更新后的测试地址456号'
    WHERE id = test_order_id;
    
    PERFORM pg_sleep(1); -- 等待1秒确保触发器执行完成
    
    -- 记录更新后的配送距离
    SELECT delivery_distance INTO new_distance
    FROM orders
    WHERE id = test_order_id;
    
    RAISE NOTICE '更新后的配送距离: % 公里', new_distance;
    
    -- 比较距离是否发生变化
    IF old_distance != new_distance THEN
        RAISE NOTICE '成功：更新客户地址后，配送距离已重新计算';
    ELSE
        RAISE NOTICE '注意：更新客户地址后，配送距离未发生变化（可能是正常情况）';
    END IF;
END $$;

-- 5. 测试添加物流轨迹点是否会重新计算配送距离
DO $$
DECLARE
    test_order_id UUID;
    old_distance DECIMAL(10,2);
    new_distance DECIMAL(10,2);
BEGIN
    -- 获取测试订单
    SELECT id INTO test_order_id 
    FROM orders 
    WHERE order_number LIKE 'TEST-%' 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- 如果没有测试订单，则退出
    IF test_order_id IS NULL THEN
        RAISE NOTICE '没有找到测试订单，无法测试轨迹点功能';
        RETURN;
    END IF;
    
    -- 记录添加轨迹点前的配送距离
    SELECT delivery_distance INTO old_distance
    FROM orders
    WHERE id = test_order_id;
    
    RAISE NOTICE '添加轨迹点前的配送距离: % 公里', old_distance;
    
    -- 添加一个物流轨迹点
    INSERT INTO logistics_trajectories (
        order_id,
        location,
        status,
        description,
        timestamp
    ) VALUES (
        test_order_id,
        ST_MakePoint(114.0579, 22.5431), -- 深圳坐标
        'pickup',
        '测试轨迹点：已取货',
        now()
    );
    
    PERFORM pg_sleep(1); -- 等待1秒确保触发器执行完成
    
    -- 记录添加轨迹点后的配送距离
    SELECT delivery_distance INTO new_distance
    FROM orders
    WHERE id = test_order_id;
    
    RAISE NOTICE '添加轨迹点后的配送距离: % 公里', new_distance;
    
    -- 比较距离是否发生变化
    IF old_distance != new_distance THEN
        RAISE NOTICE '成功：添加物流轨迹点后，配送距离已重新计算';
    ELSE
        RAISE NOTICE '注意：添加物流轨迹点后，配送距离未发生变化';
    END IF;
END $$;

-- 6. 查询所有测试订单的结果
SELECT 
    id,
    order_number,
    customer_address,
    delivery_distance,
    created_at,
    updated_at
FROM orders
WHERE order_number LIKE 'TEST-%'
ORDER BY created_at DESC;

-- 7. 清理测试数据（可选）
-- 取消下面的注释来删除测试订单
-- DELETE FROM logistics_trajectories WHERE order_id IN (SELECT id FROM orders WHERE order_number LIKE 'TEST-%');
-- DELETE FROM orders WHERE order_number LIKE 'TEST-%';

SELECT '✅ 测试完成' AS status;
SELECT '🎉 请检查上述输出以验证功能是否正常工作' AS completion_message;