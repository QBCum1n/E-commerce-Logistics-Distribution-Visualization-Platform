-- 迁移 001: 初始数据库结构
-- 描述: 创建物流平台核心表结构、RLS策略和索引
-- 创建: 2025-11-20
-- 注意: 此文件只包含结构，不含测试数据

-- 启用 PostGIS 扩展（空间数据支持）
CREATE EXTENSION IF NOT EXISTS postgis;





--创建表
-- 1. 用户资料表（扩展 Supabase Auth）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'merchant', 'admin')),
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 商家表
CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  contact_phone TEXT,
  address TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 配送范围表
CREATE TABLE IF NOT EXISTS delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  zone_name TEXT NOT NULL,
  zone_area geometry(Polygon, 4326) NOT NULL,
  delivery_time_min INTEGER DEFAULT 30,
  delivery_time_max INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 订单表
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'confirmed', 'shipping', 'delivered', 'cancelled')
  ),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  estimated_delivery TIMESTAMPTZ,
  actual_delivery TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. 订单商品表
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. 物流轨迹表
CREATE TABLE IF NOT EXISTS logistics_trajectories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  location geometry(Point, 4326) NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_transit' CHECK (
    status IN ('pickup', 'in_transit', 'out_for_delivery', 'delivered')
  ),
  description TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. 物流公司表
CREATE TABLE IF NOT EXISTS logistics_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  contact_phone TEXT,
  average_delivery_time INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. 订单查询记录表
CREATE TABLE IF NOT EXISTS order_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  queried_at TIMESTAMPTZ DEFAULT now(),
  user_ip INET,
  user_agent TEXT
);




--启用RLS(行级安全)

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'profiles' AND rowsecurity = true) THEN
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'shops' AND rowsecurity = true) THEN
        ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'delivery_zones' AND rowsecurity = true) THEN
        ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'orders' AND rowsecurity = true) THEN
        ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'order_items' AND rowsecurity = true) THEN
        ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'logistics_trajectories' AND rowsecurity = true) THEN
        ALTER TABLE logistics_trajectories ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'logistics_providers' AND rowsecurity = true) THEN
        ALTER TABLE logistics_providers ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'order_queries' AND rowsecurity = true) THEN
        ALTER TABLE order_queries ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;




--配置安全策略

-- 1.profiles 表策略

-- 用户只能查看和更新自己的资料
CREATE POLICY IF NOT EXISTS "用户管理个人资料" ON profiles
FOR ALL USING (auth.uid() = id);


-- 2.shops 表策略

-- 商家只能管理自己的店铺
CREATE POLICY IF NOT EXISTS "商家管理店铺" ON shops
FOR ALL USING (auth.uid() = owner_id);


-- 3.delivery_zones 表策略

-- 商家只能管理自己店铺的配送范围
CREATE POLICY IF NOT EXISTS "商家管理配送范围" ON delivery_zones
FOR ALL USING (
  shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
);

-- 所有用户都可以查看配送范围（用于下单前检查）
CREATE POLICY IF NOT EXISTS "用户查看配送范围" ON delivery_zones
FOR SELECT USING (is_active = true);


-- 4.orders 表策略

-- 商家可以管理（增删改查）自己店铺的订单
CREATE POLICY IF NOT EXISTS "商家管理订单" ON orders
FOR ALL USING (
  shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())           --商家名匹配,同时店铺名也匹配
);

-- 用户可以通过订单号查询自己的订单（物流查询功能）
CREATE POLICY IF NOT EXISTS "用户查看订单" ON orders
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
CREATE POLICY IF NOT EXISTS "商家查看订单商品" ON order_items
FOR ALL USING (
  order_id IN (                                       --选出 输入的这个订单号 = 前面找到的那个id(orders中的那一行 的id)  的那一行
    SELECT id FROM orders WHERE shop_id IN (          --选出 这个商店的id = 前面找到的那个id(shops中的owner_id的 那一行 的id)  orders中的那一行 的id
      SELECT id FROM shops WHERE owner_id = auth.uid()--选出这个查看者 自己的id = shops中的owner_id的 shops中的那一行 的id
    )
  )
);

-- 用户可以查看自己查询过的订单的商品详情
CREATE POLICY IF NOT EXISTS "用户查看订单商品" ON order_items
FOR SELECT USING (
  order_id IN (
    SELECT order_id FROM order_queries 
    WHERE user_id = auth.uid() OR user_ip::inet = inet_client_addr()
  )
);


-- 6.logistics_trajectories 表策略

