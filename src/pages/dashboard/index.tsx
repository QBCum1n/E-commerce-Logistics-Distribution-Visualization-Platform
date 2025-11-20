import { Button, Card, Space, Statistic, Typography } from "antd";
import { Link } from "react-router-dom";

const { Title, Text } = Typography;

const mockStats = [
	{ label: "待发货订单", value: 128 },
	{ label: "今日出库", value: 86 },
	{ label: "异常包裹", value: 5 },
];

const DashboardPage = () => {
	return (
		<div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-8">
			<div className="mx-auto max-w-5xl space-y-8">
				<header className="flex items-center justify-between">
					<div>
						<Title level={3} className="!mb-1">
							仪表盘
						</Title>
						<Text type="secondary">查看物流运行情况，并快速处理异常。</Text>
					</div>
					<Link to="/login">
						<Button type="default">退出登录</Button>
					</Link>
				</header>

				<Space direction="horizontal" size="large" className="flex flex-wrap gap-4">
					{mockStats.map((stat) => (
						<Card key={stat.label} className="flex-1 min-w-[200px] shadow-sm">
							<Statistic title={stat.label} value={stat.value} />
						</Card>
					))}
				</Space>

				<Card title="快速操作" className="shadow-sm">
					<Space wrap>
						<Button type="primary">创建发货单</Button>
						<Button>导入订单</Button>
						<Button>异常处理</Button>
					</Space>
				</Card>
			</div>
		</div>
	);
};

export default DashboardPage;
