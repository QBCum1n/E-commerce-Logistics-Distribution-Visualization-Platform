import { Card, Tabs } from "antd";
import Map from "@/components/map";
import OrderManagement from "@/components/orders/order-management";

const containerStyle: React.CSSProperties = {
	width: "100%",
	height: "70vh",
	minHeight: 400,
};

const TestPage = () => {
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
				]}
			/>
		</div>
	);
};

export default TestPage;
