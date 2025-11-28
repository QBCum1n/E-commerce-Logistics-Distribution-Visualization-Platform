import { useState, useEffect } from "react";
import { Modal, Radio, Button, Typography, Space, Spin } from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";
import { supabase } from "@/lib/supabaseClient";

const { Title, Text } = Typography;

interface LogisticsProvider {
  id: string;
  name: string;
  code: string;
  contact_phone: string;
  average_delivery_time: number;
  is_active: boolean;
}

interface LogisticsProviderModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (providerId: string) => void;
  loading?: boolean;
}

const LogisticsProviderModal: React.FC<LogisticsProviderModalProps> = ({
  open,
  onCancel,
  onConfirm,
  loading = false,
}) => {
  const [providers, setProviders] = useState<LogisticsProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [fetchLoading, setFetchLoading] = useState(false);

  // 获取快递公司列表
  useEffect(() => {
    if (!open) return;

    const fetchProviders = async () => {
      setFetchLoading(true);
      try {
        const { data, error } = await supabase
          .from("logistics_providers")
          .select("*")
          .eq("is_active", true)
          .order("name");

        if (error) throw error;
        setProviders(data || []);
        // 默认选择第一个快递公司
        if (data && data.length > 0) {
          setSelectedProviderId(data[0].id);
        }
      } catch (error) {
        console.error("获取快递公司列表失败:", error);
      } finally {
        setFetchLoading(false);
      }
    };

    fetchProviders();
  }, [open]);

  const handleConfirm = () => {
    if (!selectedProviderId) return;
    onConfirm(selectedProviderId);
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <CheckCircleOutlined className="text-blue-500" />
          <span>选择快递公司</span>
        </div>
      }
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={handleConfirm}
          loading={loading}
          disabled={!selectedProviderId}
        >
          确认发货
        </Button>,
      ]}
      width={600}
      destroyOnClose
    >
      <div className="py-4">
        {fetchLoading ? (
          <div className="flex justify-center py-8">
            <Spin size="large" />
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Text type="secondary">请选择用于配送此订单的快递公司：</Text>
            </div>
            
            <Radio.Group
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              className="w-full"
            >
              <Space direction="vertical" className="w-full">
                {providers.map((provider) => (
                  <Radio
                    key={provider.id}
                    value={provider.id}
                    className="w-full border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <Title level={5} className="!mb-1">
                          {provider.name}
                        </Title>
                        <Text type="secondary" className="text-sm">
                          客服电话：{provider.contact_phone} | 
                          平均配送时间：{provider.average_delivery_time}小时
                        </Text>
                      </div>
                      <div className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">
                        {provider.code}
                      </div>
                    </div>
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
            
            {providers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                暂无可用的快递公司
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default LogisticsProviderModal;