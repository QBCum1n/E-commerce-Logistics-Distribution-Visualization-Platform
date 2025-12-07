import { useEffect, useState } from "react";
import { Modal, Descriptions, Table, Tag, Timeline, Card, Divider, Spin, Empty } from "antd";
import { ClockCircleOutlined, EnvironmentOutlined } from "@ant-design/icons";
import { supabase } from "@/lib/supabaseClient";
import type { Order } from "@/types/order"; // 假设你的Order类型定义在这里
import type { LogisticsProvider } from "@/services/logisticsService";
import { getLogisticsProviderById } from "@/services/logisticsService";
import CustomerLocation from "./CustomerLocation";

// 定义子表数据类型
interface OrderItem {
  id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
}

interface LogisticsTrajectory {
  id: string;
  status: string;
  description: string;
  timestamp: string;
  // location 字段是 PostGIS 对象，前端展示通常只需要描述和时间
}

interface OrderDetailModalProps {
  open: boolean;
  onClose: () => void;
  order: Order | null; // 传入当前选中的订单对象
}

const OrderDetailModal = ({ open, onClose, order }: OrderDetailModalProps) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [trajectories, setTrajectories] = useState<LogisticsTrajectory[]>([]);
  const [logisticsProvider, setLogisticsProvider] = useState<LogisticsProvider | null>(null);

  // 状态映射配置（复用列表页的逻辑）
  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: "gold", text: "待处理" },
    confirmed: { color: "blue", text: "已确认" },
    shipping: { color: "cyan", text: "配送中" },
    delivered: { color: "green", text: "已送达" },
    cancelled: { color: "default", text: "已取消" },
  };

  // 当模态框打开且有 orderId 时，获取详情数据
  useEffect(() => {
    if (open && order?.id) {
      fetchDetails(order.id);
      // 如果订单有物流公司ID，获取物流公司信息
      if (order.logistics_provider_id) {
        fetchLogisticsProvider(order.logistics_provider_id);
      } else {
        setLogisticsProvider(null);
      }
    } else {
      // 关闭时清空数据
      setItems([]);
      setTrajectories([]);
      setLogisticsProvider(null);
    }
  }, [open, order]);

  const fetchDetails = async (orderId: string) => {
    setLoading(true);
    try {
      // 并行请求：商品列表 和 物流轨迹
      const [itemsResult, logisticsResult] = await Promise.all([
        supabase.from("order_items").select("*").eq("order_id", orderId),
        supabase
          .from("logistics_trajectories")
          .select("*")
          .eq("order_id", orderId)
          .order("timestamp", { ascending: false }), // 最新物流在最前
      ]);

      if (itemsResult.error) throw itemsResult.error;
      if (logisticsResult.error) throw logisticsResult.error;

      setItems(itemsResult.data || []);
      setTrajectories(logisticsResult.data || []);
    } catch (error) {
      console.error("加载详情失败:", error);
    } finally {
      setLoading(false);
    }
  };

  // 获取物流公司信息
  const fetchLogisticsProvider = async (providerId: string) => {
    try {
      const provider = await getLogisticsProviderById(providerId);
      setLogisticsProvider(provider);
    } catch (error) {
      console.error("获取物流公司信息失败:", error);
      setLogisticsProvider(null);
    }
  };

  // 商品表列定义
  const itemColumns = [
    {
      title: "商品名称",
      dataIndex: "product_name",
      key: "product_name",
    },
    {
      title: "单价",
      dataIndex: "product_price",
      key: "product_price",
      render: (val: number) => `¥${val.toFixed(2)}`,
    },
    {
      title: "数量",
      dataIndex: "quantity",
      key: "quantity",
    },
    {
      title: "小计",
      dataIndex: "subtotal",
      key: "subtotal",
      align: "right" as const,
      render: (val: number) => <span className="font-medium">¥{val.toFixed(2)}</span>,
    },
  ];

  // 渲染模态框内容
  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <span>订单详情</span>
          {order && (
            <Tag color={statusMap[order.status]?.color}>
              {statusMap[order.status]?.text || order.status}
            </Tag>
          )}
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null} // 详情页通常不需要底部确认按钮
      width={800}
      centered
    >
      {loading ? (
        <div className="flex h-60 items-center justify-center">
          <Spin tip="加载详情数据..." />
        </div>
      ) : order ? (
        <div className="space-y-6 py-2">
          {/* 1. 基础信息与客户信息 */}
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="订单号">{order.order_number}</Descriptions.Item>
            <Descriptions.Item label="下单时间">
              {new Date(order.created_at).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="客户姓名">{order.customer_name}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{order.customer_phone}</Descriptions.Item>
            <Descriptions.Item label="收货地址" span={2}>
              <div className="space-y-2">
                <div>{order.customer_address || "未填写"}</div>
                <div className="text-xs text-slate-500">
                  <span className="font-medium">坐标位置：</span>
                  <CustomerLocation orderId={order.id} />
                </div>
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="快递公司">
              {logisticsProvider ? logisticsProvider.name : (order.logistics_provider_id ? "加载中..." : "未指定")}
            </Descriptions.Item>
            <Descriptions.Item label="配送距离">
              {order.delivery_distance ? `${order.delivery_distance.toFixed(2)} 公里` : "未计算"}
            </Descriptions.Item>
            <Descriptions.Item label="最大配送时间">
              {order.limited_delivery_time ? `${order.limited_delivery_time} 小时` : "未设置"}
            </Descriptions.Item>
            <Descriptions.Item label="订单总额">
              <span className="text-lg font-bold text-red-500">
                ¥{Number(order.total_amount).toFixed(2)}
              </span>
            </Descriptions.Item>
          </Descriptions>

          {/* 2. 商品列表 */}
          <div>
            <h3 className="mb-3 text-base font-medium text-slate-700">商品清单</h3>
            <Table
              dataSource={items}
              columns={itemColumns}
              rowKey="id"
              pagination={false}
              size="small"
              bordered
            />
          </div>


          {/* 3. 物流轨迹 */}
          {(order.status === "shipping" || order.status === "delivered") && (
            <div>
              <Divider orientation="left" className="!text-sm !text-slate-500">物流动态</Divider>
              <Card size="small" className="bg-slate-50">
                {trajectories.length > 0 ? (
                  <Timeline
                    mode="left"
                    items={trajectories.map((t, index) => ({
                      color: index === 0 ? "green" : "blue", // 最新一条用绿色
                      dot: index === 0 ? <EnvironmentOutlined /> : <ClockCircleOutlined />,
                      children: (
                        <>
                          <div className="font-medium">{t.status} - {t.description}</div>
                          <div className="text-xs text-slate-400">
                            {new Date(t.timestamp).toLocaleString()}
                          </div>
                        </>
                      ),
                    }))}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无物流信息" />
                )}
              </Card>
            </div>
          )}
        </div>
      ) : (
        <Empty description="未找到订单信息" />
      )}
    </Modal>
  );
};

export default OrderDetailModal;