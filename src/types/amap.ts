// src/types/amap.ts
// 高德地图 JSAPI 2.0 类型定义 - 基于 @amap/amap-jsapi-loader 推导

import type AMapLoader from "@amap/amap-jsapi-loader";

// =============================================================================
// 核心类型推导 (从 AMapLoader 推导)
// =============================================================================

/** 高德地图 SDK 类型 */
export type AMapSDK = Awaited<ReturnType<typeof AMapLoader.load>>;

/** 地图实例类型 */
export type AMapMapInstance = InstanceType<AMapSDK["Map"]>;

/** 标记点实例类型 */
export type AMapMarker = InstanceType<AMapSDK["Marker"]>;

/** 折线实例类型 */
export type AMapPolyline = InstanceType<AMapSDK["Polyline"]>;

/** 驾车路线规划实例类型（简化） */
export interface AMapDriving {
  search(
    origin: LngLatTuple | AMapLngLat | Coordinate,
    destination: LngLatTuple | AMapLngLat | Coordinate,
    callback: (
      status: "complete" | "error" | string,
      result: {
        info?: string;
        routes?: Array<{
          steps?: Array<{
            path?: AMapLngLat[];
          }>;
        }>;
      }
    ) => void
  ): void;
  clear(): void;
}

/** 多边形实例类型 */
export type AMapPolygon = InstanceType<AMapSDK["Polygon"]>;

/** 圆形实例类型 */
export type AMapCircle = InstanceType<AMapSDK["Circle"]>;

/** 信息窗体实例类型 */
export type AMapInfoWindow = InstanceType<AMapSDK["InfoWindow"]>;

/** 像素类型 */
export type AMapPixel = InstanceType<AMapSDK["Pixel"]>;

/** 经纬度类型 */
export type AMapLngLat = InstanceType<AMapSDK["LngLat"]>;

/** 尺寸类型 */
export type AMapSize = InstanceType<AMapSDK["Size"]>;

// =============================================================================
// 插件类型 (需要单独声明，因为是动态加载的)
// =============================================================================

/** 定位插件实例 */
export interface AMapGeolocation {
  getCurrentPosition(callback: GeolocationCallback): void;
  watchPosition(): string;
  clearWatch(watchId: string): void;
}

/** 比例尺插件实例 */
export interface AMapScale {
  show(): void;
  hide(): void;
}

/** 工具条插件实例 */
export interface AMapToolBar {
  show(): void;
  hide(): void;
}

// =============================================================================
// 事件类型
// =============================================================================

/** 经纬度接口 (用于事件回调) */
export interface LngLatLike {
  getLng(): number;
  getLat(): number;
}

/** 像素接口 */
export interface PixelLike {
  getX(): number;
  getY(): number;
}

/** 鼠标事件 */
export interface AMapMouseEvent {
  type: string;
  lnglat: LngLatLike;
  pixel: PixelLike;
  target: unknown;
  stopPropagation(): void;
  preventDefault?(): void;
}

/** 定位结果 - 成功 */
export interface GeolocationResult {
  position: LngLatLike;
  accuracy: number;
  location_type: "ip" | "html5" | "sdk";
  message: string;
  isConverted: boolean;
  info: string;
  addressComponent?: {
    city: string;
    district: string;
    province: string;
    street: string;
    streetNumber: string;
    township: string;
  };
  formattedAddress?: string;
}

/** 定位结果 - 失败 */
export interface GeolocationError {
  info: string;
  message: string;
}

/** 定位回调函数 */
export type GeolocationCallback = (
  status: "complete" | "error",
  result: GeolocationResult | GeolocationError
) => void;

// =============================================================================
// 配置选项类型
// =============================================================================

/** 经纬度元组 */
export type LngLatTuple = [number, number];

/** 边界范围 */
export type BoundsArray = [number, number, number, number];

/** 地图配置 */
export interface MapOptions {
  viewMode?: "2D" | "3D";
  zoom?: number;
  zooms?: [number, number];
  center?: LngLatTuple;
  mapStyle?: string;
  features?: ("bg" | "road" | "building" | "point")[];
  pitch?: number;
  rotation?: number;
  showLabel?: boolean;
  defaultCursor?: string;
  isHotspot?: boolean;
  resizeEnable?: boolean;
  dragEnable?: boolean;
  zoomEnable?: boolean;
  doubleClickZoom?: boolean;
  keyboardEnable?: boolean;
  scrollWheel?: boolean;
  touchZoom?: boolean;
  animateEnable?: boolean;
}

