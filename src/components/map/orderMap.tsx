import { useEffect, useRef, useState, useCallback } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import { Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import type {
	AMapSDKWithPlugins,
	AMapMouseEvent,
	AMapMapInstance,
	AMapMarker,
	AMapPolyline,
	Coordinate,
	OrderMapProps,
	LngLatTuple,
} from "@/types/amap";

// -----------------------------------------------------------------------------
// 安全密钥配置
// -----------------------------------------------------------------------------
if (typeof window !== "undefined" && !window._AMapSecurityConfig) {
	window._AMapSecurityConfig = {
		securityJsCode: import.meta.env.VITE_AMAP_SECURITY_CODE || "",
	};
}

// -----------------------------------------------------------------------------
// 扩展 Props 类型
// -----------------------------------------------------------------------------
interface ExtendedOrderMapProps extends OrderMapProps {
	/** 是否跟随小车移动 */
	followCar?: boolean;
	/** 跟随时的缩放级别 */
	followZoom?: number;
}

// -----------------------------------------------------------------------------
// 组件
// -----------------------------------------------------------------------------
const OrderMap: React.FC<ExtendedOrderMapProps> = ({
	trajectories,
	startPoint,
	endPoint,
	isSearching = false,
	followCar = true,
	followZoom = 15,
	onMapReady,
	onMapClick,
}) => {
	// Refs
	const mapRef = useRef<AMapMapInstance | null>(null);
	const carMarkerRef = useRef<AMapMarker | null>(null);
	const polylineRef = useRef<AMapPolyline | null>(null);
	const startMarkerRef = useRef<AMapMarker | null>(null);
	const endMarkerRef = useRef<AMapMarker | null>(null);
	const animationRef = useRef<number | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const lastLatestPointRef = useRef<Coordinate | null>(null);
	const AMapRef = useRef<AMapSDKWithPlugins | null>(null);
	// 跟踪当前轨迹的起点，用于判断是否是新订单
	const currentTrajectoryStartRef = useRef<LngLatTuple | null>(null);

	// 用户是否手动拖动过地图
	const userInteractedRef = useRef(false);
	// 用于延迟恢复跟随
	const resumeFollowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [isMapReady, setIsMapReady] = useState(false);
	const [isFollowing, setIsFollowing] = useState(followCar);

	// ---------------------------------------------------------------------------
	// 工具函数
	// ---------------------------------------------------------------------------
	const createMarkerContent = useCallback((type: "start" | "end" | "user"): string => {
		const configs = {
			start: { bg: "bg-blue-600", text: "发" },
			end: { bg: "bg-green-500", text: "收" },
			user: { bg: "bg-blue-600", text: "" },
		};
		const config = configs[type];

		if (type === "user") {
			return `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-blue-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-4 w-4 ${config.bg} border-2 border-white shadow-lg"></span>
          </div>
        `;
		}

		return `
        <div class="flex flex-col items-center">
          <div class="w-8 h-8 ${config.bg} rounded-full flex items-center justify-center text-white font-bold shadow-lg border-2 border-white z-10">
            ${config.text}
          </div>
          <div class="w-0.5 h-2 ${config.bg}/50"></div>
        </div>
      `;
	}, []);

	const createCarContent = useCallback((rotation: number = 0): string => {
		return `
      <div class="relative w-10 h-10 flex items-center justify-center">
        <div class="w-full h-full bg-contain bg-center bg-no-repeat drop-shadow-xl" 
          style="background-image: url('https://webapi.amap.com/images/car.png'); transform: rotate(${rotation - 90}deg);"></div>
      </div>
    `;
	}, []);

	const calculateAngle = useCallback((from: Coordinate, to: Coordinate): number => {
		return (Math.atan2(to.latitude - from.latitude, to.longitude - from.longitude) * 180) / Math.PI;
	}, []);

	const easeOutQuad = useCallback((t: number): number => 1 - (1 - t) * (1 - t), []);

	// ---------------------------------------------------------------------------
	// 平滑移动地图中心到指定位置
	// ---------------------------------------------------------------------------
	const smoothPanTo = useCallback(
		(position: LngLatTuple, duration: number = 500) => {
			if (!mapRef.current || !isFollowing || userInteractedRef.current) return;

			const map = mapRef.current;

			// 使用高德地图的 panTo 方法（自带平滑动画）
			map.panTo(position, duration);
		},
		[isFollowing]
	);

	// ---------------------------------------------------------------------------
	// 恢复跟随模式
	// ---------------------------------------------------------------------------
	const resumeFollowing = useCallback(() => {
		userInteractedRef.current = false;
		setIsFollowing(true);

		// 立即将视角移动到小车位置
		if (carMarkerRef.current && mapRef.current) {
			const pos = carMarkerRef.current.getPosition();
			if (pos) {
				mapRef.current.setZoomAndCenter(followZoom, [pos.getLng(), pos.getLat()], false, 500);
			}
		}
	}, [followZoom]);

	// ---------------------------------------------------------------------------
	// 初始化地图
	// ---------------------------------------------------------------------------
	useEffect(() => {
		let isMounted = true;

		const initMap = async () => {
			try {
				const AMapModule = (await AMapLoader.load({
					key: import.meta.env.VITE_AMAP_KEY || "",
					version: "2.0",
					plugins: ["AMap.Geolocation", "AMap.ToolBar", "AMap.Scale"],
				})) as AMapSDKWithPlugins;

				if (!isMounted || !containerRef.current) return;

				AMapRef.current = AMapModule;

				const map = new AMapModule.Map(containerRef.current, {
					viewMode: "2D",
					zoom: 11,
					center: [116.397428, 39.90923],
				});

				// 添加比例尺（左下角）
				map.addControl(new AMapModule.Scale({ position: "LB" }));

				// 添加工具栏
				map.addControl(
					new AMapModule.ToolBar({
						position: {
							bottom: "55px",
							right: "17px",
						},
						liteStyle: true, // 使用精简样式
					})
				);

				// 监听用户拖动地图
				map.on("dragstart", () => {
					userInteractedRef.current = true;
					setIsFollowing(false);

					// 清除之前的恢复定时器
					if (resumeFollowTimerRef.current) {
						clearTimeout(resumeFollowTimerRef.current);
					}

					// 5秒后自动恢复跟随（可选）
					resumeFollowTimerRef.current = setTimeout(() => {
						if (followCar) {
							resumeFollowing();
						}
					}, 5000);
				});

				if (onMapClick) {
					map.on("click", (e: AMapMouseEvent) => {
						onMapClick({
							longitude: e.lnglat.getLng(),
							latitude: e.lnglat.getLat(),
						});
					});
				}

				mapRef.current = map;
				setIsMapReady(true);
				onMapReady?.(map);

				// 无轨迹时定位到用户位置
				if ((!trajectories || trajectories.length === 0) && !startPoint) {
					const geolocation = new AMapModule.Geolocation({
						enableHighAccuracy: true,
						timeout: 10000,
						zoomToAccuracy: true,
						buttonPosition: "RB",
					});
					map.addControl(geolocation);

					geolocation.getCurrentPosition((status, result) => {
						if (status === "complete" && "position" in result) {
							const pos: LngLatTuple = [result.position.getLng(), result.position.getLat()];
							map.setCenter(pos);
							new AMapModule.Marker({
								position: pos,
								content: createMarkerContent("user"),
								offset: new AMapModule.Pixel(-8, -8),
								map,
							});
						}
					});
				}
			} catch (error) {
				console.error("Map Load Error:", error);
			}
		};

		initMap();

		return () => {
			isMounted = false;
			if (animationRef.current) cancelAnimationFrame(animationRef.current);
			if (resumeFollowTimerRef.current) clearTimeout(resumeFollowTimerRef.current);
			mapRef.current?.destroy();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// ---------------------------------------------------------------------------
	// 渲染起点/终点标记
	// ---------------------------------------------------------------------------
	useEffect(() => {
		if (!isMapReady || !mapRef.current || !AMapRef.current) return;

		const AMap = AMapRef.current;
		const map = mapRef.current;

		if (startPoint) {
			const pos: LngLatTuple = [startPoint.longitude, startPoint.latitude];
			if (startMarkerRef.current) {
				startMarkerRef.current.setPosition(pos);
			} else {
				startMarkerRef.current = new AMap.Marker({
					position: pos,
					content: createMarkerContent("start"),
					offset: new AMap.Pixel(-16, -38),
					map,
					zIndex: 100,
				});
			}
		}

		if (endPoint) {
			const pos: LngLatTuple = [endPoint.longitude, endPoint.latitude];
			if (endMarkerRef.current) {
				endMarkerRef.current.setPosition(pos);
			} else {
				endMarkerRef.current = new AMap.Marker({
					position: pos,
					content: createMarkerContent("end"),
					offset: new AMap.Pixel(-16, -38),
					map,
					zIndex: 100,
				});
			}
		}
	}, [isMapReady, startPoint, endPoint, createMarkerContent]);

	// ---------------------------------------------------------------------------
	// 轨迹动画（带跟随）
	// ---------------------------------------------------------------------------
	useEffect(() => {
		if (!isMapReady || !mapRef.current || !AMapRef.current) return;

		const AMap = AMapRef.current;
		const map = mapRef.current;

		// 如果轨迹为空，清除所有路径和标记
		if (!trajectories || trajectories.length === 0) {
			if (polylineRef.current) {
				map.remove(polylineRef.current);
				polylineRef.current = null;
			}
			if (carMarkerRef.current) {
				map.remove(carMarkerRef.current);
				carMarkerRef.current = null;
			}
			lastLatestPointRef.current = null;
			currentTrajectoryStartRef.current = null;
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current);
				animationRef.current = null;
			}

			// 如果有起点（发货地点），将地图中心设置为起点
			if (startPoint && !userInteractedRef.current) {
				const startPos: LngLatTuple = [startPoint.longitude, startPoint.latitude];
				map.setZoomAndCenter(followZoom, startPos, false, 500);
			}
			return;
		}

		let path: LngLatTuple[] = [...trajectories].reverse().map((t) => [t.longitude, t.latitude]);

		// 如果存在起点（发货地点），确保路径从起点开始
		if (startPoint && path.length > 0) {
			const pathStartPoint: LngLatTuple = path[0];
			const startPointLngLat: LngLatTuple = [startPoint.longitude, startPoint.latitude];

			// 检查路径的第一个点是否与起点匹配（允许小误差）
			const distance = Math.sqrt(Math.pow(pathStartPoint[0] - startPointLngLat[0], 2) + Math.pow(pathStartPoint[1] - startPointLngLat[1], 2));

			// 如果距离超过0.0001度（约11米），则在路径开头添加起点
			if (distance > 0.0001) {
				path = [startPointLngLat, ...path];
			}
		} else if (startPoint && path.length === 0) {
			// 如果轨迹为空但有起点，至少添加起点
			path = [[startPoint.longitude, startPoint.latitude]];
		}

		const latestPoint = path[path.length - 1];
		const pathStartPoint = path[0]; // 轨迹路径的起点（第一个点）
		const prevLatest = lastLatestPointRef.current;

		// 判断是否是新订单（起点变化）
		const isNewOrder =
			currentTrajectoryStartRef.current === null ||
			currentTrajectoryStartRef.current[0] !== pathStartPoint[0] ||
			currentTrajectoryStartRef.current[1] !== pathStartPoint[1];

		// 如果是新订单，清除旧的轨迹线和标记
		if (isNewOrder) {
			if (polylineRef.current) {
				map.remove(polylineRef.current);
				polylineRef.current = null;
			}
			if (carMarkerRef.current) {
				map.remove(carMarkerRef.current);
				carMarkerRef.current = null;
			}
			lastLatestPointRef.current = null;
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current);
				animationRef.current = null;
			}
			// 更新当前轨迹起点
			currentTrajectoryStartRef.current = pathStartPoint;
		}

		// 创建或更新轨迹线
		if (!polylineRef.current) {
			polylineRef.current = new AMap.Polyline({
				path,
				isOutline: true,
				outlineColor: "#ffeeff",
				borderWeight: 1,
				strokeColor: "#3366FF",
				strokeOpacity: 1,
				strokeWeight: 6,
				strokeStyle: "solid",
				strokeDasharray: [10, 5],
				lineJoin: "round",
				lineCap: "round",
				zIndex: 50,
				map,
			});
		}

		// 创建或更新小车标记
		if (!carMarkerRef.current) {
			carMarkerRef.current = new AMap.Marker({
				position: latestPoint,
				content: createCarContent(0),
				offset: new AMap.Pixel(-20, -20),
				map,
				zIndex: 200,
			});

			// 初始化时设置视角
			if (followCar && !userInteractedRef.current) {
				map.setZoomAndCenter(followZoom, latestPoint, false, 500);
			} else if (polylineRef.current) {
				map.setFitView([polylineRef.current, carMarkerRef.current], false, [50, 50, 50, 50]);
			}

			lastLatestPointRef.current = {
				longitude: latestPoint[0],
				latitude: latestPoint[1],
			};
			return;
		}

		// 检测新点
		const isNewPoint = prevLatest && (prevLatest.longitude !== latestPoint[0] || prevLatest.latitude !== latestPoint[1]);

		if (isNewPoint && prevLatest) {
			if (animationRef.current) cancelAnimationFrame(animationRef.current);

			const startPos = prevLatest;
			const endPos: Coordinate = {
				longitude: latestPoint[0],
				latitude: latestPoint[1],
			};

			const angle = calculateAngle(startPos, endPos);
			carMarkerRef.current.setAngle(90 - angle);

			const duration = 2000;
			let startTime: number | null = null;

			const animate = (timestamp: number) => {
				if (!startTime) startTime = timestamp;
				const progress = Math.min((timestamp - startTime) / duration, 1);
				const ease = easeOutQuad(progress);

				const currentLng = startPos.longitude + (endPos.longitude - startPos.longitude) * ease;
				const currentLat = startPos.latitude + (endPos.latitude - startPos.latitude) * ease;
				const currentPos: LngLatTuple = [currentLng, currentLat];

				carMarkerRef.current?.setPosition(currentPos);
				polylineRef.current?.setPath([...path.slice(0, -1), currentPos]);

				// 跟随小车移动
				if (isFollowing && !userInteractedRef.current) {
					smoothPanTo(currentPos, 100);
				}

				if (progress < 1) {
					animationRef.current = requestAnimationFrame(animate);
				} else {
					carMarkerRef.current?.setPosition(latestPoint);
					polylineRef.current?.setPath(path);
					lastLatestPointRef.current = endPos;

					// 动画结束时确保视角正确
					if (isFollowing && !userInteractedRef.current) {
						smoothPanTo(latestPoint, 300);
					}
				}
			};

			animationRef.current = requestAnimationFrame(animate);
		} else {
			polylineRef.current?.setPath(path);
			carMarkerRef.current?.setPosition(latestPoint);
			lastLatestPointRef.current = {
				longitude: latestPoint[0],
				latitude: latestPoint[1],
			};

			// 更新视角
			if (isFollowing && !userInteractedRef.current) {
				smoothPanTo(latestPoint, 500);
			}
		}
	}, [trajectories, isMapReady, createCarContent, calculateAngle, easeOutQuad, followCar, followZoom, isFollowing, smoothPanTo, startPoint]);

	// ---------------------------------------------------------------------------
	// 渲染
	// ---------------------------------------------------------------------------
	return (
		<div className="w-full h-full relative">
			<div ref={containerRef} className="w-full h-full bg-slate-100" />
			{isSearching && (
				<div className="absolute inset-0 z-[500] bg-white/50 backdrop-blur-sm flex items-center justify-center">
					<Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} tip="正在同步卫星轨迹..." />
				</div>
			)}
		</div>
	);
};

export default OrderMap;
