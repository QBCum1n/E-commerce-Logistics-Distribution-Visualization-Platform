import { useState, useEffect, useCallback } from "react";
import { Card, Row, Col, Spin, message } from "antd";
import { getOrders } from "@/services/orderService";
import TrajectoryMap from "@/components/map/trajectoryMap";
import type { Order } from "@/types/order";

const LogisticsTrajectoryPage = () => {
	const [loading, setLoading] = useState(true);
	const [orders, setOrders] = useState<Order[]>([]);
	const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>();
	const [messageApi, contextHolder] = message.useMessage();

	// 加载订单列表
	const loadOrders = useCallback(async () => {
		try {
			setLoading(true);
			const data = await getOrders({
				page: 1,
				pageSize: 20,
				status: "ALL",
				searchText: "",
				sortField: "created_at",
				sortOrder: "desc",
			});
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

	// 处理订单选择
	const handleOrderSelect = (orderId: string) => {
		setSelectedOrderId(orderId);
	};

	useEffect(() => {
		loadOrders();
	}, [loadOrders]);

	return (
		<div style={{ padding: 24, height: "100%" }}>
			{contextHolder}
			<Card title="物流轨迹可视化" style={{ height: "100%" }}>
				{loading ? (
					<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 500 }}>
						<Spin size="large" />
					</div>
				) : (
					<Row gutter={16} style={{ height: "100%" }}>
						<Col span={24} style={{ height: 500 }}>
							<TrajectoryMap
								orders={orders}
								selectedOrderId={selectedOrderId}
								onOrderSelect={handleOrderSelect}
							/>
						</Col>
					</Row>
				)}
			</Card>
		</div>
	);
};

export default LogisticsTrajectoryPage;