/** 标记点配置 */
export interface MarkerOptions {
  position?: LngLatTuple | LngLatLike;
  anchor?:
    | "top-left"
    | "top-center"
    | "top-right"
    | "middle-left"
    | "center"
    | "middle-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";
  offset?: AMapPixel;
  icon?: string;
  content?: string | HTMLElement;
  title?: string;
  visible?: boolean;
  zIndex?: number;
  angle?: number;
  clickable?: boolean;
  draggable?: boolean;
  cursor?: string;
  extData?: unknown;
  map?: AMapMapInstance;
}

/** 折线配置 */
export interface PolylineOptions {
  path?: LngLatTuple[];
  zIndex?: number;
  bubble?: boolean;
  geodesic?: boolean;
  isOutline?: boolean;
  borderWeight?: number;
  outlineColor?: string;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  strokeStyle?: "solid" | "dashed";
  strokeDasharray?: [number, number];
  lineJoin?: "miter" | "round" | "bevel";
  lineCap?: "butt" | "round" | "square";
  showDir?: boolean;
  extData?: unknown;
  map?: AMapMapInstance;
}

/** 定位配置 */
export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  showButton?: boolean;
  buttonPosition?: "LT" | "RT" | "LB" | "RB";
  buttonOffset?: AMapPixel;
  showMarker?: boolean;
  showCircle?: boolean;
  panToLocation?: boolean;
  zoomToAccuracy?: boolean;
  needAddress?: boolean;
  extensions?: "base" | "all";
  // 兼容性参数
  position?: string;
}

/** 工具条配置 */
export interface ToolBarOptions {
  position?:
    | "LT"
    | "RT"
    | "LB"
    | "RB"
    | { top?: string; left?: string; right?: string; bottom?: string };
  offset?: AMapPixel;
  liteStyle?: boolean;
}

/** 比例尺配置 */
export interface ScaleOptions {
  position?:
    | "LT"
    | "RT"
    | "LB"
    | "RB"
    | { top?: string; left?: string; right?: string; bottom?: string };
  offset?: AMapPixel;
}

// =============================================================================
// 扩展 SDK 类型 (添加插件构造函数)
// =============================================================================

/** 带插件的 AMap SDK 类型 */
export interface AMapSDKWithPlugins extends AMapSDK {
  Geolocation: new (opts?: GeolocationOptions) => AMapGeolocation;
  Scale: new (opts?: ScaleOptions) => AMapScale;
  ToolBar: new (opts?: ToolBarOptions) => AMapToolBar;
  Driving: new (opts?: Record<string, unknown>) => AMapDriving;
  DrivingPolicy?: {
    LEAST_TIME?: number;
    LEAST_FEE?: number;
    LEAST_DISTANCE?: number;
    REAL_TRAFFIC?: number;
  };
}

// =============================================================================
// 业务辅助类型
// =============================================================================

/** 坐标点 */
export interface Coordinate {
  longitude: number;
  latitude: number;
}

/** 轨迹点 */
export interface TrajectoryPoint extends Coordinate {
  id?: string;
  order_id?: string;
  location?: { coordinates?: [number, number] } | string;
  timestamp?: string;
  status?: string;
  description?: string;
}

/** 地图组件 Props */
export interface OrderMapProps {
  /** 轨迹点数组 (按时间倒序排列：最新的在 index 0) */
  trajectories: TrajectoryPoint[];
  /** 发货点 */
  startPoint?: Coordinate;
  /** 收货点 */
  endPoint?: Coordinate;
  /** 是否正在搜索/加载 */
  isSearching?: boolean;
  /** 地图初始化完成回调 */
  onMapReady?: (map: AMapMapInstance) => void;
  /** 地图点击回调 */
  onMapClick?: (lnglat: Coordinate) => void;
}

// =============================================================================
// 类型守卫
// =============================================================================

/** 判断定位结果是否成功 */
export const isGeolocationSuccess = (
  result: GeolocationResult | GeolocationError
): result is GeolocationResult => {
  return "position" in result;
};

/** 判断是否有有效坐标 */
export const isValidCoordinate = (coord: unknown): coord is Coordinate => {
  if (!coord || typeof coord !== "object") return false;
  const c = coord as Record<string, unknown>;
  return (
    typeof c.longitude === "number" &&
    typeof c.latitude === "number" &&
    !isNaN(c.longitude) &&
    !isNaN(c.latitude)
  );
};

// 确保这是一个模块
export {};