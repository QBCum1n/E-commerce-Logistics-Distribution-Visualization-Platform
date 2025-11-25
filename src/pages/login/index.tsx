import { useState } from "react";
import { Button, Card, Form, Input, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { request } from "@/utils/request";
import { useToastMessage } from "@/hooks/useToastMessage";

type LoginFormValues = {
	username: string;
	password: string;
};

const { Title, Text } = Typography;

const LoginPage = () => {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(false);
	const { toastMessage, contextHolder } = useToastMessage();

	const handleFinish = async (values: LoginFormValues) => {
		setLoading(true);
		try {
			const result = await request<{
				access_token: string;
				refresh_token: string;
				token_type: string;
				user: { email?: string };
			}>({
				url: "auth/v1/token?grant_type=password",
				method: "POST",
				data: {
					email: values.username,
					password: values.password,
				},
			});

			toastMessage("success", `欢迎回来，${result.user?.email ?? values.username}`);
			navigate("/dashboard");
		} catch (err) {
			const description = err instanceof Error ? err.message : "登录失败，请检查账号或密码";
			toastMessage("error", description);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50">
			{contextHolder}
			<div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
				<div className="mb-10 text-center">
					<Title level={2} className="!mb-2">
						电商物流控制台
					</Title>
					<Text type="secondary">使用企业账号登录，管理订单与出库进度。</Text>
				</div>

				<Card className="w-full max-w-lg self-center shadow-xl">
					<Form<LoginFormValues> layout="vertical" initialValues={{ username: "", password: "" }} onFinish={handleFinish}>
						<Form.Item label="账号" name="username" rules={[{ required: true, message: "请输入账号" }]}>
							<Input size="large" placeholder="请输入账号" autoComplete="username" />
						</Form.Item>

						<Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
							<Input.Password size="large" placeholder="请输入密码" autoComplete="current-password" />
						</Form.Item>

						<Form.Item className="mb-2">
							<Button type="primary" htmlType="submit" size="large" loading={loading} className="w-full">
								登录
							</Button>
						</Form.Item>
					</Form>

					<div className="flex flex-col gap-2 text-center text-sm text-slate-500">
						<span>如忘记密码，请联系管理员重置。</span>
						<span>登录即代表同意《隐私政策》与《服务条款》。</span>
					</div>
				</Card>
			</div>
		</div>
	);
};

export default LoginPage;
