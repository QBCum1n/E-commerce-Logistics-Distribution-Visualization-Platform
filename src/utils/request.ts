import axios, { AxiosError, AxiosHeaders } from "axios";
import type { AxiosRequestConfig } from "axios";

const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!baseUrl || !anonKey) {
	throw new Error("缺少 Supabase 环境变量：请配置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY");
}

const client = axios.create({
	baseURL: `${baseUrl}/`,
	timeout: 15000,
});

client.interceptors.request.use((config) => {
	const headers = AxiosHeaders.from(config.headers ?? {});
	headers.set("apikey", anonKey);
	headers.set("Authorization", `Bearer ${anonKey}`);
	headers.set("accept", "application/json");
	if (!headers.has("Content-Type") && config.method?.toUpperCase() !== "GET") {
		headers.set("Content-Type", "application/json");
	}

	config.headers = headers;
	return config;
});

client.interceptors.response.use(
	(response) => response,
	(error: AxiosError<{ message?: string; error_description?: string; msg?: string }>) => {
		const description =
			error.response?.data?.message ??
			error.response?.data?.error_description ??
			error.response?.data?.msg ??
			error.message ??
			"请求失败，请稍后再试";

		const wrappedError = new Error(description);
		return Promise.reject(wrappedError);
	}
);

export const request = async <T = unknown>(config: AxiosRequestConfig): Promise<T> => {
	const response = await client.request<T>(config);
	return response.data;
};
