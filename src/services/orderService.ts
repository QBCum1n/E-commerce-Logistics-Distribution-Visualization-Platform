import { supabase } from "@/lib/supabaseClient";
import type { Order, OrderQueryParams } from "@/types/order";

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

// 根据ID获取订单详情
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