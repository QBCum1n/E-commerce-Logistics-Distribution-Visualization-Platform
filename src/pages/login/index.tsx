import { useState } from "react";
import { Button, Card, Form, Input, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useToastMessage } from "@/hooks/useToastMessage";
import { supabase } from "@/lib/supabaseClient"; 
import loginBg from "@/assets/images/login.png";

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
			// 2. 修改这里：使用 supabase SDK 进行登录
			// SDK 会自动将返回的 token 存入 LocalStorage，并更新实例状态
			const { data, error } = await supabase.auth.signInWithPassword({
				email: values.username,
				password: values.password,
			});

			if (error) {
				throw error;
			}

			// 3. (可选) 打印一下确认登录成功
			console.log("登录成功，Session 已保存:", data);

			toastMessage("success", "登录成功");
			setTimeout(() => navigate("/dashboard"), 800); 
		} catch (err) {
			// 错误处理保持不变
			const description = err instanceof Error ? err.message : "登录失败，请检查账号或密码";
			toastMessage("error", description);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="relative min-h-screen w-full bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${loginBg})` }}>
			<div className="absolute inset-0 bg-black/30" /> 
            {/* 注意：加了 bg-black/30 遮罩让文字更清晰，如果不想要可以去掉 */}

			{contextHolder}

			<div className="relative z-10 flex min-h-screen flex-col justify-center px-4 py-12 sm:px-6 lg:px-20 md:items-start">
				<Card className="w-full max-w-md overflow-hidden rounded-2xl bg-white/95 shadow-2xl backdrop-blur-sm transition-all md:mr-10 lg:mr-20 p-1">
					<div className="mb-8 text-center">
						<Title level={2} className="!mb-2 !font-bold text-slate-800">
							电商物流配送可视化平台
						</Title>
						<Text className="text-slate-500">使用企业账号登录，管理订单与出库进度</Text>
					</div>

					<Form<LoginFormValues> layout="vertical" initialValues={{ username: "", password: "" }} onFinish={handleFinish} size="large">
						<Form.Item
							label={<span className="font-medium text-slate-600">账号</span>}
							name="username"
							rules={[{ required: true, message: "请输入账号" }]}>
							<Input
								prefix={<UserOutlined className="text-slate-400" />}
								placeholder="请输入账号/邮箱"
								autoComplete="username"
								className="hover:border-blue-500 focus:border-blue-500"
							/>
						</Form.Item>

						<Form.Item
							label={<span className="font-medium text-slate-600">密码</span>}
							name="password"
							rules={[{ required: true, message: "请输入密码" }]}>
							<Input.Password prefix={<LockOutlined className="text-slate-400" />} placeholder="请输入密码" autoComplete="current-password" />
						</Form.Item>

						<Form.Item className="mt-8 mb-4">
							<Button
								type="primary"
								htmlType="submit"
								loading={loading}
								className="h-12 w-full rounded-lg bg-blue-600 text-lg font-semibold shadow-lg hover:bg-blue-500 hover:shadow-blue-500/30">
								登 录
							</Button>
						</Form.Item>
					</Form>

					<div className="flex flex-col gap-2 text-center text-xs text-slate-400 mt-4">
						<span className="cursor-pointer hover:text-blue-600 transition-colors">如忘记密码，请联系管理员重置</span>
						<span>登录即代表同意《隐私政策》与《服务条款》</span>
					</div>
				</Card>
			</div>
		</div>
	);
};

export default LoginPage;