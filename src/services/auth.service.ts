import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const registerSchema = z.object({
	name: z.string().min(2),
	email: z.string().email(),
	password: z
		.string()
		.min(6, "A senha deve ter no mínimo 6 caracteres")
		.regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula")
		.regex(/[0-9]/, "A senha deve conter pelo menos um número"),
});

export const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
});

export class AuthService {
	async register(data: z.infer<typeof registerSchema>) {
		const userExists = await prisma.user.findUnique({
			where: { email: data.email },
		});

		if (userExists) {
			throw new Error("Usuário já cadastrado com este e-mail.");
		}

		const hashedPassword = await bcrypt.hash(data.password, 8);

		const user = await prisma.user.create({
			data: {
				name: data.name,
				email: data.email,
				password: hashedPassword,
			},
		});

		return {
			id: user.id,
			name: user.name,
			email: user.email,
		};
	}

	async authenticate(data: z.infer<typeof loginSchema>) {
		const user = await prisma.user.findUnique({
			where: { email: data.email },
		});

		if (!user) {
			throw new Error("E-mail ou senha inválidos.");
		}

		const isPasswordValid = await bcrypt.compare(data.password, user.password);

		if (!isPasswordValid) {
			throw new Error("E-mail ou senha inválidos.");
		}

		return {
			id: user.id,
			name: user.name,
			email: user.email,
		};
	}
}
