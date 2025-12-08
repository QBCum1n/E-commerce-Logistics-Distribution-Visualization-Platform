import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { Order } from "@/types/order";

interface DeliveryAnalysisProps {
	orders: Order[];
	height?: string;
}

const DeliveryAnalysis: React.FC<DeliveryAnalysisProps> = ({ orders, height = "400px" }) => {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	useEffect(() => {
		if (!chartRef.current) return;

		// 初始化图表
		chartInstanceRef.current = echarts.init(chartRef.current);

		// 计算配送时效数据
		const calculateDeliveryData = () => {
			// 只计算已完成的订单
			const deliveredOrders = orders.filter(order => 
				order.status === "delivered" && 
				order.actual_delivery && 
				order.created_at
			);
			
			// 按天分组计算平均配送时长
			const dailyData: { [key: string]: { totalHours: number; count: number } } = {};
			
			deliveredOrders.forEach(order => {
				const createdDate = new Date(order.created_at);
				const deliveryDate = new Date(order.actual_delivery as string); // 类型断言，因为我们已经过滤了null值
				const diffHours = (deliveryDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60); // 小时
				
				const dateKey = createdDate.toISOString().split('T')[0]; // YYYY-MM-DD
				
				if (!dailyData[dateKey]) {
					dailyData[dateKey] = { totalHours: 0, count: 0 };
				}
				
				dailyData[dateKey].totalHours += diffHours;
				dailyData[dateKey].count += 1;
			});
			
			// 转换为图表数据格式
			const dates = Object.keys(dailyData).sort();
			const avgHours = dates.map(date => {
				const data = dailyData[date];
				return (data.totalHours / data.count).toFixed(2);
			});
			
			return { dates, avgHours };
		};

		const { dates, avgHours } = calculateDeliveryData();

		// 配置图表选项
		const option = {
			tooltip: {
				trigger: "axis",
				axisPointer: {
					type: "shadow",
				},
				formatter: function(params: echarts.DefaultLabelFormatterCallbackParams) {
					const param = Array.isArray(params) ? params[0] : params;
					return `${param.name}<br/>平均配送时长: ${param.value} 小时`;
				},
			},
			grid: {
				left: "3%",
				right: "4%",
				bottom: "3%",
				containLabel: true,
			},
			xAxis: [
				{
					type: "category",
					data: dates,
					axisTick: {
						alignWithLabel: true,
					},
					axisLabel: {
						rotate: 45,
						color: '#ffffff'
					},
					axisLine: {
						lineStyle: {
							color: '#ffffff'
						}
					}
				},
			],
			yAxis: [
				{
					type: "value",
					name: "平均配送时长(小时)",
					nameTextStyle: {
						color: '#ffffff'
					},
					axisLabel: {
						formatter: "{value} h",
						color: '#ffffff'
					},
					axisLine: {
						lineStyle: {
							color: '#ffffff'
						}
					},
					splitLine: {
						lineStyle: {
							color: 'rgba(255, 255, 255, 0.1)'
						}
					}
				},
			],
			series: [
				{
					name: "平均配送时长",
					type: "bar",
					barWidth: "60%",
					data: avgHours,
					itemStyle: {
						color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
							{ offset: 0, color: "#83bff6" },
							{ offset: 0.5, color: "#188df0" },
							{ offset: 1, color: "#188df0" },
						]),
					},
					emphasis: {
						itemStyle: {
							color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
								{ offset: 0, color: "#2378f7" },
								{ offset: 0.7, color: "#2378f7" },
								{ offset: 1, color: "#83bff6" },
							]),
						},
					},
				},
			],
			backgroundColor: 'transparent'
		};

		// 应用配置
		chartInstanceRef.current.setOption(option);

		// 响应式调整
		const handleResize = () => {
			chartInstanceRef.current?.resize();
		};

		window.addEventListener("resize", handleResize);

		// 清理函数
		return () => {
			window.removeEventListener("resize", handleResize);
			chartInstanceRef.current?.dispose();
		};
	}, [orders, height]);

	return <div ref={chartRef} style={{ width: "100%", height }} />;
};

export default DeliveryAnalysis;