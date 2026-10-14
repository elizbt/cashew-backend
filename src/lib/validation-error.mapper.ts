import type { ZodError } from "zod";

export function validationErrorResponse(error: ZodError) {
	return {
		code: "VALIDATION_ERROR",
		message: "Dados inválidos",
		issues: error.issues.map((issue) => ({ message: issue.message })),
	};
}
