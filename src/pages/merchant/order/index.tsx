import type { RadioChangeEvent } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { FilterValue, SorterResult } from "antd/es/table/interface";
import type { PostgrestError } from "@supabase/supabase-js";
import type { Order, OrderQueryParams } from "@/types/order";
import { useState, useEffect, useCallback } from "react";
import { Table, Card, Radio, Input, Button, Typography, Space, Popconfirm, Divider, ConfigProvider, Tooltip } from "antd";
import { ReloadOutlined, SearchOutlined, CheckCircleOutlined, ExclamationCircleOutlined, DeleteOutlined } from "@ant-design/icons";
import { supabase } from "@/lib/supabaseClient";
import { useToastMessage } from "@/hooks/useToastMessage";
import OrderDetailModal from "../../../components/orders/order-detail-modal";
import DeleteModal from "../../../components/orders/delete-modal";
import LogisticsProviderModal from "../../../components/orders/logistics-provider-modal";
import { updateOrderLogisticsProvider } from "@/services/logisticsService";

// -----------------------------------------------------------------------------
// 样式工具
// -----------------------------------------------------------------------------
const getStatusStyle = (status: string) => {
	const map: Record<string, string> = {
		pending: "bg-amber-50 text-amber-600 border-amber-100",
		confirmed: "bg-indigo-50 text-indigo-600 border-indigo-100",
		shipping: "bg-sky-50 text-sky-600 border-sky-100",
		delivered: "bg-emerald-50 text-emerald-600 border-emerald-100",
		cancelled: "bg-slate-100 text-slate-500 border-slate-200",
	};
	const base =
		"px-2.5 py-1 rounded-md text-xs font-medium border transition-all duration-300 cursor-default hover:shadow-sm hover:scale-105 select-none";
	const specific = map[status] || "bg-gray-50 text-gray-500 border-gray-200";
	const textMap: Record<string, string> = {
		pending: "待处理",
		confirmed: "已确认",
		shipping: "配送中",
		delivered: "已送达",
		cancelled: "已取消",
	};
	return <span className={`${base} ${specific}`}>{textMap[status] || status}</span>;
};

