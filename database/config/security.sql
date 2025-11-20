--配置策略
-- 删除所有现有策略（清理环境）
DROP POLICY IF EXISTS "用户管理个人资料" ON profiles;
DROP POLICY IF EXISTS "商家管理店铺" ON shops;
DROP POLICY IF EXISTS "用户查看配送范围" ON delivery_zones;
DROP POLICY IF EXISTS "商家管理配送范围" ON delivery_zones;
DROP POLICY IF EXISTS "商家管理订单" ON orders;
DROP POLICY IF EXISTS "用户查看订单" ON orders;
DROP POLICY IF EXISTS "用户查看订单商品" ON order_items;
DROP POLICY IF EXISTS "商家查看订单商品" ON order_items;
DROP POLICY IF EXISTS "用户查看物流轨迹" ON logistics_trajectories;
DROP POLICY IF EXISTS "商家查看物流轨迹" ON logistics_trajectories;
DROP POLICY IF EXISTS "所有人查看物流公司" ON logistics_providers;
DROP POLICY IF EXISTS "用户管理查询记录" ON order_queries;


-- 1.profiles 表策略

-- 用户只能查看和更新自己的资料
CREATE POLICY "用户管理个人资料" ON profiles
FOR ALL USING (auth.uid() = id);


-- 2.shops 表策略

-- 商家只能管理自己的店铺
CREATE POLICY "商家管理店铺" ON shops
FOR ALL USING (auth.uid() = owner_id);


-- 3.delivery_zones 表策略

-- 商家只能管理自己店铺的配送范围
CREATE POLICY "商家管理配送范围" ON delivery_zones
FOR ALL USING (
  shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
);

-- 所有用户都可以查看配送范围（用于下单前检查）
CREATE POLICY "用户查看配送范围" ON delivery_zones
FOR SELECT USING (is_active = true);


-- 4.orders 表策略

-- 商家可以管理（增删改查）自己店铺的订单
CREATE POLICY "商家管理订单" ON orders
FOR ALL USING (
  shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())           --商家名匹配,同时店铺名也匹配
);

-- 用户可以通过订单号查询自己的订单（物流查询功能）
CREATE POLICY "用户查看订单" ON orders
FOR SELECT USING (
  -- 用户可以通过订单号查询，或者查询自己创建过的订单
  id IN (
    SELECT order_id FROM order_queries 
    WHERE user_id = auth.uid() OR user_ip::inet = inet_client_addr()
  )
  OR EXISTS (
    SELECT 1 FROM order_queries 
    WHERE order_id = orders.id 
    AND (user_id = auth.uid() OR user_ip::inet = inet_client_addr())
  )
);


-- 5.order_items 表策略

-- 商家可以查看自己店铺订单的商品详情
CREATE POLICY "商家查看订单商品" ON order_items
FOR ALL USING (
  order_id IN (                                       --选出 输入的这个订单号 = 前面找到的那个id(orders中的那一行 的id)  的那一行
    SELECT id FROM orders WHERE shop_id IN (          --选出 这个商店的id = 前面找到的那个id(shops中的owner_id的 那一行 的id)  orders中的那一行 的id
      SELECT id FROM shops WHERE owner_id = auth.uid()--选出这个查看者 自己的id = shops中的owner_id的 shops中的那一行 的id
    )
  )
);

-- 用户可以查看自己查询过的订单的商品详情
CREATE POLICY "用户查看订单商品" ON order_items
FOR SELECT USING (
  order_id IN (
    SELECT order_id FROM order_queries 
    WHERE user_id = auth.uid() OR user_ip::inet = inet_client_addr()
  )
);


-- 6.logistics_trajectories 表策略

-- 商家可以查看自己店铺订单的物流轨迹
CREATE POLICY "商家查看物流轨迹" ON logistics_trajectories
FOR ALL USING (
  order_id IN (
    SELECT id FROM orders WHERE shop_id IN (
      SELECT id FROM shops WHERE owner_id = auth.uid()
    )
  )
);

-- 用户可以查看自己查询过的订单的物流轨迹
CREATE POLICY "用户查看物流轨迹" ON logistics_trajectories
FOR SELECT USING (
  order_id IN (
    SELECT order_id FROM order_queries 
    WHERE user_id = auth.uid() OR user_ip::inet = inet_client_addr()
  )
);


-- 7.logistics_providers 表策略

-- 所有人都可以查看物流公司信息（无需登录）
CREATE POLICY "所有人查看物流公司" ON logistics_providers
FOR SELECT USING (is_active = true);


-- 8.order_queries 表策略

-- 用户可以管理自己的查询记录
CREATE POLICY "用户管理查询记录" ON order_queries
FOR ALL USING (
  user_id = auth.uid() 
  OR user_ip::inet = inet_client_addr()
);


-- 9.特殊功能：匿名用户订单查询支持

-- 允许匿名用户(没注册登录的)插入查询记录（用于物流查询功能）
CREATE POLICY "匿名用户创建查询记录" ON order_queries
FOR INSERT WITH CHECK (user_id IS NULL);

-- 允许匿名用户查看自己的查询记录
CREATE POLICY "匿名用户查看查询记录" ON order_queries
FOR SELECT USING (
  user_ip::inet = inet_client_addr()
  AND user_id IS NULL
);


-- 10.数据验证和完整性策略

-- 确保用户角色只能是预定义的值
ALTER TABLE profiles ADD CONSTRAINT valid_roles 
CHECK (role IN ('customer', 'merchant', 'admin'));

-- 确保订单状态只能是预定义的值
ALTER TABLE orders ADD CONSTRAINT valid_order_status 
CHECK (status IN ('pending', 'confirmed', 'shipping', 'delivered', 'cancelled'));

-- 确保物流轨迹状态只能是预定义的值
ALTER TABLE logistics_trajectories ADD CONSTRAINT valid_trajectory_status 
CHECK (status IN ('pickup', 'in_transit', 'out_for_delivery', 'delivered'));

-- 确保订单金额为正数
ALTER TABLE orders ADD CONSTRAINT positive_total_amount 
CHECK (total_amount >= 0);

ALTER TABLE order_items ADD CONSTRAINT positive_quantity 
CHECK (quantity > 0);

ALTER TABLE order_items ADD CONSTRAINT positive_subtotal 
CHECK (subtotal >= 0);