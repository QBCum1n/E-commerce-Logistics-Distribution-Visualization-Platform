import { useRoutes } from "react-router-dom";
import { appRoutes } from "./routes";

const AppRouter = () => {
	const element = useRoutes(appRoutes);
	return element;
};

export default AppRouter;
