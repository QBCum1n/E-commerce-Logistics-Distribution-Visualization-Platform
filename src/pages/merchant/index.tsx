import { Card, Tabs } from "antd";
import Map from "@/components/map/map";
import TrajectoryMap from "@/components/map/trajectoryMap";
import OrderManagement from "@/components/orders/order-management";
import { getOrders } from "@/services/orderService";
import { useState, useEffect } from "react";
import type { Order } from "@/types/order";

const containerStyle: React.CSSProperties = {
	width: "100%",
	height: "70vh",
	minHeight: 400,
};

const MerchantPage = () => {
	const [orders, setOrders] = useState<Order[]>([]);

	// 加载订单数据
	useEffect(() => {
		const loadOrders = async () => {
			try {
				const data = await getOrders({
					page: 1,
					pageSize: 50,
					status: "ALL",
					searchText: "",
					sortField: "created_at",
					sortOrder: "desc",
				});
				setOrders(data.items || []);
			} catch (error) {
				console.error("加载订单失败:", error);
			}
		};

		loadOrders();
	}, []);

	return (
		<div style={{ padding: 24 }}>
			<Tabs
				defaultActiveKey="orders"
				items={[
					{
						key: "orders",
						label: "订单管理组件",
						children: <OrderManagement />,
					},
					{
						key: "map",
						label: "地图组件",
						children: (
							<Card title="城市地图演示" variant="borderless">
								<div style={containerStyle}>
									<Map />
								</div>
							</Card>
						),
					},
					{
						key: "trajectory",
						label: "物流轨迹",
						children: (
							<Card title="物流轨迹可视化" variant="borderless">
								<div style={containerStyle}>
									<TrajectoryMap orders={orders} />
								</div>
							</Card>
						),
					},
				]}
			/>
		</div>
	);
};

export default MerchantPage;
