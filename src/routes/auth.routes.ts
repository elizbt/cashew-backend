import type { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/auth.controller";
import { AuthService } from "../services/auth.service";

const authService = new AuthService();
const authController = new AuthController(authService);

const bruteForceRateLimit = {
	config: {
		rateLimit: {
			max: 5,
			timeWindow: "1 minute",
		},
	},
};

export async function authRoutes(app: FastifyInstance) {
	app.post(
		"/register",
		bruteForceRateLimit,
		authController.register.bind(authController),
	);
	app.post(
		"/login",
		bruteForceRateLimit,
		authController.login.bind(authController),
	);
	// Devolve o token CSRF da sessão atual para o frontend que não consegue
	// ler o cookie csrfToken (API em outro host) — ex.: após recarregar a página.
	app.get(
		"/csrf",
		{ preHandler: (request) => request.jwtVerify() },
		authController.csrf.bind(authController),
	);
	// Não dá pra apagar um cookie httpOnly via JS — precisa ser o backend
	// mandando um Set-Cookie de expiração imediata.
	app.post("/logout", authController.logout.bind(authController));
}