-- 商家可以查看自己店铺订单的物流轨迹
CREATE POLICY IF NOT EXISTS "商家查看物流轨迹" ON logistics_trajectories
FOR ALL USING (
  order_id IN (
    SELECT id FROM orders WHERE shop_id IN (
      SELECT id FROM shops WHERE owner_id = auth.uid()
    )
  )
);

-- 用户可以查看自己查询过的订单的物流轨迹
CREATE POLICY IF NOT EXISTS "用户查看物流轨迹" ON logistics_trajectories
FOR SELECT USING (
  order_id IN (
    SELECT order_id FROM order_queries 
    WHERE user_id = auth.uid() OR user_ip::inet = inet_client_addr()
  )
);


-- 7.logistics_providers 表策略

-- 所有人都可以查看物流公司信息（无需登录）
CREATE POLICY IF NOT EXISTS "所有人查看物流公司" ON logistics_providers
FOR SELECT USING (is_active = true);


-- 8.order_queries 表策略

-- 用户可以管理自己的查询记录
CREATE POLICY IF NOT EXISTS "用户管理查询记录" ON order_queries
FOR ALL USING (
  user_id = auth.uid() 
  OR user_ip::inet = inet_client_addr()
);


-- 9.特殊功能：匿名用户订单查询支持

-- 允许匿名用户(没注册登录的)插入查询记录（用于物流查询功能）
CREATE POLICY IF NOT EXISTS "匿名用户创建查询记录" ON order_queries
FOR INSERT WITH CHECK (user_id IS NULL);

-- 允许匿名用户查看自己的查询记录
CREATE POLICY IF NOT EXISTS "匿名用户查看查询记录" ON order_queries
FOR SELECT USING (
  user_ip::inet = inet_client_addr()
  AND user_id IS NULL
);


-- 10.数据验证和完整性策略

-- 确保用户角色只能是预定义的值
ALTER TABLE profiles ADD CONSTRAINT IF NOT EXISTS valid_roles 
CHECK (role IN ('customer', 'merchant', 'admin'));

-- 确保订单状态只能是预定义的值
ALTER TABLE orders ADD CONSTRAINT IF NOT EXISTS valid_order_status 
CHECK (status IN ('pending', 'confirmed', 'shipping', 'delivered', 'cancelled'));

-- 确保物流轨迹状态只能是预定义的值
ALTER TABLE logistics_trajectories ADD CONSTRAINT IF NOT EXISTS valid_trajectory_status 
CHECK (status IN ('pickup', 'in_transit', 'out_for_delivery', 'delivered'));

-- 确保订单金额为正数
ALTER TABLE orders ADD CONSTRAINT IF NOT EXISTS positive_total_amount 
CHECK (total_amount >= 0);

ALTER TABLE order_items ADD CONSTRAINT IF NOT EXISTS positive_quantity 
CHECK (quantity > 0);

ALTER TABLE order_items ADD CONSTRAINT IF NOT EXISTS positive_subtotal 
CHECK (subtotal >= 0);




--四. 配置索引
-- 1. 外键字段索引
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_logistics_trajectories_order_id ON logistics_trajectories(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_shop_id ON delivery_zones(shop_id);
CREATE INDEX IF NOT EXISTS idx_order_queries_order_id ON order_queries(order_id);
CREATE INDEX IF NOT EXISTS idx_order_queries_user_id ON order_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_shops_owner_id ON shops(owner_id);

-- 2. 业务查询字段索引
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logistics_trajectories_timestamp ON logistics_trajectories(timestamp DESC);

-- 3. 空间数据索引
CREATE INDEX IF NOT EXISTS idx_logistics_trajectories_location ON logistics_trajectories USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_area ON delivery_zones USING GIST (zone_area);

-- 4. 状态筛选索引
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON delivery_zones(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_logistics_providers_active ON logistics_providers(is_active) WHERE is_active = true;




--五. 验证
-- 验证表创建
SELECT '✅ 表创建完成: ' || COUNT(*)::TEXT 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'profiles', 'shops', 'delivery_zones', 'orders', 
    'order_items', 'logistics_trajectories', 
    'logistics_providers', 'order_queries'
);

-- 验证策略创建
SELECT '✅ 安全策略: ' || COUNT(*)::TEXT 
FROM pg_policies 
WHERE schemaname = 'public';

-- 验证索引创建
SELECT '✅ 性能索引: ' || COUNT(*)::TEXT 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';

SELECT '🎉 数据库初始结构迁移完成!' as completion_message;
SELECT '下一步: 运行测试数据脚本初始化示例数据' as next_step;