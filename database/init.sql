--启动PostGIS扩展
CREATE EXTENSION IF NOT EXISTS postgis;

--一. 创建表

--1.用户表
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'merchant', 'admin')),
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

--2.商店表
CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  contact_phone TEXT,
  address TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,    --是否营业
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

--3.配送路线表
CREATE TABLE delivery_zones (   --配送路线
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  zone_name TEXT NOT NULL,
  zone_area geometry(Polygon, 4326) NOT NULL,  -- PostGIS 多边形
  delivery_time_min INTEGER DEFAULT 30,        -- 最短配送时间(分钟)
  delivery_time_max INTEGER DEFAULT 60,        -- 最长配送时间(分钟)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

--4.订单表
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,           -- 订单号: ORD202401150001
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,         -- 订单总金额
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'confirmed', 'shipping', 'delivered', 'cancelled')
  ),           --待处理       已确认       已发货        已送达        已取消
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),--优先级
  estimated_delivery TIMESTAMPTZ,              -- 预计送达时间
  actual_delivery TIMESTAMPTZ,                 -- 实际送达时间
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

--5.订单物品表
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,--订单没了它也没
  product_name TEXT NOT NULL,                   -- 商品名称（下单时的快照）
  product_price DECIMAL(10,2) NOT NULL,         -- 商品单价
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal DECIMAL(10,2) NOT NULL,              -- 小计金额
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

--6.物流轨迹表
CREATE TABLE logistics_trajectories (  --物流轨迹
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  location geometry(Point, 4326) NOT NULL,      -- 当前位置坐标
  status TEXT NOT NULL DEFAULT 'in_transit' CHECK (
    status IN ('pickup', 'in_transit', 'out_for_delivery', 'delivered')
  ),-- 状态描述：已揽收      运输中         快递员派送中         已送达
  description TEXT,                             
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

--7.物流公司表
CREATE TABLE logistics_providers (  --物流公司
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,                    -- 物流公司名称
  code TEXT NOT NULL UNIQUE,                    -- 公司代码: SF, YTO, STO等
  contact_phone TEXT,
  average_delivery_time INTEGER,               -- 平均配送时长(小时)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

--8.订单查询表
CREATE TABLE order_queries (    --订单查询
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  queried_at TIMESTAMPTZ DEFAULT now(),
  user_ip INET,                                -- 用户IP地址（用于匿名查询）
  user_agent TEXT                              -- 用户浏览器信息
);




--二. 启用RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_trajectories ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_queries ENABLE ROW LEVEL SECURITY;




--三. 配置策略
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




--四. 配置数据库索引

-- 1. 外键字段索引（关联查询优化）
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_logistics_trajectories_order_id ON logistics_trajectories(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_shop_id ON delivery_zones(shop_id);
CREATE INDEX IF NOT EXISTS idx_order_queries_order_id ON order_queries(order_id);
CREATE INDEX IF NOT EXISTS idx_order_queries_user_id ON order_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_shops_owner_id ON shops(owner_id);

-- 2. 业务查询字段索引（核心功能优化）
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logistics_trajectories_timestamp ON logistics_trajectories(timestamp DESC);

-- 3. 空间数据索引（地图功能必须）
CREATE INDEX IF NOT EXISTS idx_logistics_trajectories_location ON logistics_trajectories USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_area ON delivery_zones USING GIST (zone_area);

-- 4. 状态筛选索引（管理界面优化）
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON delivery_zones(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_logistics_providers_active ON logistics_providers(is_active) WHERE is_active = true;




--五. 插入测试数据
\i database/seeds/sample_data.sql




--完成初始化
SELECT '🎉 数据库初始化完成！' as message;
SELECT '现在可以开始开发了！' as next_step;