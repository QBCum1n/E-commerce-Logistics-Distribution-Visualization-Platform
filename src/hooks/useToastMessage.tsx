/** 
 * 消息提示钩子
 * 用于在组件中显示消息提示
 * const { toastMessage, contextHolder } = useToastMessage();
 * toastMessage("success", "操作成功");
 * return (
 *   <div>
 *     {contextHolder}
 *     <Button onClick={() => toastMessage("success", "操作成功")}>操作成功</Button>
 *   </div>
 * );
 */
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

