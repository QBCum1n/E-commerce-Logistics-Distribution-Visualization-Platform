import { Card } from "antd";
import Map from "../components/map";

const containerStyle: React.CSSProperties = {
	width: "100%",
	height: "70vh",
	minHeight: 400,
};

const TestPage = () => {
	return (
		<div style={{ padding: 24 }}>
			<Card title="城市地图演示" variant="borderless">
				<div style={containerStyle}>
					<Map />
				</div>
			</Card>
		</div>
	);
};

export default TestPage;
