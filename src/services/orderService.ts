import { supabase } from "@/lib/supabaseClient";
import type { Order, OrderQueryParams, TrajectoryPoint } from "@/types/order";
import type { Shop } from "@/services/shopService";

// 获取订单列表
export const getOrders = async (params: OrderQueryParams): Promise<{ items: Order[], total: number }> => {
	try {
		let query = supabase
			.from("orders")
			.select("*, logistics_providers(name)", { count: "exact" });

		// 状态筛选
		if (params.status && params.status !== "ALL") {
			query = query.eq("status", params.status);
		}

		// 搜索筛选
		if (params.searchText) {
			query = query.or(`order_number.ilike.%${params.searchText}%,customer_name.ilike.%${params.searchText}%`);
		}

		// 排序
		query = query.order(params.sortField, { ascending: params.sortOrder === "asc" });

		// 分页
		const from = (params.page - 1) * params.pageSize;
		const to = from + params.pageSize - 1;
		query = query.range(from, to);

		const { data, error, count } = await query;

		if (error) throw error;

		return {
			items: data || [],
			total: count || 0
		};
	} catch (error) {
		console.error("获取订单列表失败:", error);
		throw error;
	}
};

// 获取商家配送范围内的订单
export const getOrdersInDeliveryRange = async (shop: Shop, params: OrderQueryParams): Promise<{ items: Order[], total: number }> => {
	try {
		// 如果商家没有设置配送范围，返回空结果
		if (!shop.delivery_range) {
			return { items: [], total: 0 };
		}

		// 使用数据库函数获取配送范围内的订单
		const query = supabase
			.rpc('orders_in_delivery_range_final', {
				shop_id_param: shop.id
			});

		const { data, error } = await query;

		if (error) {
			console.error("数据库函数执行失败:", error);
			throw new Error(`获取配送范围内订单失败: ${error.message}`);
		}

		// 在前端进行状态筛选
		let filteredData = data || [];
		if (params.status && params.status !== "ALL") {
			filteredData = filteredData.filter((order: Order) => order.status === params.status);
		}

		// 在前端进行搜索筛选
		if (params.searchText) {
			const searchTerm = params.searchText.toLowerCase();
			filteredData = filteredData.filter((order: Order) => 
				order.order_number.toLowerCase().includes(searchTerm) || 
				order.customer_name.toLowerCase().includes(searchTerm)
			);
		}

		// 在前端进行排序
		filteredData.sort((a: Order, b: Order) => {
			const aValue = a[params.sortField as keyof Order];
			const bValue = b[params.sortField as keyof Order];
			
			if (aValue === undefined || bValue === undefined) return 0;
			if (aValue === null && bValue === null) return 0;
			if (aValue === null) return 1;
			if (bValue === null) return -1;
			
			if (params.sortOrder === "asc") {
				return aValue > bValue ? 1 : -1;
			} else {
				return aValue < bValue ? 1 : -1;
			}
		});

		// 在前端进行分页
		const total = filteredData.length;
		const from = (params.page - 1) * params.pageSize;
		const to = from + params.pageSize;
		const paginatedData = filteredData.slice(from, to);

		return {
			items: paginatedData,
			total
		};
	} catch (error) {
		console.error("获取商家配送范围内订单失败:", error);
		throw error;
	}
};
export const getOrderById = async (id: string): Promise<Order | null> => {
	try {
		const { data, error } = await supabase
			.from("orders")
			.select("*, logistics_providers(name)")
			.eq("id", id)
			.single();

		if (error) throw error;
		return data;
	} catch (error) {
		console.error("获取订单详情失败:", error);
		throw error;
	}
};

// 更新订单状态
export const updateOrderStatus = async (id: string, status: Order["status"]): Promise<void> => {
	try {
		const { error } = await supabase
			.from("orders")
			.update({
				status,
				updated_at: new Date().toISOString(),
				// 如果状态更新为已送达，设置实际送达时间
				...(status === "delivered" && { actual_delivery: new Date().toISOString() })
			})
			.eq("id", id);

		if (error) throw error;
	} catch (error) {
		console.error("更新订单状态失败:", error);
		throw error;
	}
};

