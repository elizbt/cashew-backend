import type { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/auth.controller";
import { AuthService } from "../services/auth.service";

const authService = new AuthService();
const authController = new AuthController(authService);

export async function authRoutes(app: FastifyInstance) {
	app.post("/register", authController.register.bind(authController));
	app.post("/login", authController.login.bind(authController));
}
