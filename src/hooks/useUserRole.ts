import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export type UserRole = "admin" | "merchant" | "customer" | null;

/**
 * 获取当前登录用户的角色
 */
export const useUserRole = () => {
	const [role, setRole] = useState<UserRole>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchUserRole = async () => {
			try {
				// 获取当前登录用户
				const {
					data: { user },
					error: authError,
				} = await supabase.auth.getUser();

				if (authError || !user) {
					setRole(null);
					setLoading(false);
					return;
				}

				// 从 profiles 表获取用户角色
				const { data: profileData, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();

				if (profileError || !profileData) {
					console.warn("无法获取用户角色:", profileError);
					setRole(null);
				} else {
					setRole((profileData.role as UserRole) || null);
				}
			} catch (error) {
				console.error("获取用户角色失败:", error);
				setRole(null);
			} finally {
				setLoading(false);
			}
		};

		fetchUserRole();

		// 监听认证状态变化
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(() => {
			fetchUserRole();
		});

		return () => {
			subscription.unsubscribe();
		};
	}, []);

	return { role, loading };
};
