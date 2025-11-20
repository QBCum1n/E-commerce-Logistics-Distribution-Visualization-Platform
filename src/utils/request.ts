/**
 * request 工具
 * 1. 直接调用 `request("/api/path", { method: "GET" })`，或使用 `request.get/post/put/delete` 快捷方法；
 * 2. `request.post("/api", body)` 等价于传入 `options.data`，对象会自动 JSON 序列化；
 * 3. 请求拦截器会统一附带 `withCredentials` 与公共 header，可在配置中继续追加；
 * 4. 响应拦截器会读取后端 message 并根据状态码弹出 toast；`showToast: false` 可关闭，`successMessage` 可自定义成功文案；
 * 5. 任意请求失败都会抛出 `RequestError`，包含 `status` 与 `data`，方便在页面上层捕获处理。
 */

import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";
import { message } from "antd";

type RequestOptions<T = unknown> = AxiosRequestConfig<T> & {
	showToast?: boolean;
	successMessage?: string;
};

interface RequestError extends Error {
	status: number;
	data?: unknown;
}

const defaultMessages: Record<number, string> = {
	200: "操作成功",
	201: "创建成功",
	204: "操作成功，返回空内容",
	400: "请求参数有误",
	401: "登录状态已失效，请重新登录",
	403: "没有权限执行该操作",
	404: "请求的资源不存在",
	500: "服务器开小差了，请稍后再试",
	502: "网关错误，请稍后再试",
	503: "服务不可用，请稍后再试",
	504: "请求超时，请稍后再试",
};

const getBaseUrl = () => import.meta.env.VITE_API_BASE_URL ?? "";

const showToast = (status: number, content?: string) => {
	const text = content ?? defaultMessages[status];
	if (!text) return;
	if (status >= 200 && status < 300) {
		message.success(text);
		return;
	}
	if (status >= 400 && status < 500) {
		message.warning(text);
		return;
	}
	message.error(text);
};

type RequestMethod = <T = unknown, D = unknown>(endpoint: string, options?: RequestOptions<D>) => Promise<T>;

type RequestInstance = RequestMethod & {
	get: <T = unknown>(endpoint: string, options?: RequestOptions) => Promise<T>;
	post: <T = unknown, D = unknown>(endpoint: string, body?: D, options?: RequestOptions<D>) => Promise<T>;
	put: <T = unknown, D = unknown>(endpoint: string, body?: D, options?: RequestOptions<D>) => Promise<T>;
	delete: <T = unknown>(endpoint: string, options?: RequestOptions) => Promise<T>;
};

const extractMessage = (payload: unknown): string | undefined => {
	if (payload && typeof payload === "object" && "message" in payload) {
		const maybeMessage = (payload as { message?: unknown }).message;
		if (typeof maybeMessage === "string") return maybeMessage;
	}
	return undefined;
};

const axiosInstance: AxiosInstance = axios.create({
	baseURL: getBaseUrl(),
	withCredentials: true,
	headers: {
		"Content-Type": "application/json",
	},
});

axiosInstance.interceptors.request.use(
	(config) => {
		config.withCredentials ??= true;
		return config;
	},
	(error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
	(response) => {
		const { showToast: needToast = true, successMessage } = (response.config as RequestOptions) ?? {};
		if (needToast) {
			const serverMsg = extractMessage(response.data);
			showToast(response.status, successMessage || serverMsg);
		}
		return response;
	},
	(error: AxiosError) => {
		const { response, config } = error;
		const { showToast: needToast = true } = (config as RequestOptions) ?? {};

		const status = response?.status ?? 0;
		const serverMsg = extractMessage(response?.data);
		const fallbackMessage = status ? defaultMessages[status] : "网络异常，请稍候重试";

		if (needToast) {
			if (status) {
				showToast(status, serverMsg);
			} else {
				message.error(serverMsg || fallbackMessage);
			}
		}

		const requestError = new Error(serverMsg || fallbackMessage) as RequestError;
		requestError.status = status || -1;
		requestError.data = response?.data;

		return Promise.reject(requestError);
	}
);

const baseRequest: RequestMethod = async <T = unknown, D = unknown>(endpoint: string, options: RequestOptions<D> = {}) => {
	const { showToast: needToast = true, successMessage, ...rest } = options;

	const requestConfig: RequestOptions<D> = {
		url: endpoint,
		showToast: needToast,
		successMessage,
		...rest,
	};

	const response = await axiosInstance.request<T, AxiosResponse<T>, D>(requestConfig);
	return response.data;
};

const request = baseRequest as RequestInstance;

request.get = function <T = unknown>(endpoint: string, options?: RequestOptions) {
	return baseRequest<T>(endpoint, { ...options, method: "GET" });
};

request.post = function <T = unknown, D = unknown>(endpoint: string, body?: D, options?: RequestOptions<D>) {
	return baseRequest<T, D>(endpoint, { ...options, method: "POST", data: body });
};

request.put = function <T = unknown, D = unknown>(endpoint: string, body?: D, options?: RequestOptions<D>) {
	return baseRequest<T, D>(endpoint, { ...options, method: "PUT", data: body });
};

request.delete = function <T = unknown>(endpoint: string, options?: RequestOptions) {
	return baseRequest<T>(endpoint, { ...options, method: "DELETE" });
};

export type { RequestOptions, RequestError };
export default request;
