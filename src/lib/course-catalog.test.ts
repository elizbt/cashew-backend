import { describe, expect, it } from "vitest";
import {
	COURSE_BY_SOURCE_FILE,
	COURSE_KEYWORDS,
	COURSES,
	courseForSourceFile,
	detectCourse,
} from "./course-catalog";

describe("lib/course-catalog", () => {
	describe("parity between ingestion and retrieval", () => {
		it("every course detectable in a question is assigned to at least one ingested file", () => {
			// Sem isso, uma pergunta sobre o curso filtraria a busca para um slug
			// que nenhum documento tem, e só os documentos institucionais voltariam.
			const ingestedCourses = new Set(Object.values(COURSE_BY_SOURCE_FILE));

			for (const course of COURSES) {
				expect(ingestedCourses, `curso sem arquivo: ${course}`).toContain(
					course,
				);
			}
		});

		it("every keyword detects its own course, never one declared earlier", () => {
			for (const course of COURSES) {
				for (const keyword of COURSE_KEYWORDS[course]) {
					expect(detectCourse(`pergunta sobre ${keyword}`)).toBe(course);
				}
			}
		});

		it("every course has at least one keyword", () => {
			for (const course of COURSES) {
				expect(COURSE_KEYWORDS[course].length).toBeGreaterThan(0);
			}
		});
	});

	describe("detectCourse", () => {
		it("matches regardless of accents and casing", () => {
			expect(detectCourse("Quem coordena ENGENHARIA AGRÍCOLA?")).toBe(
				"engenharia-agricola-ambiental",
			);
			expect(detectCourse("curso de Gestão em Saúde")).toBe("gestao-saude");
		});

		it("returns null for a question that names no course", () => {
			expect(detectCourse("Qual o horário da biblioteca?")).toBeNull();
		});

		it("returns null for an empty question", () => {
			expect(detectCourse("")).toBeNull();
		});
	});

	describe("courseForSourceFile", () => {
		it("maps a course file to its slug", () => {
			expect(courseForSourceFile("engenharia-agricola.md")).toBe(
				"engenharia-agricola-ambiental",
			);
		});

		it("returns null for institutional files that belong to no course", () => {
			expect(courseForSourceFile("biblioteca.md")).toBeNull();
		});
	});
});
