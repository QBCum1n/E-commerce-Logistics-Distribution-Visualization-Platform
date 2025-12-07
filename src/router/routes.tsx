import { type RouteObject, Navigate } from "react-router-dom";
import DashboardPage from "@/pages/dashboard";
import LoginPage from "@/pages/login";
import MerchantPage from "@/pages/merchant";
import LogisticsTrajectoryPage from "@/pages/merchant/trajectory";
import OrderManagement from "@/pages/merchant/order";
import MerchantDashboard from "@/pages/merchant/VisualDashboard";
import DeliveryRangeManagementPage from "@/pages/dashboard/delivery-range-management";
import UserPage from "@/pages/user";
import ProtectedRoute from "@/components/ProtectedRoute";

export const appRoutes: RouteObject[] = [
	{
		path: "/",
		element: <Navigate to="/login" replace />,
	},
	{
		path: "/login",
		element: <LoginPage />,
	},
	{
		path: "/dashboard",
		element: (
			<ProtectedRoute OnlyUserRoute>
				<DashboardPage />
			</ProtectedRoute>
		),
		children: [
			{
				path: "delivery-range",
				element: <DeliveryRangeManagementPage />,
			},
		],
	},
	{
		path: "/merchant",
		element: (
			<ProtectedRoute OnlyUserRoute>
				<MerchantPage />
			</ProtectedRoute>
		),
		children: [
			{
				path: "order",
				element: <OrderManagement />,
			},
			{
				path: "trajectory",
				element: <LogisticsTrajectoryPage />,
			},
			{
				path: "dashboard",
				element: <MerchantDashboard />,
			},
		],
	},
	{
		path: "/user",
		element: (
			<ProtectedRoute>
				<UserPage />
			</ProtectedRoute>
		),
	},
	{
		path: "*",
		element: <Navigate to="/login" replace />,
	},
];