// 创建订单
export const createOrder = async (order: Omit<Order, "id" | "created_at" | "updated_at">): Promise<Order> => {
	try {
		const { data, error } = await supabase
			.from("orders")
			.insert({
				...order,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			})
			.select()
			.single();

		if (error) throw error;
		
		// 如果订单创建成功，确保配送距离被计算
		// 注意：数据库触发器会自动计算配送距离，但这里我们再次确保
		if (data && data.id) {
			try {
				// 获取更新后的订单信息，包括配送距离
				const { data: updatedOrder, error: fetchError } = await supabase
					.from("orders")
					.select("delivery_distance")
					.eq("id", data.id)
					.single();
				
				if (!fetchError && updatedOrder) {
					data.delivery_distance = updatedOrder.delivery_distance;
				}
			} catch (distanceError) {
				console.warn("获取配送距离失败:", distanceError);
				// 不影响订单创建流程，只是记录警告
			}
		}
		
		return data;
	} catch (error) {
		console.error("创建订单失败:", error);
		throw error;
	}
};

// 删除订单
export const deleteOrder = async (id: string): Promise<void> => {
	try {
		const { error } = await supabase
			.from("orders")
			.delete()
			.eq("id", id);

		if (error) throw error;
	} catch (error) {
		console.error("删除订单失败:", error);
		throw error;
	}
};

// 计算单个订单的配送距离
export const calculateOrderDeliveryDistance = async (orderId: string): Promise<number> => {
	try {
		const { data, error } = await supabase
			.rpc('calculate_delivery_distance_for_order', {
				order_id_param: orderId
			});

		if (error) throw error;
		return data || 0;
	} catch (error) {
		console.error("计算订单配送距离失败:", error);
		throw error;
	}
};

// 更新订单的配送距离
export const updateOrderDeliveryDistance = async (orderId: string): Promise<void> => {
	try {
		const { error } = await supabase
			.rpc('update_order_delivery_distance', {
				order_id_param: orderId
			});

		if (error) throw error;
	} catch (error) {
		console.error("更新订单配送距离失败:", error);
		throw error;
	}
};

// 计算多个订单的总配送距离
export const calculateTotalDeliveryDistance = async (orderIds: string[]): Promise<number> => {
	try {
		if (!orderIds || orderIds.length === 0) return 0;

		const { data, error } = await supabase
			.rpc('calculate_total_delivery_distance', {
				order_ids_param: orderIds
			});

		if (error) throw error;
		return data || 0;
	} catch (error) {
		console.error("计算总配送距离失败:", error);
		throw error;
	}
};

// 获取商家的总配送距离
export const getShopTotalDeliveryDistance = async (shopId: string, filters?: {
	status?: string;
	startDate?: string;
	endDate?: string;
}): Promise<number> => {
	try {
		const { data, error } = await supabase
			.rpc('get_shop_total_delivery_distance', {
				shop_id_param: shopId,
				status_filter: filters?.status || null,
				start_date_param: filters?.startDate || null,
				end_date_param: filters?.endDate || null
			});

		if (error) throw error;
		return data || 0;
	} catch (error) {
		console.error("获取商家总配送距离失败:", error);
		throw error;
	}
};

// 批量更新订单的配送距离
export const batchUpdateOrderDeliveryDistances = async (): Promise<number> => {
	try {
		const { data, error } = await supabase
			.rpc('update_all_orders_delivery_distance');

		if (error) throw error;
		return data || 0;
	} catch (error) {
		console.error("批量更新订单配送距离失败:", error);
		throw error;
	}
};

// 获取订单的物流轨迹和配送距离详情
export const getOrderTrajectoryWithDistance = async (orderId: string): Promise<{
	trajectory: TrajectoryPoint[];
	totalDistance: number;
}> => {
	try {
		// 获取订单的物流轨迹
		const { data: trajectory, error: trajectoryError } = await supabase
			.from("logistics_trajectories")
			.select("*")
			.eq("order_id", orderId)
			.order("timestamp", { ascending: true });

		if (trajectoryError) throw trajectoryError;

		// 获取订单的配送距离
		const { data: order, error: orderError } = await supabase
			.from("orders")
			.select("delivery_distance")
			.eq("id", orderId)
			.single();

		if (orderError) throw orderError;

		return {
			trajectory: trajectory || [],
			totalDistance: order?.delivery_distance || 0
		};
	} catch (error) {
		console.error("获取订单轨迹和配送距离失败:", error);
		throw error;
	}
};
