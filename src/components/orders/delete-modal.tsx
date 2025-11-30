import { Modal, Button } from "antd";
import { ExclamationCircleFilled, DeleteOutlined } from "@ant-design/icons";

interface DeleteModalProps {
	open: boolean;
	onClose: () => void;
	onConfirm: () => void;
	count: number; // 选中的数量
	loading: boolean;
}

const DeleteModal = ({ open, onClose, onConfirm, count, loading }: DeleteModalProps) => {
	return (
		<Modal
			open={open}
			onCancel={onClose}
			footer={null} // 自定义底部按钮以获得更好的样式控制
			centered
			width={420}
			className="batch-delete-modal"
			styles={{ mask: { backdropFilter: "blur(4px)" } }}>
			<div className="pt-6 pb-2">
				{/* 顶部图标区 */}
				<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 mb-6 animate-pulse">
					<ExclamationCircleFilled className="text-3xl text-red-500" />
				</div>

				{/* 文本内容区 */}
				<div className="text-center space-y-3 px-4">
					<h3 className="text-xl font-bold text-slate-800">确认删除 {count} 条订单?</h3>

					{/* 醒目的黄色警告框 */}
					<div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-left mx-auto mt-4">
						<p className="text-amber-800 font-bold text-sm mb-1 flex items-center gap-2">⚠️ 警告：危险操作</p>
						<p className="text-amber-700/80 text-xs leading-relaxed">
							您即将从数据库中<span className="font-bold underline">永久删除</span>这些订单。 所有关联的客户信息、商品记录及物流轨迹都将无法恢复。
						</p>
					</div>

					<p className="text-slate-400 text-xs mt-2">请再次确认您的操作，以免造成数据丢失。</p>
				</div>

				{/* 底部按钮区 */}
				<div className="mt-8 flex gap-3 px-4">
					<Button block size="large" onClick={onClose} disabled={loading} className="!rounded-lg">
						取消
					</Button>
					<Button
						block
						size="large"
						type="primary"
						danger
						onClick={onConfirm}
						loading={loading}
						icon={<DeleteOutlined />}
						className="!bg-red-600 hover:!bg-red-500 !rounded-lg shadow-lg shadow-red-200">
						确认删除
					</Button>
				</div>
			</div>
		</Modal>
	);
};

export default DeleteModal;
