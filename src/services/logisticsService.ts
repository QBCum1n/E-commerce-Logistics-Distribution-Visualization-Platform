import { supabase } from "@/lib/supabaseClient";
import type { TrajectoryPoint, LogisticsTrajectory } from "@/types/order";

// 快递公司类型定义
export interface LogisticsProvider {
	id: string;
	name: string;
	code: string;
	contact_phone: string;
	average_delivery_time: number;
	delivery_speed: number; // 配送速度，单位为千米每小时
	is_active: boolean;
	created_at: string;
}

// 获取所有活跃的快递公司
export const getLogisticsProviders = async (): Promise<LogisticsProvider[]> => {
	try {
		const { data, error } = await supabase.from("logistics_providers").select("*").eq("is_active", true).order("name");

		if (error) throw error;
		return data || [];
	} catch (error) {
		console.error("获取快递公司列表失败:", error);
		throw error;
	}
};

// 根据ID获取快递公司
export const getLogisticsProviderById = async (id: string): Promise<LogisticsProvider | null> => {
	try {
		const { data, error } = await supabase.from("logistics_providers").select("*").eq("id", id).single();

		if (error) throw error;
		return data;
	} catch (error) {
		console.error("获取快递公司失败:", error);
		throw error;
	}
};

// 更新订单的快递公司
export const updateOrderLogisticsProvider = async (orderId: string, providerId: string): Promise<void> => {
	try {
		const { error } = await supabase
			.from("orders")
			.update({
				logistics_provider_id: providerId,
				status: "shipping", // 更新订单状态为配送中
				updated_at: new Date().toISOString(),
			})
			.eq("id", orderId);

		if (error) throw error;
	} catch (error) {
		console.error("更新订单快递公司失败:", error);
		throw error;
	}
};

// 获取订单的物流轨迹点
export const getOrderTrajectoryPoints = async (orderId: string): Promise<TrajectoryPoint[]> => {
	try {
		const { data, error } = await supabase.from("logistics_trajectories").select("*").eq("order_id", orderId).order("timestamp", { ascending: true });

		if (error) throw error;
		return data || [];
	} catch (error) {
		console.error("获取订单轨迹点失败:", error);
		throw error;
	}
};

// 获取订单的完整物流轨迹
export const getOrderTrajectory = async (orderId: string): Promise<LogisticsTrajectory> => {
	const points = await getOrderTrajectoryPoints(orderId);
	return {
		orderId,
		points,
	};
};

// 获取多个订单的物流轨迹
export const getOrdersTrajectories = async (orderIds: string[]): Promise<LogisticsTrajectory[]> => {
	try {
		const { data, error } = await supabase
			.from("logistics_trajectories")
			.select("*")
			.in("order_id", orderIds)
			.order("timestamp", { ascending: true });

		if (error) throw error;

		// 按订单ID分组
		const trajectoriesMap = new Map<string, TrajectoryPoint[]>();
		(data || []).forEach((point) => {
			if (!trajectoriesMap.has(point.order_id)) {
				trajectoriesMap.set(point.order_id, []);
			}
			trajectoriesMap.get(point.order_id)!.push(point);
		});

		// 转换为LogisticsTrajectory数组
		const trajectories: LogisticsTrajectory[] = [];
		trajectoriesMap.forEach((points, orderId) => {
			trajectories.push({
				orderId,
				points,
			});
		});

		return trajectories;
	} catch (error) {
		console.error("获取多个订单轨迹失败:", error);
		throw error;
	}
};

// 更新单个轨迹点的坐标（用于路线纠偏）
export const updateTrajectoryPointLocation = async (trajectoryId: string, lng: number, lat: number): Promise<void> => {
	try {
		const payload: Record<string, unknown> = {
			location: {
				type: "Point",
				coordinates: [lng, lat],
			},
			updated_at: new Date().toISOString(),
		};


		const { error } = await supabase.from("logistics_trajectories").update(payload).eq("id", trajectoryId);

		if (error) throw error;
	} catch (error) {
		console.error("更新轨迹点坐标失败:", error);
		throw error;
	}
};
