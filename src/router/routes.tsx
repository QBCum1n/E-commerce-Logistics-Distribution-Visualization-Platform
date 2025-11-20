import { type RouteObject, Navigate } from "react-router-dom";
import DashboardPage from "../pages/dashboard";
import LoginPage from "../pages/login";

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
		element: <DashboardPage />,
	},
	{
		path: "*",
		element: <Navigate to="/login" replace />,
	},
];
