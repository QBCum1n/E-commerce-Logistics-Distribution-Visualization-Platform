import { useEffect, useRef, useState, useCallback, memo } from "react";
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
	AMapDriving,
	AMapLngLat,
	TrajectoryPoint,
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
// 类型定义
// -----------------------------------------------------------------------------
interface ExtendedOrderMapProps extends OrderMapProps {
	followCar?: boolean;
	followZoom?: number;
}

interface SimpleLngLat {
	lng: number;
	lat: number;
}

type PathPoint = AMapLngLat | SimpleLngLat | [number, number];

// 动画任务
interface AnimationTask {
	id: string;
	fromCoord: Coordinate;
	toCoord: Coordinate;
	pathSegment: LngLatTuple[]; // 这一段的规划路径
}

// -----------------------------------------------------------------------------
// 工具函数
// -----------------------------------------------------------------------------
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getDistanceMeters = (a: LngLatTuple, b: LngLatTuple): number => {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const R = 6371000;
	const dLat = toRad(b[1] - a[1]);
	const dLng = toRad(b[0] - a[0]);
	const lat1 = toRad(a[1]);
	const lat2 = toRad(b[1]);
	const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
	return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const toLngLatTuple = (p: PathPoint): LngLatTuple => {
	if (Array.isArray(p)) {
		return p as LngLatTuple;
	}
	if ("getLng" in p && typeof p.getLng === "function") {
		return [p.getLng(), p.getLat()];
	}
	if ("lng" in p && "lat" in p) {
		return [p.lng, p.lat];
	}
	return [0, 0];
};



const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);

const coordToTuple = (coord: Coordinate): LngLatTuple => [coord.longitude, coord.latitude];
const tupleToCoord = (tuple: LngLatTuple): Coordinate => ({ longitude: tuple[0], latitude: tuple[1] });

