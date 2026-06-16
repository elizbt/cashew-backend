import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AuthService, loginSchema, registerSchema } from "../services/auth.service";

export class AuthController {
	constructor(private authService: AuthService) {}

	async register(request: FastifyRequest, reply: FastifyReply) {
		try {
			const data = registerSchema.parse(request.body);
			const user = await this.authService.register(data);
			return reply.status(201).send(user);
		} catch (error: any) {
			if (error instanceof ZodError) {
				return reply.status(400).send({ message: "Dados inválidos", issues: error.format() });
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
				{ sign: { sub: user.id } }
			);

			return reply.status(200).send({
				user,
				token,
			});
		} catch (error: any) {
			if (error instanceof ZodError) {
				return reply.status(400).send({ message: "Dados inválidos", issues: error.format() });
			}
			return reply.status(401).send({ message: error.message });
		}
	}
}
