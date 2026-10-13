import { randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { env } from "../config/env";
import {
	AUTH_COOKIE_NAME,
	CSRF_COOKIE_NAME,
	SESSION_TTL_JWT,
	SESSION_TTL_SECONDS,
} from "../lib/auth-cookies";
import {
	type AuthService,
	loginSchema,
	registerSchema,
} from "../services/auth.service";

function zodErrorResponse(error: ZodError) {
	return {
		message: "Dados inválidos",
		issues: error.issues.map((issue) => ({ message: issue.message })),
	};
}

function setSessionCookies(reply: FastifyReply, token: string) {
	const isProduction = env.NODE_ENV === "production";

	// httpOnly: inacessível a JS (mitiga roubo de token via XSS).
	reply.setCookie(AUTH_COOKIE_NAME, token, {
		httpOnly: true,
		secure: isProduction,
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_TTL_SECONDS,
	});

	// Legível por JS de propósito: o frontend lê esse valor e o reenvia no
	// header X-CSRF-Token em requisições que mutam estado (double-submit
	// cookie pattern) — só funciona como proteção CSRF porque um site
	// atacante não consegue LER o cookie da vítima, só fazer o navegador
	// enviá-lo.
	reply.setCookie(CSRF_COOKIE_NAME, randomBytes(32).toString("hex"), {
		httpOnly: false,
		secure: isProduction,
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_TTL_SECONDS,
	});
}

export class AuthController {
	constructor(private authService: AuthService) {}

	async register(request: FastifyRequest, reply: FastifyReply) {
		try {
			const data = registerSchema.parse(request.body);
			const user = await this.authService.register(data);
			return reply.status(201).send(user);
		} catch (error: any) {
			if (error instanceof ZodError) {
				return reply.status(400).send(zodErrorResponse(error));
			}
			return reply.status(400).send({ message: error.message });
		}
	}

	async login(request: FastifyRequest, reply: FastifyReply) {
		try {
			const data = loginSchema.parse(request.body);
			const user = await this.authService.authenticate(data);

			const token = await reply.jwtSign(
				{ name: user.name },
				{ sign: { sub: user.id, expiresIn: SESSION_TTL_JWT } },
			);

			setSessionCookies(reply, token);

			// O token também volta no corpo por compatibilidade com clientes
			// não-navegador (curl/mobile/scripts) e para não quebrar o
			// frontend atual enquanto ele ainda não migrou de
			// Authorization: Bearer para o cookie httpOnly.
			return reply.status(200).send({
				user,
				token,
			});
		} catch (error: any) {
			if (error instanceof ZodError) {
				return reply.status(400).send(zodErrorResponse(error));
			}
			return reply.status(401).send({ message: error.message });
		}
	}

	async logout(_request: FastifyRequest, reply: FastifyReply) {
		reply.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
		reply.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
		return reply.status(204).send();
	}
}
