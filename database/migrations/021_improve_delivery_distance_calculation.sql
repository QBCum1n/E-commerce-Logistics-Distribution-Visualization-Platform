-- 迁移 021: 改进配送距离计算
-- 描述: 改进配送距离计算函数，确保正确计算从发货点经过各个中转站到达收货地点的总距离
-- 创建: 2025-12-07

-- 1. 改进函数，根据物流轨迹计算订单的总配送距离
-- 这个版本会考虑从商家位置到第一个轨迹点的距离
CREATE OR REPLACE FUNCTION calculate_delivery_distance_from_trajectories_improved(order_id_param UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    total_distance DECIMAL(10,2) := 0;
    shop_location GEOMETRY;
    customer_location GEOMETRY;
    prev_point GEOMETRY;
    current_point GEOMETRY;
    trajectory_record RECORD;
    point_distance DECIMAL(10,2);
    has_delivered_point BOOLEAN := FALSE;
    delivered_location GEOMETRY;
BEGIN
    -- 获取商家位置
    SELECT address INTO shop_location
    FROM shops
    WHERE id = (SELECT shop_id FROM orders WHERE id = order_id_param);
    
    -- 如果商家位置不存在，返回0
    IF shop_location IS NULL THEN
        RETURN 0;
    END IF;
    
    -- 检查是否有delivered状态的轨迹点
    SELECT location INTO delivered_location
    FROM logistics_trajectories
    WHERE order_id = order_id_param AND status = 'delivered'
    LIMIT 1;
    
    IF delivered_location IS NOT NULL THEN
        has_delivered_point := TRUE;
    END IF;
    
    -- 初始化上一个点为商家位置
    prev_point := shop_location;
    
    -- 获取该订单的所有轨迹点，按时间顺序排序
    FOR trajectory_record IN 
        SELECT location, timestamp, status
        FROM logistics_trajectories
        WHERE order_id = order_id_param
        ORDER BY timestamp ASC
    LOOP
        -- 设置当前点
        current_point := trajectory_record.location;
        
        -- 计算与上一个点的距离（单位：米）
        point_distance := ST_Distance(
            prev_point::geography,
            current_point::geography
        );
        
        -- 累加到总距离（转换为公里）
        total_distance := total_distance + (point_distance / 1000);
        
        -- 更新上一个点
        prev_point := current_point;
    END LOOP;
    
    -- 如果没有delivered状态的轨迹点，尝试从订单中获取收货位置
    IF NOT has_delivered_point THEN
        -- 尝试从订单的receiver_location字段获取收货位置
        BEGIN
            DECLARE
                receiver_location_text TEXT;
                coords DECIMAL[];
                lng DECIMAL;
                lat DECIMAL;
            BEGIN
                SELECT receiver_location INTO receiver_location_text
                FROM orders
                WHERE id = order_id_param;
                
                IF receiver_location_text IS NOT NULL THEN
                    -- 尝试解析文本格式的位置，假设格式为"经度,纬度"
                    coords := string_to_array(receiver_location_text, ',');
                    
                    IF array_length(coords, 1) = 2 THEN
                        lng := coords[1];
                        lat := coords[2];
                        
                        -- 创建收货位置点
                        customer_location := ST_MakePoint(lng, lat);
                        
                        -- 计算从最后一个轨迹点到收货位置的距离
                        point_distance := ST_Distance(
                            prev_point::geography,
                            customer_location::geography
                        );
                        
                        -- 累加到总距离（转换为公里）
                        total_distance := total_distance + (point_distance / 1000);
                    END IF;
                END IF;
            END;
        EXCEPTION WHEN OTHERS THEN
            -- 如果解析失败，使用默认距离（例如5公里）
            total_distance := total_distance + 5.0;
        END;
    END IF;
    
    -- 返回总距离（单位：公里，保留两位小数）
    RETURN ROUND(total_distance, 2);
END;
$$ LANGUAGE plpgsql;

-- 2. 更新计算单个订单的配送距离的函数
CREATE OR REPLACE FUNCTION calculate_delivery_distance_for_order_improved(order_id_param UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    distance DECIMAL(10,2);
BEGIN
    -- 使用改进的配送距离计算函数
    distance := calculate_delivery_distance_from_trajectories_improved(order_id_param);
    
    -- 更新订单表中的配送距离
    UPDATE orders
    SET delivery_distance = distance
    WHERE id = order_id_param;
    
    RETURN distance;
END;
$$ LANGUAGE plpgsql;

-- 3. 更新批量更新所有订单的配送距离的函数
CREATE OR REPLACE FUNCTION update_all_orders_delivery_distance_improved()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
    order_record RECORD;
BEGIN
    -- 遍历所有有轨迹点的订单
    FOR order_record IN 
        SELECT DISTINCT id
        FROM orders
        WHERE shop_id IN (SELECT id FROM shops)
    LOOP
        -- 更新每个订单的配送距离
        PERFORM calculate_delivery_distance_for_order_improved(order_record.id);
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- 4. 更新在物流轨迹点发生变化时重新计算配送距离的函数
CREATE OR REPLACE FUNCTION recalculate_delivery_distance_on_trajectory_change_improved()
RETURNS TRIGGER AS $$
BEGIN
    -- 当物流轨迹点发生变化时，使用改进的方法重新计算该订单的配送距离
    PERFORM calculate_delivery_distance_for_order_improved(NEW.order_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 更新触发器，使用改进的函数
DROP TRIGGER IF EXISTS trigger_recalculate_delivery_distance_on_trajectory_insert ON logistics_trajectories;
CREATE TRIGGER trigger_recalculate_delivery_distance_on_trajectory_insert
AFTER INSERT OR UPDATE ON logistics_trajectories
FOR EACH ROW
EXECUTE FUNCTION recalculate_delivery_distance_on_trajectory_change_improved();

DROP TRIGGER IF EXISTS trigger_recalculate_delivery_distance_on_trajectory_delete ON logistics_trajectories;
CREATE TRIGGER trigger_recalculate_delivery_distance_on_trajectory_delete
AFTER DELETE ON logistics_trajectories
FOR EACH ROW
EXECUTE FUNCTION recalculate_delivery_distance_on_trajectory_change_improved();

-- 6. 执行批量更新，使用改进的方法
SELECT update_all_orders_delivery_distance_improved() AS updated_orders_count;

-- 7. 验证更新结果
SELECT 
    COUNT(*) as total_orders,
    COUNT(CASE WHEN delivery_distance > 0 THEN 1 END) as orders_with_distance,
    AVG(delivery_distance) as avg_distance,
    MAX(delivery_distance) as max_distance,
    MIN(delivery_distance) as min_distance
FROM orders;

-- 8. 显示一些示例数据，包括轨迹点数量
SELECT 
    o.id,
    o.order_number,
    s.name as shop_name,
    o.delivery_distance,
    (SELECT COUNT(*) FROM logistics_trajectories WHERE order_id = o.id) as trajectory_points_count,
    (SELECT COUNT(*) FROM logistics_trajectories WHERE order_id = o.id AND status = 'delivered') as delivered_points_count
FROM orders o
JOIN shops s ON o.shop_id = s.id
WHERE o.delivery_distance > 0
ORDER BY o.delivery_distance DESC
LIMIT 10;

SELECT '✅ 配送距离计算函数已改进' AS status;
SELECT '🎉 迁移 021 完成!' AS completion_message;