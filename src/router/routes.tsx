import { type RouteObject, Navigate } from "react-router-dom";
import DashboardPage from "../pages/dashboard";
import LoginPage from "../pages/login";
import TestPage from "../pages/test";

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
		path: "/test",
		element: <TestPage />,
	},
	{
		path: "*",
		element: <Navigate to="/login" replace />,
	},
];
