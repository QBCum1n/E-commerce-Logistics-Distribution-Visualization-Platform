import { useState, useEffect, useRef } from "react";
import { Card, Row, Col, Statistic } from "antd";
import { ShoppingCartOutlined, UserOutlined, TruckOutlined, DollarOutlined } from "@ant-design/icons";
import { getOrders } from "@/services/orderService";
import { getLogisticsProviders } from "@/services/logisticsService";
import type { Order } from "@/types/order";
import type { LogisticsProvider } from "@/services/logisticsService";
import OrderHeatmap from "@/components/map/orderHeatmap";
import DeliveryAnalysis from "@/components/charts/deliveryAnalysis";
import * as echarts from 'echarts';

const Dashboard = () => {
	const [orders, setOrders] = useState<Order[]>([]);
	const [logisticsProviders, setLogisticsProviders] = useState<LogisticsProvider[]>([]);
	// const [loading, setLoading] = useState(false);	
	const districtChartRef = useRef<HTMLDivElement>(null);
	const logisticsChartRef = useRef<HTMLDivElement>(null);
	const districtChartInstance = useRef<echarts.ECharts | null>(null);
	const logisticsChartInstance = useRef<echarts.ECharts | null>(null);

	// 加载订单数据
	const loadOrders = async () => {
		// setLoading(true);
		try {
			const result = await getOrders({
				page: 1,
				pageSize: 1000, // 获取足够多的订单用于看板展示
				status: "ALL",
				searchText: "",
				sortField: "created_at",
				sortOrder: "desc"
			});
			setOrders(result.items);
		} catch (error) {
			console.error("加载订单失败:", error);
		} finally {
			// setLoading(false);
		}
	};

	// 加载物流提供商数据
	const loadLogisticsProviders = async () => {
		try {
			const providers = await getLogisticsProviders();
			setLogisticsProviders(providers);
		} catch (error) {
			console.error("加载物流提供商失败:", error);
		}
	};

	// 判断订单是否超时
	const isOrderOverdue = (order: Order): boolean => {
		// 只有已送达的订单才能判断是否超时
		if (order.status !== 'delivered' || !order.actual_delivery || !order.created_at) {
			return false;
		}
		
		const createdTime = new Date(order.created_at);
		const actualDeliveryTime = new Date(order.actual_delivery);
		const deliveryHours = (actualDeliveryTime.getTime() - createdTime.getTime()) / (1000 * 60 * 60);
		
		return deliveryHours > order.limited_delivery_time;
	};

	useEffect(() => {
		loadOrders();
		loadLogisticsProviders();
	}, []);

	// 初始化区域分布饼图
	const initDistrictChart = () => {
		if (!districtChartRef.current) return;
		
		// 从订单地址提取深圳各区数据
		const districtData = orders.reduce((acc: {name: string, value: number}[], order) => {
			// 简单的地址解析逻辑，实际应用中可能需要更复杂的解析
			const address = order.customer_address || "";
			let district = "其他区域";
			
			// 深圳主要区域关键字匹配
			const districts = ["南山", "福田", "罗湖", "宝安", "龙岗", "龙华", "坪山", "光明", "盐田", "大鹏"];
			for (const d of districts) {
				if (address.includes(d)) {
					district = d + "区";
					break;
				}
			}
			
			const existing = acc.find(item => item.name === district);
			if (existing) {
				existing.value += 1;
			} else {
				acc.push({ name: district, value: 1 });
			}
			return acc;
		}, []);

		const chart = echarts.init(districtChartRef.current);
		const option = {
			title: {
				text: '深圳市各区域订单分布',
				left: 'center',
				textStyle: {
					color: '#ffffff',
					fontSize: 14
				}
			},
			tooltip: {
				trigger: 'item',
				formatter: '{a} <br/>{b}: {c} ({d}%)'
			},
			series: [
				{
					name: '订单分布',
					type: 'pie',
					radius: '50%',
					data: districtData,
					emphasis: {
						itemStyle: {
							shadowBlur: 10,
							shadowOffsetX: 0,
							shadowColor: 'rgba(0, 0, 0, 0.5)'
						}
					},
					label: {
						color: 'inherit'
					}
				}
			],
			backgroundColor: 'transparent'
		};

		chart.setOption(option);
		districtChartInstance.current = chart;
	};

	// 初始化物流公司占比饼图
	const initLogisticsChart = () => {
		if (!logisticsChartRef.current || logisticsProviders.length === 0) return;
		
		// 统计各物流公司的订单数量
		const logisticsData = logisticsProviders.map(provider => {
			const orderCount = orders.filter(
				order => order.logistics_provider_id === provider.id
			).length;
			return { 
				name: provider.name, 
				value: orderCount 
			};
		}).filter(item => item.value > 0); // 只显示有订单的物流公司

		const chart = echarts.init(logisticsChartRef.current);
		const option = {
			title: {
				text: '物流公司配送占比',
				left: 'center',
				textStyle: {
					color: '#ffffff',
					fontSize: 14
				}
			},
			tooltip: {
				trigger: 'item',
				formatter: '{a} <br/>{b}: {c} ({d}%)'
			},
			series: [
				{
					name: '物流占比',
					type: 'pie',
					radius: '50%',
					data: logisticsData,
					emphasis: {
						itemStyle: {
							shadowBlur: 10,
							shadowOffsetX: 0,
							shadowColor: 'rgba(0, 0, 0, 0.5)'
						}
					},
					label: {
						color: 'inherit'
					}
				}
			],
			backgroundColor: 'transparent'
		};

		chart.setOption(option);
		logisticsChartInstance.current = chart;
	};

	// 初始化图表
	useEffect(() => {
		if (orders.length > 0 && logisticsProviders.length > 0) {
			initDistrictChart();
			initLogisticsChart();
		}

		// 窗口大小变化时调整图表大小
		const handleResize = () => {
			if (districtChartInstance.current) {
				districtChartInstance.current.resize();
			}
			if (logisticsChartInstance.current) {
				logisticsChartInstance.current.resize();
			}
		};

		window.addEventListener('resize', handleResize);

		// 清理函数
		return () => {
			window.removeEventListener('resize', handleResize);
			if (districtChartInstance.current) {
				districtChartInstance.current.dispose();
			}
			if (logisticsChartInstance.current) {
				logisticsChartInstance.current.dispose();
			}
		};
	}, [orders, logisticsProviders]);

	// 计算统计数据
	const totalOrders = orders.length;
	const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
	const pendingOrders = orders.filter(order => order.status === "pending" || order.status === "confirmed").length;
	const deliveredOrders = orders.filter(order => order.status === "delivered").length;
	const overdueOrders = orders.filter(order => isOrderOverdue(order)).length;

	return (
		<div style={{ 
			padding: "24px", 
			background: "transparent",
			minHeight: "100vh",
			position: "relative",
			overflow: "hidden",
			width: "100%",
			height: "100%"
		}}>
			{/* 背景地图 */}
			<div style={{
				position: "absolute",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				zIndex: 0,
				opacity: 0.8,
				pointerEvents: "auto"
			}}>
				<OrderHeatmap 
					orders={orders} 
					height="100%"
					title=""
					showStats={false}
				/>
			</div>
			
			{/* 内容区域 */}
			<div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
				{/* 顶部统计卡片 */}
				<Row gutter={[16, 16]} style={{ marginBottom: "24px",}}>
					<Col xs={24} sm={12} lg={4}>
						<Card style={{ 
							borderRadius: '12px',
							boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
							background: 'rgba(255, 255, 255, 0.2)',
							backdropFilter: 'blur(10px)',
							border: 'none',
							pointerEvents: 'auto'
						}}>
							<Statistic
								title="总订单数"
								value={totalOrders}
								prefix={<ShoppingCartOutlined />}
								valueStyle={{ color: "#3f8600" }}
							/>
						</Card>
					</Col>
					<Col xs={24} sm={12} lg={4}>
						<Card style={{ 
							borderRadius: '12px',
							boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
							background: 'rgba(255, 255, 255, 0.2)',
							backdropFilter: 'blur(10px)',
							border: 'none',
							pointerEvents: 'auto'
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
					<Col xs={24} sm={12} lg={4}>
						<Card style={{ 
							borderRadius: '12px',
							boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
							background: 'rgba(255, 255, 255, 0.2)',
							backdropFilter: 'blur(10px)',
							border: 'none',
							pointerEvents: 'auto'
						}}>
							<Statistic
								title="待处理订单"
								value={pendingOrders}
								prefix={<UserOutlined />}
								valueStyle={{ color: "#1890ff" }}
							/>
						</Card>
					</Col>
					<Col xs={24} sm={12} lg={4}>
						<Card style={{ 
							borderRadius: '12px',
							boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
							background: 'rgba(255, 255, 255, 0.2)',
							backdropFilter: 'blur(10px)',
							border: 'none',
							pointerEvents: 'auto'
						}}>
							<Statistic
								title="已送达订单"
								value={deliveredOrders}
								prefix={<TruckOutlined />}
								valueStyle={{ color: "#52c41a" }}
							/>
						</Card>
					</Col>
					<Col xs={24} sm={12} lg={4}>
						<Card style={{ 
							borderRadius: '12px',
							boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
							background: 'rgba(255, 255, 255, 0.2)',
							backdropFilter: 'blur(10px)',
							border: 'none',
							pointerEvents: 'auto'
						}}>
							<Statistic
								title="配送超时订单"
								value={overdueOrders}
								prefix={<TruckOutlined />}
								valueStyle={{ color: "#ff4d4f" }}
							/>
						</Card>
					</Col>
					<Col xs={24} sm={12} lg={4}>
						<Card style={{ 
							borderRadius: '12px',
							boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
							background: 'rgba(255, 255, 255, 0.2)',
							backdropFilter: 'blur(10px)',
							border: 'none',
							pointerEvents: 'auto'
						}}>
							<Statistic
								title="配送准时率"
								value={deliveredOrders > 0 ? ((deliveredOrders - overdueOrders) / deliveredOrders * 100).toFixed(1) : 0}
								prefix={<TruckOutlined />}
								valueStyle={{ color: "#52c41a" }}
								suffix="%"
							/>
						</Card>
					</Col>
				</Row>
				
				<Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
					
				</Row>

				{/* 左右两侧内容 */}
				<Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
					{/* 左侧内容 */}
					<Col xs={24} lg={8}>
						<Card 
							title="配送时效分析"
							style={{ 
								height: '640px',
								borderRadius: '12px',
								boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
								background: 'rgba(255, 255, 255, 0.2)',
								backdropFilter: 'blur(10px)',
								border: 'none',
								pointerEvents: 'auto'
							}}
						>
							<DeliveryAnalysis orders={orders} height="520px" />
						</Card>
					</Col>
					
					{/* 中间空白区域留给地图背景 */}
					<Col xs={0} lg={8}>
					</Col>
					
					{/* 右侧内容 */}
					<Col xs={24} lg={8}>
						<Card 
							title="数据分析"
							style={{ 
								height: '640px',
								borderRadius: '12px',
								boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
								background: 'rgba(255, 255, 255, 0.2)',
								backdropFilter: 'blur(10px)',
								border: 'none',
								pointerEvents: 'auto'
							}}
						>
							<div style={{ height: '280px', marginBottom: '20px' }}>
								<div ref={districtChartRef} style={{ width: '100%', height: '100%' }}></div>
							</div>
							<div style={{ height: '280px' }}>
								<div ref={logisticsChartRef} style={{ width: '100%', height: '100%' }}></div>
							</div>
						</Card>
					</Col>
				</Row>
			</div>
		</div>
	);
};

export default Dashboard;