const OrderList = () => {
	const [loading, setLoading] = useState(false);
	const [data, setData] = useState<Order[]>([]);
	const [total, setTotal] = useState(0);
	const [searchValue, setSearchValue] = useState("");
	const [detailModalOpen, setDetailModalOpen] = useState(false);
	const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

	// 2. 状态管理新增
	const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
	const [batchDeleteModalOpen, setBatchDeleteModalOpen] = useState(false);
	const [batchLoading, setBatchLoading] = useState(false);

	// 快递公司选择相关状态
	const [logisticsModalOpen, setLogisticsModalOpen] = useState(false);
	const [selectedOrderId, setSelectedOrderId] = useState<string>("");
	const [shipLoading, setShipLoading] = useState(false);

	const { toastMessage, contextHolder } = useToastMessage();

	const [queryParams, setQueryParams] = useState<OrderQueryParams>({
		page: 1,
		pageSize: 10,
		status: "ALL",
		searchText: "",
		sortField: "created_at",
		sortOrder: "desc",
	});

	const fetchOrders = useCallback(async () => {
		setLoading(true);
		try {
			let query = supabase.from("orders").select("*", { count: "exact" });

			if (queryParams.status !== "ALL") {
				query = query.eq("status", queryParams.status);
			}
			if (queryParams.searchText) {
				const term = queryParams.searchText;
				query = query.or(`order_number.ilike.%${term}%,customer_name.ilike.%${term}%`);
			}
			if (queryParams.sortField) {
				query = query.order(queryParams.sortField, {
					ascending: queryParams.sortOrder === "asc",
				});
			}
			const from = (queryParams.page - 1) * queryParams.pageSize;
			const to = from + queryParams.pageSize - 1;
			query = query.range(from, to);

			const { data: result, error, count } = await query;

			if (error) throw error;

			setData(result as Order[]);
			setTotal(count || 0);
			// 刷新数据时清空选中项
			setSelectedRowKeys([]);
		} catch (error: unknown) {
			console.error("Fetch Error:", error);
			let errorMessage = "加载数据失败";
			if (typeof error === "object" && error !== null && "message" in error) {
				errorMessage = (error as PostgrestError | Error).message;
			}
			toastMessage("error", errorMessage);
		} finally {
			setLoading(false);
		}
	}, [queryParams, toastMessage]);

	useEffect(() => {
		fetchOrders();
	}, [fetchOrders]);

	// 3. 批量删除逻辑
	const handleBatchDelete = async () => {
		if (selectedRowKeys.length === 0) return;
		setBatchLoading(true);
		try {
			// 使用 Supabase 的 in 查询进行批量删除
			const { error } = await supabase.from("orders").delete().in("id", selectedRowKeys);

			if (error) throw error;

			toastMessage("success", `成功删除了 ${selectedRowKeys.length} 条订单`);
			setBatchDeleteModalOpen(false);
			fetchOrders(); // 刷新列表会自动清空选中项
		} catch (error: unknown) {
			console.error("Batch Delete Error:", error);
			let errorMessage = "批量删除失败";
			if (typeof error === "object" && error !== null && "message" in error) {
				errorMessage = (error as PostgrestError | Error).message;
			}
			toastMessage("error", errorMessage);
		} finally {
			setBatchLoading(false);
		}
	};

	const handleConfirmOrder = async (orderId: string) => {
		try {
			const { error } = await supabase
				.from("orders")
				.update({
					status: "confirmed",
					updated_at: new Date().toISOString(),
				})
				.eq("id", orderId);

			if (error) throw error;
			toastMessage("success", "订单状态已更新");
			fetchOrders();
		} catch (error: unknown) {
			let errorMessage = "操作失败";
			if (typeof error === "object" && error !== null && "message" in error) {
				errorMessage = (error as PostgrestError | Error).message;
			}
			toastMessage("error", errorMessage);
		}
	};

	const handleDeleteOrder = async (orderId: string) => {
		try {
			const { error } = await supabase.from("orders").delete().eq("id", orderId);
			if (error) throw error;
			toastMessage("success", "订单已删除");
			fetchOrders();
		} catch (error: unknown) {
			console.error("Delete Error:", error);
			let errorMessage = "删除失败";
			if (typeof error === "object" && error !== null && "message" in error) {
				errorMessage = (error as PostgrestError | Error).message;
			}
			toastMessage("error", errorMessage);
		}
	};

	//发货按钮逻辑
	const handleShipOrder = async (orderId: string) => {
		// 打开快递公司选择弹窗
		setSelectedOrderId(orderId);
		setLogisticsModalOpen(true);
	};

	// 处理快递公司选择后的发货
	const handleConfirmShipping = async (orderId: string, providerId: string) => {
		setShipLoading(true);
		try {
			await updateOrderLogisticsProvider(orderId, providerId);
			toastMessage("success", "订单已发货");
			setLogisticsModalOpen(false);
			fetchOrders();
		} catch (error: unknown) {
			let errorMessage = "操作失败";
			if (typeof error === "object" && error !== null && "message" in error) {
				errorMessage = (error as PostgrestError | Error).message;
			}
			toastMessage("error", errorMessage);
		} finally {
			setShipLoading(false);
		}
	};

	// 辅助函数
	const handleTableChange = (
		pagination: TablePaginationConfig,
		_filters: Record<string, FilterValue | null>,
		sorter: SorterResult<Order> | SorterResult<Order>[]
	) => {
		const sort = Array.isArray(sorter) ? sorter[0] : sorter;
		setQueryParams((prev) => ({
			...prev,
			page: pagination.current || 1,
			pageSize: pagination.pageSize || 10,
			sortField: (sort.field as string) || "created_at",
			sortOrder: sort.order === "ascend" ? "asc" : "desc",
		}));
	};

	const handleStatusChange = (e: RadioChangeEvent) => {
		setQueryParams((prev) => ({ ...prev, status: e.target.value, page: 1 }));
	};

	const triggerSearch = () => {
		setQueryParams((prev) => ({
			...prev,
			searchText: searchValue.trim(),
			status: "ALL",
			page: 1,
		}));
	};

	const handleViewDetails = (order: Order) => {
		setSelectedOrder(order);
		setDetailModalOpen(true);
	};

	const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
		setSelectedRowKeys(newSelectedRowKeys);
	};

	const rowSelection = {
		selectedRowKeys,
		onChange: onSelectChange,
		columnWidth: 48,
	};

	const columns: ColumnsType<Order> = [
		{
			title: "订单号",
			dataIndex: "order_number",
			key: "order_number",
			width: 180,
			render: (text) => <span className="font-sans font-semibold text-slate-700 tracking-tight select-all">{text}</span>,
		},
		{
			title: "客户姓名",
			dataIndex: "customer_name",
			key: "customer_name",
			width: 120,
			render: (text) => <span className="font-medium text-slate-600 text-sm">{text}</span>,
		},
		{
			title: "客户电话",
			dataIndex: "customer_phone",
			key: "customer_phone",
			width: 140,
			render: (text) => <span className="text-[13px] text-slate-400 font-mono tracking-wide select-all">{text}</span>,
		},
		{
			title: "总金额",
			dataIndex: "total_amount",
			key: "total_amount",
			sorter: true,
			align: "right",
			render: (amount) => (
				<span className="font-mono font-semibold text-blue-500/90 text-[15px]">
					<span className="text-xs text-blue-300 mr-0.5">¥</span>
					{Number(amount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
				</span>
			),
		},
		{
			title: "状态",
			dataIndex: "status",
			key: "status",
			width: 120,
			align: "center",
			render: (status) => getStatusStyle(status),
		},
		{
			title: "下单时间",
			dataIndex: "created_at",
			key: "created_at",
			sorter: true,
			defaultSortOrder: "descend",
			showSorterTooltip: false,
			width: 180,
			render: (date) => (
				<span className="text-slate-400 text-xs font-light tracking-wide font-sans">
					{new Date(date).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
				</span>
			),
		},
		{
			title: "操作",
			key: "action",
			width: 180,
			render: (_, record) => (
				<Space split={<Divider type="vertical" className="bg-slate-200 h-3" />}>
					<button
						onClick={() => handleViewDetails(record)}
						className="group flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-500 transition-all duration-200 active:scale-95">
						<span>详情</span>
					</button>
					{record.status === "pending" && (
						<Popconfirm
							title={<span className="font-medium text-slate-700">确认接单</span>}
							description={<span className="text-slate-500 text-xs">确认后将进入待发货状态</span>}
							onConfirm={() => handleConfirmOrder(record.id)}
							okText="确认"
							cancelText="取消"
							icon={<CheckCircleOutlined style={{ color: "#4f46e5" }} />}>
							<button className="group flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-600 transition-all duration-200 active:scale-95">
								<span>确认</span>
							</button>
						</Popconfirm>
					)}
					{record.status === "confirmed" && (
						<button
							className="group flex items-center gap-1 text-xs font-medium text-sky-500 hover:text-sky-600 transition-all duration-200 active:scale-95"
							onClick={() => handleShipOrder(record.id)}>
							<span>发货</span>
						</button>
					)}
					<Popconfirm
						title={<span className="font-medium text-slate-800">删除订单</span>}
						description={
							<div className="text-xs text-slate-500 max-w-[200px]">
								确定要永久删除此订单吗？
								<br />
								此操作<span className="text-red-500">不可恢复</span>。
							</div>
						}
						onConfirm={() => handleDeleteOrder(record.id)}
						okText="删除"
						cancelText="取消"
						okButtonProps={{ danger: true }}
						icon={<ExclamationCircleOutlined className="text-amber-500" />}>
						<button
							className="group flex items-center gap-1 text-xs font-medium text-red-300 hover:text-red-500 transition-all duration-200 active:scale-95"
							title="删除订单">
							删除
						</button>
					</Popconfirm>
				</Space>
			),
		},
	];

	return (
		<ConfigProvider
			theme={{
				token: {
					fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
					colorPrimary: "#3b82f6",
					borderRadius: 8,
					colorBgContainer: "#ffffff",
					colorText: "#334155",
				},
				components: {
					Table: {
						headerBg: "transparent",
						headerColor: "#94a3b8",
						headerSplitColor: "transparent",
						rowHoverBg: "#f8fafc",
						borderColor: "#f1f5f9",
						cellPaddingBlock: 16,
					},
					Card: { paddingLG: 0 },
					Button: { controlHeight: 36, defaultBorderColor: "#e2e8f0", defaultColor: "#64748b" },
					Input: { colorBorder: "#e2e8f0", hoverBorderColor: "#3b82f6" },
				},
			}}>
			<div className="min-h-screen bg-[#F8FAFC] p-6 sm:p-8 font-sans">
				{contextHolder}

				<div className="mx-auto max-w-[1200px] space-y-8">
					{/* 顶部 Header */}
					<div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
						<div className="space-y-1">
							<Typography.Title level={2} className="!m-0 !font-bold tracking-tight text-slate-800">
								订单管理
							</Typography.Title>
							<Typography.Text className="text-slate-400 font-light text-sm">实时监控全渠道订单状态与物流进度</Typography.Text>
						</div>

						<Space size="middle">
							<Space.Compact size="large" className="shadow-sm shadow-slate-200/50 rounded-lg transition-shadow hover:shadow-md">
								<Input
									placeholder="搜索订单号或客户名..."
									allowClear
									value={searchValue}
									onChange={(e) => setSearchValue(e.target.value)}
									onPressEnter={triggerSearch}
									prefix={<SearchOutlined className="text-slate-300 text-lg" />}
									className="w-64 !border-r-0 !bg-white focus:!z-10"
								/>
								<Button type="primary" onClick={triggerSearch} className="!bg-blue-600 !font-medium !px-6 hover:!bg-blue-500">
									搜索
								</Button>
							</Space.Compact>

							<Tooltip title="重置列表">
								<Button
									size="large"
									shape="circle"
									icon={<ReloadOutlined className={`text-slate-500 ${loading ? "animate-spin" : ""}`} />}
									onClick={() => {
										setSearchValue(""); // 清空搜索框
										setQueryParams((prev) => ({
											...prev,
											searchText: "", // 清空搜索条件
											status: "ALL", // 可选：重置状态筛选
											page: 1,
										}));
									}}
									className="!bg-white !border-slate-200 shadow-sm hover:!border-blue-400 hover:!text-blue-500 transition-all duration-300"
								/>
							</Tooltip>
						</Space>
					</div>

					{/* 主体卡片 */}
					<Card
						variant="borderless"
						className="overflow-hidden !rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] border border-slate-100 bg-white"
						styles={{ body: { padding: 0 } }}>
						{/* 4. 筛选栏与批量操作按钮区域 */}
						<div className="border-b border-slate-50 px-6 py-5 bg-white/50 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between">
							{/* 左侧：Radio Group */}
							<div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
								<Radio.Group value={queryParams.status} onChange={handleStatusChange} buttonStyle="solid" size="middle" className="flex-shrink-0">
									<Radio.Button value="ALL" className="!rounded-l-lg">
										全部
									</Radio.Button>
									<Radio.Button value="pending">待处理</Radio.Button>
									<Radio.Button value="confirmed">已确认</Radio.Button>
									<Radio.Button value="shipping">配送中</Radio.Button>
									<Radio.Button value="delivered">已送达</Radio.Button>
									<Radio.Button value="cancelled" className="!rounded-r-lg">
										已取消
									</Radio.Button>
								</Radio.Group>
							</div>

							{/* 右侧：批量删除按钮 */}
							{selectedRowKeys.length > 1 && (
								<div className="animate-fade-in pl-4">
									<Button
										danger
										type="primary"
										icon={<DeleteOutlined />}
										onClick={() => setBatchDeleteModalOpen(true)}
										className="!bg-red-50 !text-red-600 !border-red-100 hover:!bg-red-100 hover:!border-red-200 shadow-sm">
										批量删除 ({selectedRowKeys.length})
									</Button>
								</div>
							)}
						</div>

						<Table
							rowSelection={rowSelection}
							rowKey="id"
							columns={columns}
							dataSource={data}
							loading={loading}
							onChange={handleTableChange}
							onRow={(record) => ({
								onClick: () => {
									const selected = selectedRowKeys.includes(record.id);
									const newSelected = selected ? selectedRowKeys.filter((key) => key !== record.id) : [...selectedRowKeys, record.id];
									setSelectedRowKeys(newSelected);
								},
								style: { cursor: "pointer" },
							})}
							pagination={{
								current: queryParams.page,
								pageSize: queryParams.pageSize,
								total: total,
								showSizeChanger: true,
								showQuickJumper: true,
								showTotal: (t) => <span className="text-slate-400 text-xs">共 {t} 条记录</span>,
								className: "px-6 py-6 !mb-0",
								itemRender: (_, type, originalElement) => {
									if (type === "prev" || type === "next") {
										return <a className="!bg-slate-50 !border-slate-100 !rounded-md hover:!bg-slate-100 transition-colors">{originalElement}</a>;
									}
									return originalElement;
								},
							}}
							className="border-t-0"
							scroll={{ x: 900 }}
							rowClassName={() => "group hover:bg-slate-50/80 transition-colors duration-200"}
						/>
					</Card>
				</div>

				<OrderDetailModal open={detailModalOpen} order={selectedOrder} onClose={() => setDetailModalOpen(false)} />

				{/* 删除模态框 */}
				<DeleteModal
					open={batchDeleteModalOpen}
					onClose={() => setBatchDeleteModalOpen(false)}
					onConfirm={handleBatchDelete}
					count={selectedRowKeys.length}
					loading={batchLoading}
				/>

				{/* 快递公司选择弹窗 */}
				<LogisticsProviderModal
					open={logisticsModalOpen}
					onCancel={() => setLogisticsModalOpen(false)}
					onConfirm={(providerId) => handleConfirmShipping(selectedOrderId, providerId)}
					loading={shipLoading}
					orderId={selectedOrderId} // 传递订单ID
				/>
			</div>
		</ConfigProvider>
	);
};

export default OrderList;
