// 订单类型
export interface Order {
	id: string;
	order_number: string;
	shop_id: string;
	customer_name: string;
	customer_phone: string;
	customer_address: string;
	total_amount: number;
	status: "pending" | "confirmed" | "shipping" | "delivered" | "cancelled";
	priority: "low" | "normal" | "high" | "urgent";
	estimated_delivery: string | null;
	actual_delivery: string | null;
	created_at: string;
	updated_at: string;
	logistics_provider_id: string;
}

// 订单查询参数类型
export interface OrderQueryParams {
	page: number;
	pageSize: number;
	status: string; // "ALL" 或 具体状态
	searchText: string; // 用于搜索订单号或客户名
	sortField: string; // 数据库字段名
	sortOrder: "asc" | "desc";
}

// 物流轨迹点类型
export interface TrajectoryPoint {
	id: string;
	order_id: string;
	location: {
		coordinates: [number, number]; // [经度, 纬度]
	};
	status: "pickup" | "in_transit" | "out_for_delivery" | "delivered";
	description: string;
	timestamp: string;
}

// 物流轨迹类型
export interface LogisticsTrajectory {
	orderId: string;
	points: TrajectoryPoint[];
}