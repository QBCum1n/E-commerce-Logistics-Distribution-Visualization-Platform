import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spin } from "antd";
import { useUserRole } from "@/hooks/useUserRole";

interface ProtectedRouteProps {
	children: ReactNode;
	/** 允许的角色列表，如果为空则所有登录用户都可以访问 */
	allowedRoles?: Array<"admin" | "merchant" | "customer">;
	/** 如果为 true，admin 用户只能访问 /user 及其子路由和 /login，访问其他路由会被重定向 */
	OnlyUserRoute?: boolean;
}

/**
 * 路由守卫组件
 * - 如果用户未登录，重定向到 /login
 * - 如果设置了 allowedRoles，只允许指定角色访问
 * - 如果 OnlyUserRoute 为 true 且用户是 admin，访问非 /user 和 /login 的路由会被重定向到 /user
 */
const ProtectedRoute = ({ children, allowedRoles, OnlyUserRoute = false }: ProtectedRouteProps) => {
	const { role, loading } = useUserRole();
	const location = useLocation();

	// 加载中显示加载状态
	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Spin size="large" tip="加载中..." />
			</div>
		);
	}

	// 未登录，重定向到登录页
	if (!role) {
		return <Navigate to="/login" replace state={{ from: location }} />;
	}

	// 如果设置了 allowedRoles，检查角色是否在允许列表中
	if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
		// 根据角色重定向到默认页面
		if (role === "customer") {
			return <Navigate to="/user" replace />;
		} else if (role === "merchant") {
			return <Navigate to="/merchant/order" replace />;
		}
		return <Navigate to="/login" replace />;
	}

	// 如果 OnlyUserRoute 为 true 且用户是 admin
	// customer 用户只能访问 /user 及其子路由和 /login
	if (OnlyUserRoute && role === "customer") {
		const pathname = location.pathname;
		// 只允许访问 /login 和 /user 及其子路由
		const isAllowedPath = pathname === "/login" || pathname.startsWith("/user");

		if (!isAllowedPath) {
			// 访问不允许的路径，重定向到 /user
			return <Navigate to="/user" replace />;
		}
	}

	return <>{children}</>;
};

export default ProtectedRoute;
