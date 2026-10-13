// Nomes/constantes compartilhados entre app.ts (registro dos plugins),
// auth.controller.ts (quem seta os cookies no login) e chat.routes.ts
// (quem valida o CSRF token) — para não duplicar strings mágicas.

export const AUTH_COOKIE_NAME = "token";
export const CSRF_COOKIE_NAME = "csrfToken";
export const CSRF_HEADER_NAME = "x-csrf-token";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias — usado no maxAge dos cookies (segundos)
// fast-jwt (usado pelo @fastify/jwt nesta versão) interpreta um `expiresIn`
// numérico como MILISSEGUNDOS, não segundos — por isso o JWT usa a forma em
// string, que é interpretada como duração legível ("7d" = 7 dias) e evita
// essa pegadinha de unidade.
export const SESSION_TTL_JWT = "7d";
