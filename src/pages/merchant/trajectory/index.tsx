import { useState, useEffect, useCallback, useRef } from "react";
import { Card, Row, Col, Spin, message, Button, Switch, Tooltip } from "antd";
import { getOrders, getOrdersInDeliveryRange } from "@/services/orderService";
import { getCurrentUserShop } from "@/services/shopService";
import TrajectoryMap from "@/components/map/trajectoryMap";
import type { Order } from "@/types/order";
import type { Shop } from "@/services/shopService";

// 从组件文件中导入类型
type TrajectoryMapRef = {
	handleDeliveryRangeUpdate: () => Promise<void>;
};

const LogisticsTrajectoryPage = () => {
	const [loading, setLoading] = useState(true);
	const [orders, setOrders] = useState<Order[]>([]);
	const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>();
	const [messageApi, contextHolder] = message.useMessage();
	const [currentShop, setCurrentShop] = useState<Shop | null>(null);
	const [showOnlyInRange, setShowOnlyInRange] = useState(true); // 默认只显示配送范围内的订单
	const mapRef = useRef<TrajectoryMapRef>(null); // 使用正确的类型定义

	// 加载当前商家信息
	const loadCurrentShop = useCallback(async () => {
		try {
			const shop = await getCurrentUserShop();
			setCurrentShop(shop);
			return shop;
		} catch (error) {
			console.error("获取商家信息失败:", error);
			messageApi.error("获取商家信息失败");
			return null;
		}
	}, [messageApi]);

	// 加载订单列表
	const loadOrders = useCallback(async (shop: Shop | null, onlyInRange: boolean) => {
		try {
			setLoading(true);
			let data;
			
			if (shop && onlyInRange) {
				// 只获取配送范围内的订单
				try {
					data = await getOrdersInDeliveryRange(shop, {
						page: 1,
						pageSize: 20,
						status: "ALL",
						searchText: "",
						sortField: "created_at",
						sortOrder: "desc",
					});
				} catch (error) {
					console.error("获取配送范围内订单失败:", error);
					messageApi.error(`获取配送范围内订单失败: ${error instanceof Error ? error.message : '未知错误'}`);
					// 回退到获取所有订单
					data = await getOrders({
						page: 1,
						pageSize: 20,
						status: "ALL",
						searchText: "",
						sortField: "created_at",
						sortOrder: "desc",
					});
				}
			} else {
				// 获取所有订单
				data = await getOrders({
					page: 1,
					pageSize: 100000,
					status: "ALL",
					searchText: "",
					sortField: "created_at",
					sortOrder: "desc",
				});
			}
			
			setOrders(data.items);
			
			// 如果有订单，默认选择第一个
			if (data.items && data.items.length > 0) {
				setSelectedOrderId(data.items[0].id);
			}
		} catch (error) {
			console.error("加载订单列表失败:", error);
			messageApi.error("加载订单列表失败");
		} finally {
			setLoading(false);
		}
	}, [messageApi]);

	// 处理配送范围更新
	const handleDeliveryRangeUpdate = useCallback(() => {
		// 重新加载订单列表
		loadOrders(currentShop, showOnlyInRange);
	}, [currentShop, showOnlyInRange, loadOrders]);

	// 处理订单选择
	const handleOrderSelect = (orderId: string) => {
		setSelectedOrderId(orderId);
	};

	// 处理配送范围筛选开关
	const handleRangeFilterChange = (checked: boolean) => {
		setShowOnlyInRange(checked);
		loadOrders(currentShop, checked);
	};

	useEffect(() => {
		const initializeData = async () => {
			const shop = await loadCurrentShop();
			await loadOrders(shop, showOnlyInRange);
		};
		initializeData();
	}, [loadCurrentShop, loadOrders, showOnlyInRange]);

	return (
		<div style={{ padding: 24, height: "100%" }}>
			{contextHolder}
			<Card 
				title={
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<span>物流轨迹可视化</span>
						<div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
								<span>仅显示配送范围内订单:</span>
								<Switch 
									checked={showOnlyInRange} 
									onChange={handleRangeFilterChange}
								/>
							</div>
							<Tooltip title="圈选视口中的地图范围作为配送范围">
								<Button type="primary" onClick={async () => {
									// 调用地图组件中的配送范围更新函数
									if (mapRef && mapRef.current && mapRef.current.handleDeliveryRangeUpdate) {
										try {
											await mapRef.current.handleDeliveryRangeUpdate();
										} catch (error) {
											console.error("更新配送范围失败:", error);
											messageApi.error("更新配送范围失败");
										}
									}
								}}>
									圈选配送范围
								</Button>
							</Tooltip>
						</div>
					</div>
				} 
				style={{ height: "100%" }}
			>
				{loading ? (
					<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 500 }}>
						<Spin size="large" />
					</div>
				) : (
					<Row gutter={16} style={{ height: "100%" }}>
						<Col span={24} style={{ height: 500 }}>
							<TrajectoryMap
								ref={mapRef}
								orders={orders}
								selectedOrderId={selectedOrderId}
								onOrderSelect={handleOrderSelect}
								showOnlyInRange={showOnlyInRange}
								onDeliveryRangeUpdate={handleDeliveryRangeUpdate}
							/>
						</Col>
					</Row>
				)}
			</Card>
		</div>
	);
};

export default LogisticsTrajectoryPage;