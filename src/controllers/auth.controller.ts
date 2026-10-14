import { randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { env } from "../config/env";
import {
	AUTH_COOKIE_NAME,
	CSRF_COOKIE_NAME,
	SESSION_TTL_JWT,
	SESSION_TTL_SECONDS,
} from "../lib/auth-cookie.constants";
import { validationErrorResponse } from "../lib/validation-error.mapper";
import {
	type AuthService,
	loginSchema,
	registerSchema,
} from "../services/auth.service";

function csrfCookieOptions() {
	// Legível por JS de propósito no cenário de mesmo host; quando frontend e
	// API estão em hosts diferentes o JS do frontend não enxerga este cookie,
	// por isso o mesmo valor também volta no corpo de /login e de GET /csrf.
	// Continua sendo proteção CSRF (double-submit) porque um site atacante não
	// consegue ler nem o cookie nem essas respostas (bloqueadas pelo CORS).
	return {
		httpOnly: false,
		secure: env.NODE_ENV === "production",
		sameSite: "lax" as const,
		path: "/",
		maxAge: SESSION_TTL_SECONDS,
	};
}

function issueCsrfToken(reply: FastifyReply) {
	const csrfToken = randomBytes(32).toString("hex");
	reply.setCookie(CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions());
	return csrfToken;
}

function setSessionCookies(reply: FastifyReply, token: string) {
	// httpOnly: inacessível a JS (mitiga roubo de token via XSS).
	reply.setCookie(AUTH_COOKIE_NAME, token, {
		httpOnly: true,
		secure: env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_TTL_SECONDS,
	});

	return issueCsrfToken(reply);
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
				return reply.status(400).send(validationErrorResponse(error));
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

			const csrfToken = setSessionCookies(reply, token);

			// O token também volta no corpo por compatibilidade com clientes
			// não-navegador (curl/mobile/scripts) e para não quebrar o
			// frontend atual enquanto ele ainda não migrou de
			// Authorization: Bearer para o cookie httpOnly.
			return reply.status(200).send({
				user,
				token,
				csrfToken,
			});
		} catch (error: any) {
			if (error instanceof ZodError) {
				return reply.status(400).send(validationErrorResponse(error));
			}
			return reply.status(401).send({ message: error.message });
		}
	}

	async csrf(request: FastifyRequest, reply: FastifyReply) {
		const csrfToken =
			request.cookies[CSRF_COOKIE_NAME] ?? issueCsrfToken(reply);
		return reply.status(200).send({ csrfToken });
	}

	async logout(_request: FastifyRequest, reply: FastifyReply) {
		reply.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
		reply.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
		return reply.status(204).send();
	}
}
