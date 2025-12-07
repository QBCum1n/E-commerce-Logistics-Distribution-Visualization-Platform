import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import { Spin, message, Select, Button, Card, Space } from "antd";
import { getOrderTrajectory, getOrdersTrajectories } from "@/services/logisticsService";
import { getCurrentUserShop, updateShopRectangularDeliveryRange } from "@/services/shopService";
import type { LogisticsTrajectory, Order } from "@/types/order";
import type { Shop } from "@/services/shopService";

const { Option } = Select;

type AMapSDK = Awaited<ReturnType<typeof AMapLoader.load>>;
type AMapMapInstance = InstanceType<AMapSDK["Map"]>;
type AMapMarker = InstanceType<AMapSDK["Marker"]>;
type AMapPolyline = InstanceType<AMapSDK["Polyline"]>;

declare global {
	interface Window {
		_AMapSecurityConfig?: {
			securityJsCode: string;
		};
		AMap?: AMapSDK;
	}
}

const DEFAULT_CENTER: [number, number] = [114.057868, 22.543099];

// 定义状态类型
type TrajectoryStatus = "pickup" | "in_transit" | "out_for_delivery" | "delivered";

// 状态颜色映射
const STATUS_COLORS: Record<TrajectoryStatus, string> = {
	pickup: "#1890ff", // 蓝色 - 已揽件
	in_transit: "#faad14", // 橙色 - 运输中
	out_for_delivery: "#52c41a", // 绿色 - 派送中
	delivered: "#722ed1", // 紫色 - 已送达
};

// 状态名称映射
const STATUS_NAMES: Record<TrajectoryStatus, string> = {
	pickup: "已揽件",
	in_transit: "运输中",
	out_for_delivery: "派送中",
	delivered: "已送达",
};

// 地图组件暴露的方法类型
interface TrajectoryMapRef {
	handleDeliveryRangeUpdate: () => Promise<void>;
}

interface TrajectoryMapProps {
	orders?: Order[]; // 可选的订单列表，用于展示多个订单的轨迹
	selectedOrderId?: string; // 当前选中的订单ID
	onOrderSelect?: (orderId: string) => void; // 订单选择回调
	showOnlyInRange?: boolean; // 是否只显示配送范围内的订单
	onDeliveryRangeUpdate?: () => void; // 配送范围更新回调
}

