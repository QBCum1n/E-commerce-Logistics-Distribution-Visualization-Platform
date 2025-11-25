import { message } from "antd";
import { useCallback } from "react";

type ToastType = "success" | "error" | "info" | "warning" | "loading";

export const useToastMessage = () => {
	const [messageApi, contextHolder] = message.useMessage();

	const toastMessage = useCallback(
		(type: ToastType, content: string, duration = 2) => {
			messageApi[type]({ content, duration });
		},
		[messageApi]
	);

	return { toastMessage, contextHolder };
};

