import { useState } from "react";
import { Button, Card, Form, Input, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useToastMessage } from "@/hooks/useToastMessage";
import { supabase } from "@/lib/supabaseClient";
import loginBg from "@/assets/images/login.png";

// 用户角色类型
type UserRole = "admin" | "merchant" | "customer" | null;

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
			// 使用 supabase SDK 进行登录
			const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
				email: values.username,
				password: values.password,
			});

			if (authError) {
				throw authError;
			}

			// 获取用户ID
			const userId = authData.user?.id;
			if (!userId) {
				throw new Error("获取用户信息失败");
			}

			// 从profiles表中获取用户角色信息
			// 根据数据库结构，用户角色信息实际存储在profiles表中
			const { data: profilesData, error: profilesError } = await supabase.from("profiles").select("role").eq("id", userId).single();

			if (profilesError) {
				// 如果profiles表查询失败，使用备用方案
				console.warn("无法从profiles表获取用户角色，将尝试从用户邮箱推断");
				// 备用方案：根据邮箱前缀判断用户角色
				const email = authData.user?.email || "";
				const userRole: UserRole = email.includes("customer") ? "customer" : "merchant";
				navigateBasedOnRole(userRole);
			} else {
				// 成功获取用户角色
				const userRole: UserRole = (profilesData?.role as UserRole) || "merchant";
				navigateBasedOnRole(userRole);
			}
		} catch (err) {
			// 错误处理
			const description = err instanceof Error ? err.message : "登录失败，请检查账号或密码";
			toastMessage("error", description);
		} finally {
			setLoading(false);
		}
	};

	// 根据用户角色进行页面跳转
	const navigateBasedOnRole = (role: UserRole) => {
		console.log("用户角色:", role);
		toastMessage("success", "登录成功");
		// 根据角色跳转到不同页面
		if (role === "customer") {
			setTimeout(() => navigate("/user"), 800);
		} else if (role === "merchant") {
			setTimeout(() => navigate("/merchant/order"), 800);
		}
		// else {
		// 默认情况下也进行跳转，避免无响应
		// setTimeout(() => navigate("/merchant"), 800);
		// }
	};

	return (
		<div className="relative min-h-screen w-full bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${loginBg})` }}>
			<div className="absolute inset-0" />
			{contextHolder}

			<div className="relative z-10 flex min-h-screen flex-col justify-center px-4 py-12 sm:px-6 lg:px-20 md:items-start">
				<Card className="w-full max-w-md overflow-hidden rounded-2xl bg-white/95 shadow-2xl backdrop-blur-sm transition-all md:mr-10 lg:mr-20 p-1">
					<div className="mb-8 text-center">
						<Title level={2} className="!mb-2 !font-bold text-slate-800">
							物流镜头
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
