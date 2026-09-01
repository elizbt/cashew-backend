import { buildApp } from "./app";
import { env } from "./config/env";

const app = buildApp();

const start = async () => {
	try {
		await app.listen({ port: env.PORT, host: "0.0.0.0" });
		console.log(`🚀 Server ready at http://localhost:${env.PORT}`);
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
};

start();
