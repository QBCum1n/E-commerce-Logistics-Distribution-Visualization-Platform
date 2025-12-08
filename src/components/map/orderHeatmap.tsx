import { useEffect, useRef, useState } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import { Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import type { Order } from "@/types/order";

// 定义高德地图类型
interface AMapInstance {
	destroy(): void;
	addControl(control: unknown): void;
	setFitView(): void;
}

// 安全密钥配置
if (typeof window !== "undefined" && !window._AMapSecurityConfig) {
	window._AMapSecurityConfig = {
		securityJsCode: import.meta.env.VITE_AMAP_SECURITY_CODE || "",
	};
}

interface HeatmapProps {
	orders: Order[];
	height?: string;
	title?: string;
	showStats?: boolean;
}

const OrderHeatmap: React.FC<HeatmapProps> = ({ 
	orders, 
	height = "500px", 

}) => {
	const mapRef = useRef<AMapInstance | null>(null);
	const mapContainerRef = useRef<HTMLDivElement>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const initMap = async () => {
			try {
				setLoading(true);
				// 加载高德地图API和热力图插件
				const AMap = await AMapLoader.load({
					key: import.meta.env.VITE_AMAP_KEY || "",
					version: "2.0",
					plugins: ["AMap.HeatMap"],
				});

				// 初始化地图
				const map = new AMap.Map(mapContainerRef.current!, {
					zoom: 11,
					center: [114.0579, 22.5431], // 深圳市中心
					viewMode: "2D",
					mapStyle: "amap://styles/darkblue", // 使用深蓝色地图样式
					features: ["bg", "road", "building", "point"], // 显示地图要素
					// 启用缩放和拖拽功能
					showLabel: false,
					resizeEnable: true,
					doubleClickZoom: true,
					scrollWheel: true,
					dragEnable: true,
					zoomEnable: true,
				});

				// 提取订单位置数据
				const heatmapData = orders.map(() => {
					// 深圳区域范围内的随机坐标
					const baseLng = 114.0579;
					const baseLat = 22.5431;
					const lng = baseLng + (Math.random() - 0.5) * 0.3;
					const lat = baseLat + (Math.random() - 0.5) * 0.2;
					return {
						lng,
						lat,
						count: 1,
					};
				});

				// 配置热力图 - 使用更现代的配色方案
				const heatmap = new AMap.HeatMap(map, {
					radius: 35, // 增大半径使热力效果更明显
					opacity: [0, 0.8],
					gradient: {
						0.3: "#2979FF", // 深蓝色
						0.4: "#00B0FF", // 蓝色
						0.5: "#00E5FF", // 浅蓝色
						0.6: "#1DE9B6", // 青绿色
						0.7: "#76FF03", // 绿色
						0.8: "#FFEA00", // 黄色
						0.9: "#FF6D00", // 橙色
						1.0: "#FF1744", // 红色
					},
				});

				// 设置热力图数据
				heatmap.setDataSet({
					data: heatmapData,
					max: Math.max(5, Math.ceil(orders.length / 10)), // 动态调整最大值
				});

				// 作为背景，不添加地图控件
				// 自适应显示所有数据点
				map.setFitView();

				mapRef.current = map;
			} catch (error) {
				console.error("初始化热力图失败:", error);
			} finally {
				setLoading(false);
			}
		};

		initMap();

		// 清理函数
		return () => {
			if (mapRef.current) {
				mapRef.current.destroy();
			}
		};
	}, [orders]);

	// 计算统计数据
	// const totalOrders = orders.length;

	return (
		<div style={{ position: "relative", width: "100%", height }}>
			<div
				ref={mapContainerRef}
				style={{ 
					width: "100%", 
					height: "100%",
				}}
			/>
			{loading && (
				<div
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						display: "flex",
						flexDirection: "column",
						justifyContent: "center",
						alignItems: "center",
						backgroundColor: "rgba(0, 0, 0, 0.3)",
					}}
				>
					<Spin 
						indicator={<LoadingOutlined style={{ fontSize: 32, color: '#1890ff' }} spin />} 
					/>
					<div style={{ marginTop: '16px', color: '#fff' }}>正在加载热力图...</div>
				</div>
			)}
		</div>
	);
};

export default OrderHeatmap;