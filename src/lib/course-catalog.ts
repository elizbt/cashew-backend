// Fonte única dos cursos usados no filtro de retrieval: a ingestão grava
// `documents.course` a partir de COURSE_BY_SOURCE_FILE, e a busca filtra pelo
// curso que detectCourse encontra na pergunta. Os dois lados precisam usar
// exatamente os mesmos slugs — por isso ambos derivam do tipo Course.

export const COURSES = [
	"tads",
	"administracao",
	"engenharia-agricola-ambiental",
	"gestao-saude",
	"gestao-ambiental",
] as const;

export type Course = (typeof COURSES)[number];

// Sinônimos usados para detectar a qual curso a pergunta se refere, e assim
// restringir a busca vetorial ao(s) documento(s) daquele curso (evita que a
// busca traga por engano o chunk de "coordenador"/"contato" de outro curso,
// já que os documentos de cursos diferentes têm estrutura de texto parecida).
export const COURSE_KEYWORDS: Record<Course, string[]> = {
	tads: ["tads", "analise e desenvolvimento de sistemas"],
	administracao: ["administracao"],
	"engenharia-agricola-ambiental": [
		"engenharia agricola",
		"engenharia ambiental",
		"agricola e ambiental",
	],
	"gestao-saude": ["gestao em saude"],
	"gestao-ambiental": ["gestao ambiental"],
};

// Arquivos institucionais (biblioteca, assistência estudantil, corpo docente
// etc.) não pertencem a um curso específico e ficam fora deste mapa, o que
// grava course = null.
export const COURSE_BY_SOURCE_FILE: Record<string, Course> = {
	"tads.md": "tads",
	"administracao.md": "administracao",
	"engenharia-agricola.md": "engenharia-agricola-ambiental",
	"gestao-saude.md": "gestao-saude",
	"gestao-ambiental.md": "gestao-ambiental",
};

function normalizeForMatch(text: string): string {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
}

export function detectCourse(query: string): Course | null {
	const normalizedQuery = normalizeForMatch(query);
	for (const course of COURSES) {
		const keywords = COURSE_KEYWORDS[course];
		if (
			keywords.some((kw) => normalizedQuery.includes(normalizeForMatch(kw)))
		) {
			return course;
		}
	}
	return null;
}

export function courseForSourceFile(fileName: string): Course | null {
	return COURSE_BY_SOURCE_FILE[fileName] ?? null;
}
