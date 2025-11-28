import { useEffect, useRef, useState } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import { Spin, message } from "antd";

type AMapSDK = Awaited<ReturnType<typeof AMapLoader.load>>;
type AMapMapInstance = InstanceType<AMapSDK["Map"]>;

declare global {
	interface Window {
		_AMapSecurityConfig?: {
			securityJsCode: string;
		};
		AMap?: AMapSDK;
	}
}

const DEFAULT_CENTER: [number, number] = [114.057868, 22.543099];

const Map = () => {
	const [messageApi, contextHolder] = message.useMessage();
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapInstanceRef = useRef<AMapMapInstance | null>(null);
	const [loading, setLoading] = useState(true);

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

	return (
		<div style={{ position: "relative", width: "100%", height: "100%" }}>
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
			<div ref={containerRef} style={{ width: "100%", height: "100%" }} />
		</div>
	);
};

export default Map;
