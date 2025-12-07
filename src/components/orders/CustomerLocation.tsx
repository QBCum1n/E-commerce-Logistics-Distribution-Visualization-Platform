import React, { useState, useEffect } from "react";
import { Tooltip } from "antd";
import { supabase } from "@/lib/supabaseClient";
import { parseOrderCoordinate } from "@/pages/user/utils/coordinateParser";

interface CustomerLocationProps {
  orderId: string;
}

const CustomerLocation: React.FC<CustomerLocationProps> = ({ orderId }) => {
  const [location, setLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCustomerLocation = async () => {
      setLoading(true);
      try {
        // 首先尝试从logistics_trajectories表中获取状态为'delivered'的轨迹点
        const { data: trajectoryData, error: trajectoryError } = await supabase
          .from("logistics_trajectories")
          .select("location")
          .eq("order_id", orderId)
          .eq("status", "delivered")
          .limit(1);

        if (trajectoryError) throw trajectoryError;
        
        if (trajectoryData && trajectoryData.length > 0) {
          // location是PostGIS几何对象，格式为 {coordinates: [lng, lat]}
          const coords = trajectoryData[0].location.coordinates;
          setLocation({ lng: coords[0], lat: coords[1] });
          return;
        }

        // 如果没有找到delivered状态的轨迹点，尝试从orders表中获取完整的订单信息
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single();

        if (orderError) throw orderError;
        
        if (orderData) {
          // 使用parseOrderCoordinate工具函数解析客户位置
          const coordinate = parseOrderCoordinate(orderData, "receiver");
          
          if (coordinate) {
            setLocation({ lng: coordinate.longitude, lat: coordinate.latitude });
            return;
          }
          
          // 如果parseOrderCoordinate无法解析，尝试直接解析receiver_location字段
          if (orderData.receiver_location) {
            const locationText = orderData.receiver_location;
            
            // 尝试解析文本格式的位置
            // 假设格式为"经度,纬度"或"纬度,经度"
            const coords: number[] = locationText.split(',').map((coord: string) => parseFloat(coord.trim()));
            
            if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
              // 判断是"经度,纬度"还是"纬度,经度"格式
              // 经度范围通常是-180到180，纬度范围通常是-90到90
              if (Math.abs(coords[0]) <= 180 && Math.abs(coords[1]) <= 90) {
                // 可能是"经度,纬度"格式
                setLocation({ lng: coords[0], lat: coords[1] });
              } else if (Math.abs(coords[1]) <= 180 && Math.abs(coords[0]) <= 90) {
                // 可能是"纬度,经度"格式
                setLocation({ lng: coords[1], lat: coords[0] });
              }
            }
          }
        }
      } catch (error) {
        console.error("获取客户位置失败:", error);
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchCustomerLocation();
    }
  }, [orderId]);

  if (loading) {
    return <span className="text-slate-400 text-xs">加载中...</span>;
  }

  if (!location) {
    return <span className="text-slate-400 text-xs">未设置</span>;
  }

  return (
    <Tooltip title={`经度: ${location.lng}, 纬度: ${location.lat}`} placement="topLeft" className="max-w-xs">
      <span className="text-slate-400 text-xs">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
    </Tooltip>
  );
};

export default CustomerLocation;