const isSameCoord = (a: Coordinate | null, b: Coordinate | null, threshold = 0.00001): boolean => {
	if (!a || !b) return false;
	return Math.abs(a.longitude - b.longitude) < threshold && Math.abs(a.latitude - b.latitude) < threshold;
};

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
	// Refs - 地图相关
	const mapRef = useRef<AMapMapInstance | null>(null);
	const carMarkerRef = useRef<AMapMarker | null>(null);
	const polylineRef = useRef<AMapPolyline | null>(null);
	const startMarkerRef = useRef<AMapMarker | null>(null);
	const endMarkerRef = useRef<AMapMarker | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const AMapRef = useRef<AMapSDKWithPlugins | null>(null);
	const drivingRef = useRef<AMapDriving | null>(null);

	// Refs - 动画队列相关
	const animationQueueRef = useRef<AnimationTask[]>([]);
	const isAnimatingRef = useRef(false);
	const animationFrameRef = useRef<number | null>(null);
	const currentCarPositionRef = useRef<Coordinate | null>(null);
	const completedPathRef = useRef<LngLatTuple[]>([]); // 已完成动画的路径

	// Refs - 轨迹处理相关
	const processedTrajectoriesRef = useRef<Set<string>>(new Set()); // 已处理的轨迹点ID
	const segmentCacheRef = useRef<Map<string, LngLatTuple[]>>(new Map()); // 单段路径缓存
	const currentOrderStartRef = useRef<LngLatTuple | null>(null);

	// Refs - 用户交互
	const userInteractedRef = useRef(false);
	const resumeFollowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// State
	const [isMapReady, setIsMapReady] = useState(false);
	const [isFollowing, setIsFollowing] = useState(followCar);
	const [isPlanning, setIsPlanning] = useState(false);
	const [pendingSegments, setPendingSegments] = useState(0);

	// ---------------------------------------------------------------------------
	// Marker 内容生成
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

	const createCarContent = useCallback((): string => {
		return `
			<div class="relative w-12 h-12 flex items-center justify-center">
				<img 
					src="https://cdn-icons-png.flaticon.com/512/685/685388.png" 
					class="w-10 h-10 drop-shadow-lg"
					alt="package"
				/>
			</div>
		`;
	}, []);

	// ---------------------------------------------------------------------------
	// 驾车规划实例
	// ---------------------------------------------------------------------------
	const ensureDrivingInstance = useCallback(() => {
		if (!AMapRef.current || !mapRef.current) return null;
		if (!drivingRef.current) {
			const Driving = AMapRef.current.Driving;
			if (!Driving) return null;
			drivingRef.current = new Driving({
				policy: AMapRef.current.DrivingPolicy?.LEAST_DISTANCE,
				showTraffic: false,
				hideMarkers: true,
			});
		}
		return drivingRef.current;
	}, []);

	// ---------------------------------------------------------------------------
	// 单段路径规划（带缓存）
	// ---------------------------------------------------------------------------
	const planSegment = useCallback(
		async (origin: LngLatTuple, destination: LngLatTuple): Promise<LngLatTuple[]> => {
			// 生成缓存键
			const cacheKey = `${origin[0].toFixed(6)},${origin[1].toFixed(6)}|${destination[0].toFixed(6)},${destination[1].toFixed(6)}`;

			// 检查缓存
			if (segmentCacheRef.current.has(cacheKey)) {
				return segmentCacheRef.current.get(cacheKey)!;
			}

			const driving = ensureDrivingInstance();
			if (!driving) {
				return [origin, destination];
			}

			// 最多重试2次
			for (let attempt = 0; attempt < 3; attempt++) {
				try {
					const result = await new Promise<LngLatTuple[]>((resolve, reject) => {
						const timeoutId = setTimeout(() => reject(new Error("TIMEOUT")), 5000);

						driving.search(origin, destination, (status, result) => {
							clearTimeout(timeoutId);

							if (status === "complete" && result?.routes?.[0]?.steps?.length) {
								const segment = result.routes![0].steps!.flatMap((step) => {
									return (step.path || []).map((point: PathPoint) => toLngLatTuple(point));
								});
								resolve(segment.length > 0 ? segment : [origin, destination]);
							} else {
								reject(new Error("SEARCH_FAILED"));
							}
						});
					});

					// 缓存结果
					segmentCacheRef.current.set(cacheKey, result);

					// 限制缓存大小
					if (segmentCacheRef.current.size > 50) {
						const firstKey = segmentCacheRef.current.keys().next().value;
						if (firstKey) {
							segmentCacheRef.current.delete(firstKey);
						}
					}

					return result;
				} catch (error) {
					console.warn(`路径规划失败 (尝试 ${attempt + 1}/3):`, error);
					if (attempt < 2) {
						await delay(300 * (attempt + 1));
					}
				}
			}

			// 全部失败，返回直线
			const fallback = [origin, destination];
			segmentCacheRef.current.set(cacheKey, fallback);
			return fallback;
		},
		[ensureDrivingInstance]
	);

	// ---------------------------------------------------------------------------
	// 平滑移动地图
	// ---------------------------------------------------------------------------
	const smoothPanTo = useCallback((position: LngLatTuple) => {
		if (!mapRef.current || userInteractedRef.current) return;
		mapRef.current.panTo(position, 100);
	}, []);

	// ---------------------------------------------------------------------------
	// 恢复跟随
	// ---------------------------------------------------------------------------
	const resumeFollowing = useCallback(() => {
		userInteractedRef.current = false;
		setIsFollowing(true);

		if (currentCarPositionRef.current && mapRef.current) {
			const pos = coordToTuple(currentCarPositionRef.current);
			mapRef.current.setZoomAndCenter(followZoom, pos, false, 500);
		}
	}, [followZoom]);

	// ---------------------------------------------------------------------------
	// 更新轨迹线显示
	// ---------------------------------------------------------------------------
	const updatePolyline = useCallback((path: LngLatTuple[]) => {
		const map = mapRef.current;
		const AMap = AMapRef.current;
		if (!map || !AMap || path.length < 2) return;

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
		} else {
			polylineRef.current.setPath(path);
		}
	}, []);

	// ---------------------------------------------------------------------------
	// 执行单个动画任务
	// ---------------------------------------------------------------------------
	const executeAnimationTask = useCallback(
		(task: AnimationTask): Promise<void> => {
			return new Promise((resolve) => {
				const car = carMarkerRef.current;
				if (!car) {
					resolve();
					return;
				}

				const { fromCoord, toCoord, pathSegment } = task;

				// 计算动画时长
				const distance = getDistanceMeters(coordToTuple(fromCoord), coordToTuple(toCoord));
				const duration = Math.min(3000, Math.max(500, distance * 2));

				let startTime: number | null = null;

				const animate = (timestamp: number) => {
					if (!startTime) startTime = timestamp;
					const elapsed = timestamp - startTime;
					const progress = Math.min(elapsed / duration, 1);
					const ease = easeOutQuad(progress);

					// 沿着规划路径移动
					const totalLength = pathSegment.length - 1;
					const currentIndex = Math.floor(ease * totalLength);
					const localProgress = (ease * totalLength) % 1;

					let currentPos: LngLatTuple;

					if (currentIndex >= totalLength) {
						currentPos = pathSegment[totalLength];
						// 最后一个点，使用最后一段的方向
						
					} else {
						const p1 = pathSegment[currentIndex];
						const p2 = pathSegment[currentIndex + 1];
						currentPos = [p1[0] + (p2[0] - p1[0]) * localProgress, p1[1] + (p2[1] - p1[1]) * localProgress];
						
					}

					car.setPosition(currentPos);
					currentCarPositionRef.current = tupleToCoord(currentPos);

					// 更新轨迹线
					const walkedPath = [...completedPathRef.current, ...pathSegment.slice(0, currentIndex + 1), currentPos];
					updatePolyline(walkedPath);

					// 跟随移动
					if (isFollowing && !userInteractedRef.current) {
						smoothPanTo(currentPos);
					}

					if (progress < 1) {
						animationFrameRef.current = requestAnimationFrame(animate);
					} else {
						// 动画完成
						const finalPos = pathSegment[pathSegment.length - 1];
						car.setPosition(finalPos);
						currentCarPositionRef.current = tupleToCoord(finalPos);

						// 更新已完成路径
						if (completedPathRef.current.length > 0) {
							completedPathRef.current.push(...pathSegment.slice(1));
						} else {
							completedPathRef.current.push(...pathSegment);
						}

						updatePolyline(completedPathRef.current);
						animationFrameRef.current = null;
						resolve();
					}
				};

				animationFrameRef.current = requestAnimationFrame(animate);
			});
		},
		[isFollowing, smoothPanTo, updatePolyline]
	);

	// ---------------------------------------------------------------------------
	// 处理动画队列
	// ---------------------------------------------------------------------------
	const processAnimationQueue = useCallback(async () => {
		if (isAnimatingRef.current) return;
		if (animationQueueRef.current.length === 0) {
			setIsPlanning(false); // 队列为空时关闭
			return;
		}

		isAnimatingRef.current = true;

		while (animationQueueRef.current.length > 0) {
			const task = animationQueueRef.current.shift()!;
			console.log(`执行动画任务: ${task.id}`);
			await executeAnimationTask(task);
		}

		isAnimatingRef.current = false;
		setIsPlanning(false); // 队列处理完毕后关闭
	}, [executeAnimationTask]);

	// ---------------------------------------------------------------------------
	// 添加新的动画任务
	// ---------------------------------------------------------------------------
	const addAnimationTask = useCallback(
		async (trajectoryPoint: TrajectoryPoint, previousCoord: Coordinate) => {
			const taskId = trajectoryPoint.id || `${trajectoryPoint.longitude},${trajectoryPoint.latitude}`;

			// 检查是否已处理
			if (processedTrajectoriesRef.current.has(taskId)) {
				return;
			}

			const toCoord: Coordinate = {
				longitude: trajectoryPoint.longitude,
				latitude: trajectoryPoint.latitude,
			};

			// 如果位置相同，跳过
			if (isSameCoord(previousCoord, toCoord)) {
				processedTrajectoriesRef.current.add(taskId);
				return;
			}

			console.log(`规划路径段: ${taskId}`);
			setPendingSegments((prev) => prev + 1);
			setIsPlanning(true);

			try {
				// 规划这一段路径
				const pathSegment = await planSegment(coordToTuple(previousCoord), coordToTuple(toCoord));

				// 标记为已处理
				processedTrajectoriesRef.current.add(taskId);

				// 创建动画任务
				const task: AnimationTask = {
					id: taskId,
					fromCoord: previousCoord,
					toCoord,
					pathSegment,
				};

				// 添加到队列
				animationQueueRef.current.push(task);

				// 触发队列处理
				processAnimationQueue();
			} catch (error) {
				console.error("添加动画任务失败:", error);
			} finally {
				setPendingSegments((prev) => Math.max(0, prev - 1));
				// 删除这里的 setIsPlanning(false)
				// 让 processAnimationQueue 来控制
			}
		},
		[planSegment, processAnimationQueue]
	);

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
					plugins: ["AMap.Geolocation", "AMap.ToolBar", "AMap.Scale", "AMap.Driving"],
				})) as AMapSDKWithPlugins;

				if (!isMounted || !containerRef.current) return;

				AMapRef.current = AMapModule;

				const map = new AMapModule.Map(containerRef.current, {
					viewMode: "2D",
					zoom: 11,
					center: [116.397428, 39.90923],
				});

				// 初始化驾车路线规划
				try {
					if (AMapModule.Driving) {
						drivingRef.current = new AMapModule.Driving({
							policy: AMapModule.DrivingPolicy?.LEAST_DISTANCE,
							showTraffic: false,
							hideMarkers: true,
						});
					}
				} catch (err) {
					console.warn("初始化驾车规划失败:", err);
				}

				// 添加控件
				map.addControl(new AMapModule.Scale({ position: "LB" }));
				map.addControl(
					new AMapModule.ToolBar({
						position: { bottom: "55px", right: "17px" },
						liteStyle: true,
					})
				);

				// 监听用户交互
				map.on("dragstart", () => {
					userInteractedRef.current = true;
					setIsFollowing(false);

					if (resumeFollowTimerRef.current) {
						clearTimeout(resumeFollowTimerRef.current);
					}

					if (followCar) {
						resumeFollowTimerRef.current = setTimeout(resumeFollowing, 5000);
					}
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
				console.error("地图加载失败:", error);
			}
		};

		initMap();

		return () => {
			isMounted = false;
			if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
			if (resumeFollowTimerRef.current) clearTimeout(resumeFollowTimerRef.current);
			segmentCacheRef.current.clear();
			mapRef.current?.destroy();
		};
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
	// 处理轨迹更新
	// ---------------------------------------------------------------------------
	useEffect(() => {
		const map = mapRef.current;
		const AMap = AMapRef.current;
		if (!isMapReady || !map || !AMap) return;

		// 没有轨迹时清理
		if (!trajectories || trajectories.length === 0) {
			// 清理所有状态
			if (polylineRef.current) {
				map.remove(polylineRef.current);
				polylineRef.current = null;
			}
			if (carMarkerRef.current) {
				map.remove(carMarkerRef.current);
				carMarkerRef.current = null;
			}
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
				animationFrameRef.current = null;
			}

			animationQueueRef.current = [];
			isAnimatingRef.current = false;
			currentCarPositionRef.current = null;
			completedPathRef.current = [];
			processedTrajectoriesRef.current.clear();
			segmentCacheRef.current.clear();
			currentOrderStartRef.current = null;

			if (startPoint && !userInteractedRef.current) {
				map.setZoomAndCenter(followZoom, [startPoint.longitude, startPoint.latitude], false, 500);
			}
			return;
		}

		// 按时间正序排列
		const sortedTrajectories = [...trajectories].sort((a, b) => {
			const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
			const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
			return timeA - timeB;
		});

		// 检测是否是新订单（起点变化）
		const firstPoint: LngLatTuple = [sortedTrajectories[0].longitude, sortedTrajectories[0].latitude];
		const isNewOrder = currentOrderStartRef.current === null || getDistanceMeters(currentOrderStartRef.current, firstPoint) > 100;

		if (isNewOrder) {
			console.log("检测到新订单，重置状态");

			// 清理旧数据
			if (polylineRef.current) {
				map.remove(polylineRef.current);
				polylineRef.current = null;
			}
			if (carMarkerRef.current) {
				map.remove(carMarkerRef.current);
				carMarkerRef.current = null;
			}
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
				animationFrameRef.current = null;
			}

			animationQueueRef.current = [];
			isAnimatingRef.current = false;
			completedPathRef.current = [];
			processedTrajectoriesRef.current.clear();
			currentOrderStartRef.current = firstPoint;

			// 设置初始位置
			const initialCoord: Coordinate = {
				longitude: firstPoint[0],
				latitude: firstPoint[1],
			};

			// 如果有起点且与第一个轨迹点不同，使用起点
			if (startPoint && getDistanceMeters([startPoint.longitude, startPoint.latitude], firstPoint) > 10) {
				currentCarPositionRef.current = startPoint;
				completedPathRef.current = [[startPoint.longitude, startPoint.latitude]];
			} else {
				currentCarPositionRef.current = initialCoord;
				completedPathRef.current = [firstPoint];
			}

			// 创建小车
			carMarkerRef.current = new AMap.Marker({
				position: coordToTuple(currentCarPositionRef.current),
				content: createCarContent(),
				offset: new AMap.Pixel(-20, -20),
				map,
				zIndex: 200,
			});

			// 初始视角
			if (followCar && !userInteractedRef.current) {
				map.setZoomAndCenter(followZoom, coordToTuple(currentCarPositionRef.current), false, 500);
			}
		}

		// 处理每个轨迹点
		const processTrajectories = async () => {
			for (const trajectory of sortedTrajectories) {
				const taskId = trajectory.id || `${trajectory.longitude},${trajectory.latitude}`;

				// 跳过已处理的
				if (processedTrajectoriesRef.current.has(taskId)) {
					continue;
				}

				// 获取当前位置作为起点
				const fromCoord = currentCarPositionRef.current;
				if (!fromCoord) {
					// 没有当前位置，直接设置
					currentCarPositionRef.current = {
						longitude: trajectory.longitude,
						latitude: trajectory.latitude,
					};
					processedTrajectoriesRef.current.add(taskId);
					continue;
				}

				// 添加动画任务
				await addAnimationTask(trajectory, fromCoord);

				// 更新当前位置（即使动画还没执行，也要更新引用位置）
				currentCarPositionRef.current = {
					longitude: trajectory.longitude,
					latitude: trajectory.latitude,
				};
			}
		};

		processTrajectories();
	}, [trajectories, isMapReady, startPoint, followCar, followZoom, createCarContent, addAnimationTask]);

	// ---------------------------------------------------------------------------
	// 跟随状态变化时更新视角
	// ---------------------------------------------------------------------------
	useEffect(() => {
		if (!currentCarPositionRef.current || !mapRef.current) return;
		if (!isFollowing || userInteractedRef.current) return;

		const pos = coordToTuple(currentCarPositionRef.current);
		mapRef.current.setZoomAndCenter(followZoom, pos, false, 500);
	}, [isFollowing, followZoom]);

	// ---------------------------------------------------------------------------
	// 渲染
	// ---------------------------------------------------------------------------
	return (
		<div className="w-full h-full relative">
			<div ref={containerRef} className="w-full h-full bg-slate-100" />

			{/* 搜索中 */}
			{isSearching && (
				<div className="absolute inset-0 z-[500] bg-white/50 backdrop-blur-sm flex items-center justify-center">
					<Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} tip="正在同步卫星轨迹..." />
				</div>
			)}

			{/* 路径规划中 */}
			{isPlanning && (
				<div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg">
					<div className="flex items-center gap-2">
						<LoadingOutlined spin />
						<span className="text-sm">正在规划路径...{pendingSegments > 0 && ` (${pendingSegments}段待处理)`}</span>
					</div>
				</div>
			)}
		</div>
	);
};

export default memo(OrderMap, (prevProps, nextProps) => {
	return (
		JSON.stringify(prevProps.trajectories) === JSON.stringify(nextProps.trajectories) &&
		JSON.stringify(prevProps.startPoint) === JSON.stringify(nextProps.startPoint) &&
		JSON.stringify(prevProps.endPoint) === JSON.stringify(nextProps.endPoint) &&
		prevProps.isSearching === nextProps.isSearching &&
		prevProps.followCar === nextProps.followCar &&
		prevProps.followZoom === nextProps.followZoom
	);
});
