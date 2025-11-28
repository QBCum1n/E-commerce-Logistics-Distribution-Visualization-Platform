-- 为没有轨迹的订单生成完整的物流轨迹数据（非破坏性版本）
-- 此脚本只会为没有物流轨迹的订单生成轨迹，不会删除现有数据

-- 创建一个函数来生成两点之间的中间点
CREATE OR REPLACE FUNCTION generate_intermediate_point_safe(
    start_point GEOMETRY, 
    end_point GEOMETRY, 
    progress FLOAT DEFAULT 0.5
) 
RETURNS GEOMETRY AS $$
DECLARE
    x_start FLOAT;
    y_start FLOAT;
    x_end FLOAT;
    y_end FLOAT;
    x_mid FLOAT;
    y_mid FLOAT;
    offset_x FLOAT;
    offset_y FLOAT;
BEGIN
    -- 获取起点和终点的坐标
    x_start := ST_X(start_point);
    y_start := ST_Y(start_point);
    x_end := ST_X(end_point);
    y_end := ST_Y(end_point);
    
    -- 计算中间点坐标
    x_mid := x_start + (x_end - x_start) * progress;
    y_mid := y_start + (y_end - y_start) * progress;
    
    -- 添加一些随机偏移，使路径更真实
    offset_x := (RANDOM() * 0.02 - 0.01); -- -0.01 到 0.01 的随机偏移
    offset_y := (RANDOM() * 0.02 - 0.01); -- -0.01 到 0.01 的随机偏移
    
    -- 返回中间点
    RETURN ST_SetSRID(ST_MakePoint(x_mid + offset_x, y_mid + offset_y), 4326);
END;
$$ LANGUAGE plpgsql;

-- 主函数：为没有轨迹的订单生成物流轨迹
CREATE OR REPLACE FUNCTION generate_trajectories_for_orders_without() 
RETURNS void AS $$
DECLARE
    order_record RECORD;
    pickup_time TIMESTAMPTZ;
    transit_time1 TIMESTAMPTZ;
    transit_time2 TIMESTAMPTZ;
    out_for_delivery_time TIMESTAMPTZ;
    delivery_time TIMESTAMPTZ;
    shop_location GEOMETRY;
    sorting_center_location GEOMETRY;
    transit_center_location GEOMETRY;
    local_distribution_location GEOMETRY;
    customer_location GEOMETRY;
    logistics_provider_name TEXT;
