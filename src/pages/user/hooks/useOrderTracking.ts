// src/pages/CustomerPortal/hooks/useOrderTracking.ts
import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { RealtimeChannel } from "@supabase/supabase-js";
import type { TrajectoryPoint, Order } from "@/types/order";
import type { TrackingData, TrajectoryPointWithCoords } from "../types";
import { parseTrajectoryCoordinate, parseOrderCoordinate } from "../utils/coordinateParser";

// 定义消息回调类型
type ToastCallback = (type: "success" | "error" | "info" | "warning", content: string) => void;

export const useOrderTracking = (toastMessage?: ToastCallback) => {
	const [loading, setLoading] = useState(false);
	const [searched, setSearched] = useState(false);
	const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
	const [isUpdating, setIsUpdating] = useState(false);
	const subscriptionRef = useRef<RealtimeChannel | null>(null);

	// 封装消息提示，兼容未传入 toastMessage 的情况
	const showMessage = useCallback(
		(type: "success" | "error" | "info" | "warning", content: string) => {
			if (toastMessage) {
				toastMessage(type, content);
			} else {
				console.log(`[${type}] ${content}`);
			}
		},
		[toastMessage]
	);

	// 清理订阅
	useEffect(() => {
		return () => {
			if (subscriptionRef.current) {
				supabase.removeChannel(subscriptionRef.current);
			}
		};
	}, []);

	// 订阅订单更新
	const subscribeToOrderUpdates = useCallback(
		(orderId: string) => {
			if (subscriptionRef.current) {
				supabase.removeChannel(subscriptionRef.current);
			}

			const channel = supabase
				.channel(`order-tracking-${orderId}`)
				.on(
					"postgres_changes",
					{
						event: "UPDATE",
						schema: "public",
						table: "orders",
						filter: `id=eq.${orderId}`,
					},
					(payload) => {
						setIsUpdating(true);
						setTrackingData((prev) => {
							if (!prev) return null;
							return { ...prev, order: payload.new as Order };
						});
						setTimeout(() => setIsUpdating(false), 1500);
					}
				)
				.on(
					"postgres_changes",
					{
						event: "INSERT",
						schema: "public",
						table: "logistics_trajectories",
						filter: `order_id=eq.${orderId}`,
					},
					(payload) => {
						setIsUpdating(true);
						const newTrajectory = payload.new as TrajectoryPoint;

						setTrackingData((prev) => {
							if (!prev) return null;
							return {
								...prev,
								trajectories: [newTrajectory, ...prev.trajectories],
							};
						});

						showMessage("success", "有新的物流动态");
						setTimeout(() => setIsUpdating(false), 1500);
					}
				)
				.subscribe();

			subscriptionRef.current = channel;
		},
		[showMessage]
	);

	// 搜索订单
	const handleSearch = useCallback(
		async (orderNumber: string) => {
			if (!orderNumber.trim()) return;

			setLoading(true);
			setSearched(true);
			setTrackingData(null);

			try {
				const { data: orderData, error: orderError } = await supabase
					.rpc("get_order_by_number", { p_order_number: orderNumber.trim() })
					.maybeSingle();

				if (orderError) throw orderError;
				if (!orderData) throw new Error("未找到该订单信息，请检查单号");

				const { data: trajectoryData, error: trajError } = await supabase
					.from("logistics_trajectories")
					.select("*")
					.eq("order_id", (orderData as Order).id)
					.order("timestamp", { ascending: false });

				if (trajError) console.error("轨迹加载失败", trajError);

				setTrackingData({
					order: orderData as Order,
					trajectories: (trajectoryData as TrajectoryPoint[]) || [],
				});

				subscribeToOrderUpdates((orderData as Order).id);
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : "查询失败，请稍后重试";
				showMessage("error", errorMessage);
			} finally {
				setLoading(false);
			}
		},
		[subscribeToOrderUpdates, showMessage]
	);

	// 清理订阅（供外部调用）
	const cleanupSubscription = useCallback(() => {
		if (subscriptionRef.current) {
			supabase.removeChannel(subscriptionRef.current);
		}
	}, []);

	// 地图数据
	const mapTrajectories = useMemo((): TrajectoryPointWithCoords[] => {
		if (!trackingData?.trajectories) return [];

		return trackingData.trajectories
			.map((t) => {
				const coord = parseTrajectoryCoordinate(t);
				if (!coord) return null;
				return { ...t, ...coord };
			})
			.filter((t): t is TrajectoryPointWithCoords => t !== null);
	}, [trackingData?.trajectories]);

	const startPoint = useMemo(() => {
		if (!trackingData?.order) return undefined;
		return parseOrderCoordinate(trackingData.order, "sender");
	}, [trackingData?.order]);

	const endPoint = useMemo(() => {
		if (!trackingData?.order) return undefined;
		return parseOrderCoordinate(trackingData.order, "receiver");
	}, [trackingData?.order]);

	return {
		loading,
		searched,
		trackingData,
		isUpdating,
		handleSearch,
		cleanupSubscription,
		mapTrajectories,
		startPoint,
		endPoint,
	};
};
