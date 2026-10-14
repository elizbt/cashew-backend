import { describe, expect, it } from "vitest";
import { chunkMarkdown, chunkText } from "./text-chunker";

describe("lib/text-chunker", () => {
	describe("chunkText", () => {
		it("returns a single chunk when the text fits", () => {
			expect(chunkText("abc", 10, 2)).toEqual(["abc"]);
		});

		it("splits long text into overlapping fixed-size chunks", () => {
			expect(chunkText("abcdefghij", 4, 1)).toEqual(["abcd", "defg", "ghij"]);
		});

		it("rejects an overlap that is not smaller than the chunk size (would never advance)", () => {
			expect(() => chunkText("abcdef", 2, 2)).toThrow(RangeError);
		});

		it("returns no chunks for empty text", () => {
			expect(chunkText("", 10, 2)).toEqual([]);
		});
	});

	describe("chunkMarkdown", () => {
		it("keeps each small section as its own chunk, prefixed with the document title", () => {
			const text = "# Curso\nIntro\n## Coordenação\nCoordenador: Fulano";

			expect(chunkMarkdown(text, 100)).toEqual([
				"# Curso\nIntro",
				"# Curso\n\n## Coordenação\nCoordenador: Fulano",
			]);
		});

		it("does not duplicate the title in the section that already starts with it", () => {
			const [first] = chunkMarkdown("# Doc\nIntro\n## A\nconteúdo", 100);

			expect(first.match(/^# /gm)).toHaveLength(1);
		});

		it("keeps the title and section heading on every piece of an oversized section", () => {
			const doc = `# Doc\n\n## Seção longa\n${"x".repeat(900)}`;

			const chunks = chunkMarkdown(doc, 300);

			expect(chunks.length).toBeGreaterThan(2);
			for (const chunk of chunks.slice(1)) {
				expect(chunk.startsWith("# Doc\n\n## Seção longa")).toBe(true);
			}
		});

		it("leaves chunks untouched when the document has no title", () => {
			expect(chunkMarkdown("## A\nconteúdo a\n## B\nconteúdo b", 100)).toEqual([
				"## A\nconteúdo a",
				"## B\nconteúdo b",
			]);
		});

		it("does not split on deeper headings (####) or on '#' mid-line", () => {
			const text = "## Seção\n#### Detalhe\nitem #1";

			expect(chunkMarkdown(text, 100)).toEqual([text]);
		});

		it("repeats the section heading on every sub-chunk of an oversized section", () => {
			const body = "x".repeat(500);
			const text = `## Vagas\n${body}`;

			const chunks = chunkMarkdown(text, 300);

			expect(chunks.length).toBeGreaterThan(1);
			expect(chunks[0].startsWith("## Vagas\n")).toBe(true);
			for (const chunk of chunks.slice(1)) {
				expect(chunk.startsWith("## Vagas\n\n")).toBe(true);
			}
		});

		it("falls back to plain sub-chunks when an oversized block has no heading", () => {
			const text = "y".repeat(500);

			const chunks = chunkMarkdown(text, 300);

			expect(chunks.length).toBeGreaterThan(1);
			for (const chunk of chunks) {
				expect(chunk.startsWith("#")).toBe(false);
			}
		});

		it("drops whitespace-only sections", () => {
			expect(chunkMarkdown("\n\n   \n", 100)).toEqual([]);
		});
	});
});
