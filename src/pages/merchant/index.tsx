import { useState } from "react";
import { Layout, Menu, Avatar, Dropdown, Space, ConfigProvider, theme, message } from "antd";
import { OrderedListOutlined, EnvironmentOutlined, UserOutlined, LogoutOutlined, DashboardOutlined } from "@ant-design/icons";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

const { Header, Sider, Content } = Layout;

const MainLayout = () => {
	const [collapsed, setCollapsed] = useState(false);
	const navigate = useNavigate();
	const location = useLocation();
	const {
		token: { colorBgContainer },
	} = theme.useToken();

	// 菜单配置
	const menuItems = [
		{
			key: "/merchant/order",
			icon: <OrderedListOutlined />,
			label: "订单管理",
		},
		{
			key: "/merchant/trajectory",
			icon: <EnvironmentOutlined />,
			label: "配送管理",
		},
		{
			key: "/merchant/dashboard",
			icon: <DashboardOutlined />,
			label: "可视化看板",
		},
	];

	// 处理退出登录
	const handleLogout = async () => {
		try {
			const { error } = await supabase.auth.signOut();
			if (error) throw error;
			localStorage.clear();
			message.success("已安全退出");
			navigate("/login");
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : "退出失败";
			message.error(`退出登录失败: ${errorMessage}`);
		}
	};

	// 下拉菜单点击处理
	const handleMenuClick = ({ key }: { key: string }) => {
		if (key === "logout") {
			handleLogout();
		}
	};

	// 计算当前选中的菜单 Key (兼容子路由高亮)
	const getSelectedKey = () => {
		const path = location.pathname;
		const matchedItem = menuItems.find((item) => path.startsWith(item.key));
		return matchedItem ? [matchedItem.key] : [path];
	};

	return (
		<ConfigProvider
			theme={{
				token: {
					colorPrimary: "#1677ff", // 经典的蓝
					borderRadius: 6,
				},
			}}>
			<Layout style={{ minHeight: "100vh" }}>
				{/* 左侧侧边栏 */}
				<Sider
					collapsible
					collapsed={collapsed}
					onCollapse={(value) => setCollapsed(value)}
					width={240}
					style={{
						background: "#001529",
						boxShadow: "2px 0 8px 0 rgba(29,35,41,0.05)",
					}}>
					{/* Logo 区域 */}
					<div className="h-16 flex items-center justify-center overflow-hidden transition-all duration-300">
						{collapsed ? (
							<div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center text-white font-bold">Z</div>
						) : (
							<span className="text-white text-lg font-bold tracking-wider">物流镜头</span>
						)}
					</div>

					{/* 菜单 */}
					<Menu
						theme="dark"
						mode="inline"
						selectedKeys={getSelectedKey()}
						items={menuItems}
						onClick={({ key }) => navigate(key)}
						style={{ borderRight: 0 }}
					/>
				</Sider>

				<Layout>
					{/* 顶部 Header */}
					<Header
						style={{
							padding: "0 24px",
							background: colorBgContainer,
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							boxShadow: "0 1px 4px rgba(0,21,41,0.08)",
							zIndex: 1,
						}}>
						<div className="text-lg font-medium text-slate-700">
							{menuItems.find((i) => location.pathname.startsWith(i.key))?.label || "商家后台"}
						</div>

						<Space size="large">
							<Dropdown
								menu={{
									items: [{ key: "logout", label: "退出登录", icon: <LogoutOutlined />, danger: true }],
									onClick: handleMenuClick,
								}}>
								<div className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded-md transition-colors">
									<Avatar style={{ backgroundColor: "#1677ff" }} icon={<UserOutlined />} />
									<span className="text-sm text-slate-600">用户</span>
								</div>
							</Dropdown>
						</Space>
					</Header>

					{/* 内容区域 */}
					<Content 
						className="m-0 p-0 min-h-72"
						style={{ background: 'transparent' }}
					>
						{/* 路由出口：这里会渲染具体的页面（如 DashboardPage, OrderList 等） */}
						<Outlet />
					</Content>
				</Layout>
			</Layout>
		</ConfigProvider>
	);
};

export default MainLayout;