BEGIN
    -- 只为没有轨迹的订单生成轨迹
    FOR order_record IN 
        SELECT o.id, o.created_at, o.actual_delivery, o.customer_address, o.status, lp.name as provider_name
        FROM orders o
        LEFT JOIN logistics_providers lp ON o.logistics_provider_id = lp.id
        WHERE NOT EXISTS (
            SELECT 1 FROM logistics_trajectories lt WHERE lt.order_id = o.id
        )
    LOOP
        -- 获取物流公司名称
        logistics_provider_name := COALESCE(order_record.provider_name, '快递公司');
        
        -- 生成时间点
        pickup_time := order_record.created_at + INTERVAL '30 minutes';
        transit_time1 := pickup_time + INTERVAL '2 hours';
        transit_time2 := transit_time1 + INTERVAL '3 hours';
        out_for_delivery_time := transit_time2 + INTERVAL '4 hours';
        
        -- 如果订单已送达，使用实际送达时间，否则使用预计时间
        IF order_record.status = 'delivered' AND order_record.actual_delivery IS NOT NULL THEN
            delivery_time := order_record.actual_delivery;
        ELSIF order_record.status = 'delivered' THEN
            delivery_time := out_for_delivery_time + INTERVAL '2 hours';
        ELSE
            -- 对于未送达的订单，不添加"已送达"状态
            delivery_time := NULL;
        END IF;
        
        -- 生成位置点
        -- 商家位置（假设为深圳市福田区的一个固定点）
        shop_location := ST_SetSRID(ST_MakePoint(114.057868, 22.543099), 4326);
        
        -- 分拣中心位置（商家附近的一个点）
        sorting_center_location := generate_intermediate_point_safe(
            shop_location, 
            ST_SetSRID(ST_MakePoint(114.057868 + 0.05, 22.543099 + 0.05), 4326),
            0.3
        );
        
        -- 中转中心位置（城市中心的一个点）
        transit_center_location := ST_SetSRID(ST_MakePoint(114.057868 + 0.1, 22.543099 + 0.1), 4326);
        
        -- 本地配送点位置（客户附近的一个点）
        customer_location := ST_SetSRID(
            ST_MakePoint(114.057868 + (RANDOM() * 0.2 - 0.1), 22.543099 + (RANDOM() * 0.1)), 
            4326
        );
        local_distribution_location := generate_intermediate_point_safe(
            transit_center_location, 
            customer_location,
            0.7
        );
        
        -- 插入轨迹点
        -- 1. 已下单
        INSERT INTO logistics_trajectories (
            order_id, location, status, description, timestamp
        ) VALUES (
            order_record.id, 
            shop_location, 
            'pickup', 
            '订单已创建，商家准备发货', 
            order_record.created_at
        );
        
        -- 2. 已取件
        INSERT INTO logistics_trajectories (
            order_id, location, status, description, timestamp
        ) VALUES (
            order_record.id, 
            shop_location, 
            'pickup', 
            logistics_provider_name || '快递员已取件，包裹正在处理中', 
            pickup_time
        );
        
        -- 3. 到达分拣中心
        INSERT INTO logistics_trajectories (
            order_id, location, status, description, timestamp
        ) VALUES (
            order_record.id, 
            sorting_center_location, 
            'in_transit', 
            '包裹已到达' || logistics_provider_name || '分拣中心', 
            transit_time1
        );
        
        -- 4. 到达中转中心
        INSERT INTO logistics_trajectories (
            order_id, location, status, description, timestamp
        ) VALUES (
            order_record.id, 
            transit_center_location, 
            'in_transit', 
            '包裹已到达' || logistics_provider_name || '中转中心', 
            transit_time2
        );
        
        -- 5. 到达本地配送点
        INSERT INTO logistics_trajectories (
            order_id, location, status, description, timestamp
        ) VALUES (
            order_record.id, 
            local_distribution_location, 
            'out_for_delivery', 
            '包裹已到达本地配送点，准备派送', 
            out_for_delivery_time
        );
        
        -- 6. 派送中
        INSERT INTO logistics_trajectories (
            order_id, location, status, description, timestamp
        ) VALUES (
            order_record.id, 
            customer_location, 
            'out_for_delivery', 
            logistics_provider_name || '快递员正在派送，请保持电话畅通', 
            out_for_delivery_time + INTERVAL '30 minutes'
        );
        
        -- 7. 已送达（如果订单状态是delivered）
        IF order_record.status = 'delivered' AND delivery_time IS NOT NULL THEN
            INSERT INTO logistics_trajectories (
                order_id, location, status, description, timestamp
            ) VALUES (
                order_record.id, 
                customer_location, 
                'delivered', 
                '包裹已成功送达，签收人：本人', 
                delivery_time
            );
        END IF;
        
        RAISE NOTICE '已为订单 % 生成完整物流轨迹', order_record.id;
    END LOOP;
    
    RAISE NOTICE '没有轨迹的订单物流轨迹生成完成！';
END;
$$ LANGUAGE plpgsql;

-- 为没有物流公司的订单分配物流公司（非破坏性版本）
UPDATE orders
SET logistics_provider_id = (
    SELECT id 
    FROM logistics_providers 
    WHERE is_active = true 
    ORDER BY RANDOM() 
    LIMIT 1
);
-- WHERE logistics_provider_id IS NULL;

-- 执行存储过程生成轨迹
SELECT generate_trajectories_for_orders_without();

-- 验证结果
SELECT 
    '物流轨迹生成结果（非破坏性版本）' as info,
    (SELECT COUNT(*) FROM orders) as total_orders,
    (SELECT COUNT(*) FROM orders WHERE logistics_provider_id IS NOT NULL) as orders_with_provider,
    (SELECT COUNT(DISTINCT order_id) FROM logistics_trajectories) as orders_with_trajectories,
    (SELECT COUNT(*) FROM logistics_trajectories) as total_trajectory_points;

-- 删除临时存储过程
DROP FUNCTION generate_trajectories_for_orders_without();
DROP FUNCTION generate_intermediate_point_safe();

SELECT '✅ 没有轨迹的订单物流轨迹数据生成完成（非破坏性版本）！' as message;