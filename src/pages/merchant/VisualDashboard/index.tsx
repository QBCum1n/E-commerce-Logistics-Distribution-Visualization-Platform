import { useState, useEffect } from "react";
import { Card, Row, Col, Statistic, Table, Tag, Space, Button, DatePicker, Select, Dropdown } from "antd";
import { ShoppingCartOutlined, UserOutlined, TruckOutlined, DollarOutlined, DownOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { getOrders } from "@/services/orderService";
import type { Order, OrderQueryParams } from "@/types/order";
import OrderHeatmap from "@/components/map/orderHeatmap";
import DeliveryAnalysis from "@/components/charts/deliveryAnalysis";

const { RangePicker } = DatePicker;
const { Option } = Select;

const Dashboard = () => {
	const [orders, setOrders] = useState<Order[]>([]);
	const [loading, setLoading] = useState(false);
	const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
	const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
	// const [showOrderList, setShowOrderList] = useState(false);

	// 加载订单数据
	const loadOrders = async () => {
		setLoading(true);
		try {
			const params: OrderQueryParams = {
				page: 1,
				pageSize: 1000, // 获取足够多的订单用于看板展示
				status: "ALL",
				searchText: "",
				sortField: "created_at",
				sortOrder: "desc"
			};
			const result = await getOrders(params);
			setOrders(result.items);
		} catch (error) {
			console.error("加载订单失败:", error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadOrders();
	}, []);

	// 过滤订单
	const filteredOrders = orders.filter(order => {
		let matchDate = true;
		let matchStatus = true;

		if (dateRange && dateRange[0] && dateRange[1]) {
			const orderDate = new Date(order.created_at);
			matchDate = orderDate >= dateRange[0].toDate() && orderDate <= dateRange[1].toDate();
		}

		if (statusFilter) {
			matchStatus = order.status === statusFilter;
		}

		return matchDate && matchStatus;
	});

	// 计算统计数据
	const totalOrders = filteredOrders.length;
	const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
	const pendingOrders = filteredOrders.filter(order => order.status === "pending" || order.status === "confirmed").length;
	const deliveredOrders = filteredOrders.filter(order => order.status === "delivered").length;

	// 订单表格列配置
	const columns = [
		{
			title: "订单号",
			dataIndex: "order_number",
			key: "order_number",
		},
		{
			title: "客户姓名",
			dataIndex: "customer_name",
			key: "customer_name",
		},
		{
			title: "订单金额",
			dataIndex: "total_amount",
			key: "total_amount",
			render: (amount: number) => `¥${amount.toFixed(2)}`,
		},
		{
			title: "订单状态",
			dataIndex: "status",
			key: "status",
			render: (status: string) => {
				const statusConfig = {
					pending: { color: "orange", text: "待处理" },
					confirmed: { color: "blue", text: "已确认" },
					shipping: { color: "cyan", text: "配送中" },
					delivered: { color: "green", text: "已送达" },
					cancelled: { color: "red", text: "已取消" },
				};
				const config = statusConfig[status as keyof typeof statusConfig] || { color: "default", text: status };
				return <Tag color={config.color}>{config.text}</Tag>;
			},
		},
		{
			title: "下单时间",
			dataIndex: "created_at",
			key: "created_at",
			render: (date: string) => new Date(date).toLocaleString(),
		},
	];

	// 下拉菜单项
	const menuItems = [
		{
			key: 'order-list',
			label: (
				<div style={{ padding: '12px 0', width: 800, maxHeight: '600px', overflow: 'auto' }}>
					<div style={{ padding: '0 16px 16px', borderBottom: '1px solid #f0f0f0' }}>
						<Space>
							<RangePicker onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)} />
							<Select
								placeholder="筛选状态"
								style={{ width: 120 }}
								allowClear
								onChange={setStatusFilter}
							>
								<Option value="pending">待处理</Option>
								<Option value="confirmed">已确认</Option>
								<Option value="shipping">配送中</Option>
								<Option value="delivered">已送达</Option>
								<Option value="cancelled">已取消</Option>
							</Select>
							<Button onClick={loadOrders} loading={loading}>
								刷新
							</Button>
						</Space>
					</div>
					<Table
						columns={columns}
						dataSource={filteredOrders}
						rowKey="id"
						loading={loading}
						pagination={{
							pageSize: 5,
							showSizeChanger: true,
							showQuickJumper: true,
							showTotal: (total) => `共 ${total} 条记录`,
							simple: true,
						}}
						scroll={{ y: 400 }}
					/>
				</div>
			),
		},
	];

	return (
		<div style={{ 
			padding: "24px", 
			background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
			minHeight: "100vh"
		}}>
			{/* 统计卡片 */}
			<Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
				<Col xs={24} sm={12} lg={6}>
					<Card style={{ 
						borderRadius: '12px',
						boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
						background: 'rgba(255, 255, 255, 0.95)',
						backdropFilter: 'blur(10px)',
						border: 'none'
					}}>
						<Statistic
							title="总订单数"
							value={totalOrders}
							prefix={<ShoppingCartOutlined />}
							valueStyle={{ color: "#3f8600" }}
						/>
					</Card>
				</Col>
				<Col xs={24} sm={12} lg={6}>
					<Card style={{ 
						borderRadius: '12px',
						boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
						background: 'rgba(255, 255, 255, 0.95)',
						backdropFilter: 'blur(10px)',
						border: 'none'
					}}>
						<Statistic
							title="总营收"
							value={totalRevenue}
							prefix={<DollarOutlined />}
							precision={2}
							valueStyle={{ color: "#cf1322" }}
							suffix="元"
						/>
					</Card>
				</Col>
				<Col xs={24} sm={12} lg={6}>
					<Card style={{ 
						borderRadius: '12px',
						boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
						background: 'rgba(255, 255, 255, 0.95)',
						backdropFilter: 'blur(10px)',
						border: 'none'
					}}>
						<Statistic
							title="待处理订单"
							value={pendingOrders}
							prefix={<UserOutlined />}
							valueStyle={{ color: "#1890ff" }}
						/>
					</Card>
				</Col>
				<Col xs={24} sm={12} lg={6}>
					<Card style={{ 
						borderRadius: '12px',
						boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
						background: 'rgba(255, 255, 255, 0.95)',
						backdropFilter: 'blur(10px)',
						border: 'none'
					}}>
						<Statistic
							title="已送达订单"
							value={deliveredOrders}
							prefix={<TruckOutlined />}
							valueStyle={{ color: "#52c41a" }}
						/>
					</Card>
				</Col>
			</Row>

			{/* 可视化分析 */}
		<Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
			<Col xs={24} lg={12}>
				<OrderHeatmap 
					orders={filteredOrders} 
					height="500px"
					title="区域订单密度热力图"
					showStats={true}
				/>
			</Col>
			<Col xs={24} lg={12}>
				<Card 
					title="配送时效分析"
					style={{ 
						height: '640px',
						borderRadius: '12px',
						boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
						background: 'rgba(255, 255, 255, 0.95)',
						backdropFilter: 'blur(10px)',
						border: 'none'
					}}
				>
					<p style={{ marginBottom: "16px" }}>
						以下图表展示了每日的平均配送时长，帮助分析配送效率。
					</p>
					<DeliveryAnalysis orders={filteredOrders} height="520px" />
				</Card>
			</Col>
		</Row>

			{/* 订单列表下拉菜单 */}
			<div style={{ textAlign: 'center', marginTop: '24px' }}>
				<Dropdown
					menu={{ items: menuItems }}
					placement="bottomLeft"
					trigger={['click']}
					overlayStyle={{ borderRadius: '12px' }}
				>
					<Button
						type="primary"
						size="large"
						style={{
							borderRadius: '12px',
							boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
							background: 'rgba(255, 255, 255, 0.95)',
							backdropFilter: 'blur(10px)',
							border: 'none',
							color: '#667eea',
							fontWeight: 'bold',
							height: '50px',
							padding: '0 30px'
						}}
						icon={<DownOutlined />}
					>
						订单列表 ({filteredOrders.length})
					</Button>
				</Dropdown>
			</div>
		</div>
	);
};

export default Dashboard;