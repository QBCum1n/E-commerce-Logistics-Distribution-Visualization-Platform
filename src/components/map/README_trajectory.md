# 物流轨迹可视化功能

本功能实现了在地图上展示订单物流轨迹的可视化效果，支持单个订单轨迹查看和多个订单轨迹对比展示。

## 功能特点

1. **轨迹可视化**：在地图上展示订单的物流轨迹，包括取件、运输中、派送中、已送达等状态点
2. **状态区分**：不同状态的轨迹点使用不同颜色标记，便于识别
3. **交互体验**：点击轨迹点可查看详细信息，包括状态描述和时间
4. **多轨迹展示**：支持同时展示多个订单的轨迹，使用不同颜色区分
5. **自适应视图**：自动调整地图视野，确保所有轨迹点都在可视范围内

## 文件结构

```
src/
├── components/
│   ├── map.tsx                    # 基础地图组件
│   └── trajectoryMap.tsx          # 物流轨迹地图组件
├── pages/
│   ├── LogisticsTrajectoryPage.tsx # 物流轨迹页面
│   └── merchant/
│       └── index.tsx              # 商家页面（已集成轨迹地图）
├── services/
│   ├── logisticsService.ts        # 物流相关服务
│   └── orderService.ts            # 订单相关服务
├── types/
│   └── order.ts                   # 类型定义（包含轨迹类型）
└── router/
    └── routes.tsx                  # 路由配置
```

## 使用方法

### 1. 作为独立页面使用

访问 `/trajectory` 路径，可以查看物流轨迹页面，该页面会加载订单列表，并允许选择特定订单查看轨迹。

### 2. 作为组件使用

```tsx
import TrajectoryMap from "@/components/trajectoryMap";

// 在组件中使用
<TrajectoryMap 
  orders={orders} 
  selectedOrderId={selectedOrderId}
  onOrderSelect={handleOrderSelect}
/>
```

### 3. 在现有页面中集成

可以在任何需要展示物流轨迹的页面中集成 `TrajectoryMap` 组件，只需传入订单列表即可。

## 组件属性

TrajectoryMap 组件接受以下属性：

- `orders?: Order[]` - 可选的订单列表，用于展示多个订单的轨迹
- `selectedOrderId?: string` - 当前选中的订单ID
- `onOrderSelect?: (orderId: string) => void` - 订单选择回调函数

## 数据结构

### 轨迹点类型 (TrajectoryPoint)

```typescript
interface TrajectoryPoint {
  id: string;
  order_id: string;
  location: {
    coordinates: [number, number]; // [经度, 纬度]
  };
  status: "pickup" | "in_transit" | "out_for_delivery" | "delivered";
  description: string;
  timestamp: string;
}
```

### 物流轨迹类型 (LogisticsTrajectory)

```typescript
interface LogisticsTrajectory {
  orderId: string;
  points: TrajectoryPoint[];
}
```

## 状态说明

- `pickup`: 已取件（蓝色）
- `in_transit`: 运输中（橙色）
- `out_for_delivery`: 派送中（绿色）
- `delivered`: 已送达（紫色）

## 注意事项

1. 确保已正确配置高德地图的API密钥和安全密钥
2. 确保数据库中有物流轨迹数据（logistics_trajectories表）
3. 如果没有轨迹数据，可以使用提供的SQL脚本生成测试数据

## 生成测试数据

可以使用以下SQL脚本生成测试轨迹数据：

1. `database/testTrajectories/generate_trajectories_safe.sql` - 安全版本，不删除现有数据
2. `database/testTrajectories/init_all_order_logistics.sql` - 完整初始化脚本

## 环境变量配置

确保在 `.env` 文件中配置以下变量：

```
VITE_AMAP_KEY=你的高德地图API密钥
VITE_AMAP_SECURITY_CODE=你的高德地图安全密钥
VITE_SUPABASE_URL=你的Supabase URL
VITE_SUPABASE_ANON_KEY=你的Supabase匿名密钥
```