const TrajectoryMap = forwardRef<TrajectoryMapRef, TrajectoryMapProps>(({ orders = [], selectedOrderId, onOrderSelect, showOnlyInRange = false, onDeliveryRangeUpdate }, ref) => {
	const [messageApi, contextHolder] = message.useMessage();
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapInstanceRef = useRef<AMapMapInstance | null>(null);
	const [loading, setLoading] = useState(true);
	const [trajectoryLoading, setTrajectoryLoading] = useState(false);
	const [trajectories, setTrajectories] = useState<LogisticsTrajectory[]>([]);
	const [currentOrderId, setCurrentOrderId] = useState<string | undefined>(selectedOrderId);
	const [showAllTrajectories, setShowAllTrajectories] = useState(false);
	const markersRef = useRef<AMapMarker[]>([]);
	const polylinesRef = useRef<AMapPolyline[]>([]);
	const [currentShop, setCurrentShop] = useState<Shop | null>(null);

	// 加载指定订单的轨迹
	const loadOrderTrajectory = useCallback(async (orderId: string) => {
		if (!orderId) return;
		
		setTrajectoryLoading(true);
		try {
			const trajectory = await getOrderTrajectory(orderId);
			setTrajectories([trajectory]);
			renderTrajectoryOnMap(trajectory);
		} catch (error) {
			console.error("加载订单轨迹失败:", error);
			messageApi.error("加载订单轨迹失败");
		} finally {
			setTrajectoryLoading(false);
		}
	}, [messageApi]);

	// 加载所有订单的轨迹
	const loadAllTrajectories = useCallback(async () => {
		if (!orders || orders.length === 0) return;
		
		setTrajectoryLoading(true);
		try {
			const orderIds = orders.map(order => order.id);
			const allTrajectories = await getOrdersTrajectories(orderIds);
			setTrajectories(allTrajectories);
			renderAllTrajectoriesOnMap(allTrajectories);
		} catch (error) {
			console.error("加载所有轨迹失败:", error);
			messageApi.error("加载所有轨迹失败");
		} finally {
			setTrajectoryLoading(false);
		}
	}, [orders, messageApi]);

	// 清除地图上的所有轨迹
	const clearTrajectoriesFromMap = useCallback(() => {
		// 清除标记点
		markersRef.current.forEach(marker => {
			// 清除波纹效果的定时器
			const extData = marker.getExtData();
			if (extData && extData.rippleInterval) {
				clearInterval(extData.rippleInterval);
			}
			mapInstanceRef.current?.remove(marker);
		});
		markersRef.current = [];
		
		// 清除轨迹线
		polylinesRef.current.forEach(polyline => {
			mapInstanceRef.current?.remove(polyline);
		});
		polylinesRef.current = [];
	}, []);

	// 在地图上渲染单个轨迹
	const renderTrajectoryOnMap = useCallback((trajectory: LogisticsTrajectory) => {
		if (!mapInstanceRef.current || !trajectory.points || trajectory.points.length === 0) return;

		clearTrajectoriesFromMap();

		const { points } = trajectory;

		// 转换坐标点
		const path = points.map(point => {
			const [lng, lat] = point.location.coordinates;
			return new window.AMap!.LngLat(lng, lat);
		});

		// 创建轨迹线
		const polyline = new window.AMap!.Polyline({
			path: path,
			strokeColor: "#1890ff",
			strokeWeight: 4,
			strokeOpacity: 0.8,
			showDir: true,
		});
		
		mapInstanceRef.current.add(polyline);
		polylinesRef.current.push(polyline);

		// 为每个轨迹点添加标记
		points.forEach((point, index) => {
			const [lng, lat] = point.location.coordinates;
			const position = new window.AMap!.LngLat(lng, lat);
			
			// 创建标记点
			const marker = new window.AMap!.Marker({
				position: position,
				icon: new window.AMap!.Icon({
					size: new window.AMap!.Size(25, 34),
					image: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
						<svg width="25" height="34" viewBox="0 0 25 34" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 19.8 12.5 34 12.5 34S25 19.8 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="${STATUS_COLORS[point.status as TrajectoryStatus]}"/>
							<text x="12.5" y="18" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${index + 1}</text>
						</svg>
					`)}`,
					imageSize: new window.AMap!.Size(25, 34),
				}),
				offset: new window.AMap!.Pixel(-12, -34),
			});
			
			// 创建信息窗体
			const infoWindow = new window.AMap!.InfoWindow({
				content: `
					<div style="padding: 8px; max-width: 200px;">
						<div style="font-weight: bold; margin-bottom: 5px;">${STATUS_NAMES[point.status as TrajectoryStatus]}</div>
						<div style="font-size: 12px; color: #666; margin-bottom: 3px;">${point.description}</div>
						<div style="font-size: 11px; color: #999;">${new Date(point.timestamp).toLocaleString()}</div>
					</div>
				`,
				offset: new window.AMap!.Pixel(0, -34),
			});
			
			// 点击标记点显示信息窗体
			marker.on('click', () => {
				infoWindow.open(mapInstanceRef.current!, position);
			});
			
			mapInstanceRef.current.add(marker);
			markersRef.current.push(marker);

			// 为最新的轨迹点（订单当前位置）添加波纹效果
			if (index === points.length - 1) {
								// 创建持续波纹效果的函数
				const createContinuousRipple = () => {
					// 创建波纹圆圈
					const rippleCircle = new window.AMap!.Circle({
						center: position,
						radius: 50, // 初始半径
						strokeColor: STATUS_COLORS[point.status as TrajectoryStatus],
						strokeWeight: 2,
						strokeOpacity: 0.8,
						fillColor: STATUS_COLORS[point.status as TrajectoryStatus],
						fillOpacity: 0.3,
						zIndex: 10,
					});
					
					mapInstanceRef.current.add(rippleCircle);
					
					// 动画效果：波纹扩散
					let radius = 50;
					let opacity = 0.8;
					const interval = setInterval(() => {
						radius += 5;
						opacity -= 0.02;
						
						if (opacity <= 0) {
							clearInterval(interval);
							mapInstanceRef.current?.remove(rippleCircle);
							return;
						}
						
						rippleCircle.setRadius(radius);
						rippleCircle.setOptions({
							strokeOpacity: opacity,
							fillOpacity: opacity * 0.4,
						});
					}, 50);
				};
				
				// 立即创建第一个波纹
				createContinuousRipple();
				
				// 每隔2秒创建一个新的波纹，实现持续效果
				const rippleInterval = setInterval(createContinuousRipple, 2000);
				
				// 将interval ID存储在标记上，以便在清除轨迹时能够清除
				marker.setExtData({ rippleInterval });
			}
		});

		// 调整地图视野以包含所有轨迹点
		mapInstanceRef.current.setFitView([polyline, ...markersRef.current]);
	}, [clearTrajectoriesFromMap]);

	// 在地图上渲染多个轨迹
	const renderAllTrajectoriesOnMap = useCallback((allTrajectories: LogisticsTrajectory[]) => {
		if (!mapInstanceRef.current || !allTrajectories || allTrajectories.length === 0) return;

		clearTrajectoriesFromMap();

		// 为每个轨迹创建不同颜色的轨迹线
		const colors = ["#1890ff", "#52c41a", "#faad14", "#722ed1", "#f5222d", "#13c2c2", "#eb2f96"];
		
		allTrajectories.forEach((trajectory, trajectoryIndex) => {
			if (!trajectory.points || trajectory.points.length === 0) return;
			
			const color = colors[trajectoryIndex % colors.length];
			const { points } = trajectory;

			// 转换坐标点
			const path = points.map(point => {
				const [lng, lat] = point.location.coordinates;
				return new window.AMap!.LngLat(lng, lat);
			});

			// 创建轨迹线
			const polyline = new window.AMap!.Polyline({
				path: path,
				strokeColor: color,
				strokeWeight: 3,
				strokeOpacity: 0.7,
				showDir: true,
			});
			
			mapInstanceRef.current.add(polyline);
			polylinesRef.current.push(polyline);

			// 只为每个轨迹的起点和终点添加标记
			const startPoint = points[0];
			const endPoint = points[points.length - 1];

			// 起点标记
			if (startPoint) {
				const [lng, lat] = startPoint.location.coordinates;
				const position = new window.AMap!.LngLat(lng, lat);
				
				const startMarker = new window.AMap!.Marker({
					position: position,
					icon: new window.AMap!.Icon({
						size: new window.AMap!.Size(25, 34),
						image: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
							<svg width="25" height="34" viewBox="0 0 25 34" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 19.8 12.5 34 12.5 34S25 19.8 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="${color}"/>
								<text x="12.5" y="18" text-anchor="middle" fill="white" font-size="12" font-weight="bold">起</text>
							</svg>
						`)}`,
						imageSize: new window.AMap!.Size(25, 34),
					}),
					offset: new window.AMap!.Pixel(-12, -34),
				});
				
				mapInstanceRef.current.add(startMarker);
				markersRef.current.push(startMarker);
			}

			// 终点标记
			if (endPoint) {
				const [lng, lat] = endPoint.location.coordinates;
				const position = new window.AMap!.LngLat(lng, lat);
				
				const endMarker = new window.AMap!.Marker({
					position: position,
					icon: new window.AMap!.Icon({
						size: new window.AMap!.Size(25, 34),
						image: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
							<svg width="25" height="34" viewBox="0 0 25 34" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 19.8 12.5 34 12.5 34S25 19.8 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="${color}"/>
								<text x="12.5" y="18" text-anchor="middle" fill="white" font-size="12" font-weight="bold">终</text>
							</svg>
						`)}`,
						imageSize: new window.AMap!.Size(25, 34),
					}),
					offset: new window.AMap!.Pixel(-12, -34),
				});
				
				mapInstanceRef.current.add(endMarker);
				markersRef.current.push(endMarker);

				// 为终点（订单当前位置）添加波纹效果
				// 创建持续波纹效果的函数
				const createContinuousRipple = () => {
					// 创建波纹圆圈
					const rippleCircle = new window.AMap!.Circle({
						center: position,
						radius: 50, // 初始半径
						strokeColor: color,
						strokeWeight: 2,
						strokeOpacity: 0.8,
						fillColor: color,
						fillOpacity: 0.3,
						zIndex: 10,
					});
					
					mapInstanceRef.current.add(rippleCircle);
					
					// 动画效果：波纹扩散
					let radius = 50;
					let opacity = 0.8;
					const interval = setInterval(() => {
						radius += 5;
						opacity -= 0.02;
						
						if (opacity <= 0) {
							clearInterval(interval);
							mapInstanceRef.current?.remove(rippleCircle);
							return;
						}
						
						rippleCircle.setRadius(radius);
						rippleCircle.setOptions({
							strokeOpacity: opacity,
							fillOpacity: opacity * 0.4,
						});
					}, 50);
				};
				
				// 立即创建第一个波纹
				createContinuousRipple();
				
				// 每隔2秒创建一个新的波纹，实现持续效果
				const rippleInterval = setInterval(createContinuousRipple, 2000);
				
				// 将interval ID存储在标记上，以便在清除轨迹时能够清除
				endMarker.setExtData({ rippleInterval });
			}
		});

		// 调整地图视野以包含所有轨迹
		if (polylinesRef.current.length > 0) {
			mapInstanceRef.current.setFitView(polylinesRef.current);
		}
	}, [clearTrajectoriesFromMap]);

	// 处理订单选择
	const handleOrderSelect = (orderId: string) => {
		setCurrentOrderId(orderId);
		setShowAllTrajectories(false);
		if (onOrderSelect) {
			onOrderSelect(orderId);
		}
	};

	// 处理显示所有轨迹
	const handleShowAllTrajectories = () => {
		setShowAllTrajectories(true);
		setCurrentOrderId(undefined);
	};

	// 处理配送范围更新
	const handleDeliveryRangeUpdate = async () => {
		if (!mapInstanceRef.current || !currentShop) {
			messageApi.error("地图未加载完成或商家信息不可用");
			return;
		}

		try {
			// 获取当前地图视图范围
			const bounds = mapInstanceRef.current.getBounds();
			if (!bounds) {
				messageApi.error("无法获取地图视图范围");
				return;
			}

			// 获取矩形范围的四个角点
			const northeast = bounds.getNorthEast();
			const southwest = bounds.getSouthWest();
			
			// 构建矩形范围的坐标
			const deliveryRange = {
				minLng: southwest.getLng(),
				minLat: southwest.getLat(),
				maxLng: northeast.getLng(),
				maxLat: northeast.getLat()
			};

			// 调用API更新配送范围
			await updateShopRectangularDeliveryRange(
				currentShop.id, 
				deliveryRange.minLng, 
				deliveryRange.minLat, 
				deliveryRange.maxLng, 
				deliveryRange.maxLat
			);
			
			messageApi.success("配送范围更新成功");
			
			// 调用回调函数，通知父组件配送范围已更新
			if (onDeliveryRangeUpdate) {
				onDeliveryRangeUpdate();
			}
		} catch (error) {
			console.error("更新配送范围失败:", error);
			messageApi.error("更新配送范围失败");
		}
	};

	// 暴露方法给父组件
	useImperativeHandle(ref, () => ({
		handleDeliveryRangeUpdate
	}));

	// 加载当前商家信息
	useEffect(() => {
		const loadShopInfo = async () => {
			try {
				const shop = await getCurrentUserShop();
				setCurrentShop(shop);
			} catch (error) {
				console.error("加载商家信息失败:", error);
			}
		};

		loadShopInfo();
	}, []);

	// 初始化地图
	useEffect(() => {
		let destroyed = false;

		const key = import.meta.env.VITE_AMAP_KEY;
		const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE;
		if (!key || !securityCode) {
			messageApi.error("地图配置错误，请检查环境变量");
			console.error("请设置 VITE_AMAP_KEY或者VITE_AMAP_SECURITY_CODE");
			setLoading(false);
			return;
		}

		window._AMapSecurityConfig = { securityJsCode: securityCode };

		const init = async () => {
			try {
				const AMap = await AMapLoader.load({
					key,
					version: "2.0",
					plugins: ["AMap.PlaceSearch", "AMap.AutoComplete"],
				});

				if (destroyed || !containerRef.current) return;

				mapInstanceRef.current = new AMap.Map(containerRef.current, {
					zoom: 13,
					center: DEFAULT_CENTER,
					viewMode: "3D",
				});

				window.AMap = AMap;

				messageApi.success("地图加载成功");
			} catch (error) {
				console.error("地图初始化失败:", error);
				messageApi.error("地图加载失败");
			} finally {
				if (!destroyed) setLoading(false);
			}
		};

		init();

		return () => {
			destroyed = true;
			mapInstanceRef.current?.destroy();
		};
	}, [messageApi]);

	// 当选择的订单ID变化时，加载对应轨迹
	useEffect(() => {
		if (currentOrderId && !showAllTrajectories) {
			loadOrderTrajectory(currentOrderId);
		}
	}, [currentOrderId, showAllTrajectories, loadOrderTrajectory]);

	// 当显示所有轨迹标志变化时，加载所有轨迹
	useEffect(() => {
		if (showAllTrajectories) {
			loadAllTrajectories();
		}
	}, [showAllTrajectories, loadAllTrajectories, orders]);

	return (
		<div style={{ position: "relative", width: "100%", height: "140%" }}>
			{contextHolder}
			{loading && (
				<div
					style={{
						position: "absolute",
						inset: 0,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						flexDirection: "column",
						background: "rgba(255,255,255,0.8)",
						zIndex: 1,
					}}>
					<Spin size="large" />
					<span style={{ marginTop: 8, color: "#555" }}>地图加载中...</span>
				</div>
			)}
			
			{/* 控制面板 */}
			<Card
				style={{
					position: "absolute",
					top: 0,
					left: 10,
					zIndex: 2,
					width: "20%",
					maxHeight: "100%",
					overflow: "auto",
				}}
				size="small"
				title="物流轨迹控制"
			>
				<Space direction="vertical" style={{ width: "100%" }}>
					{orders && orders.length > 0 && (
						<div>
							<div style={{ marginBottom: 8 }}>选择订单:</div>
							<Select
								style={{ width: "100%" }}
								placeholder="选择订单查看轨迹"
								value={currentOrderId}
								onChange={handleOrderSelect}
								allowClear
							>
								{orders.map(order => (
									<Option key={order.id} value={order.id}>
										{order.order_number} - {order.customer_name}
									</Option>
								))}
							</Select>
						</div>
					)}
					
					<Button
						type="primary"
						onClick={handleShowAllTrajectories}
						disabled={!orders || orders.length === 0}
						loading={trajectoryLoading}
						style={{ width: "100%" }}
					>
						{showOnlyInRange && (!orders || orders.length === 0) ? "配送范围内没有订单" : "显示所有轨迹"}
					</Button>
					
					{trajectoryLoading && (
						<div style={{ textAlign: "center", color: "#666" }}>
							<Spin size="small" /> 轨迹加载中...
						</div>
					)}
					
					{trajectories.length > 0 && (
						<div>
							<div style={{ marginBottom: 8 }}>状态图例:</div>
							<div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
								{Object.entries(STATUS_COLORS).map(([status, color]) => (
									<div key={status} style={{ display: "flex", alignItems: "center" }}>
										<div
											style={{
												width: 12,
												height: 12,
												borderRadius: "50%",
												backgroundColor: color,
												marginRight: 4,
											}}
										/>
										<span style={{ fontSize: 12 }}>{STATUS_NAMES[status as TrajectoryStatus]}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</Space>
			</Card>
			
			<div ref={containerRef} style={{ width: "100%", height: "100%" }} />
		</div>
	);
});

TrajectoryMap.displayName = 'TrajectoryMap';

export default TrajectoryMap;