export function chunkText(text: string, size = 1500, overlap = 200): string[] {
	// Cada passo avança size - overlap caracteres; com overlap >= size o
	// índice nunca avança e o loop não termina.
	if (overlap >= size) {
		throw new RangeError(
			`overlap (${overlap}) precisa ser menor que size (${size})`,
		);
	}

	const chunks: string[] = [];
	let i = 0;
	while (i < text.length) {
		const end = Math.min(i + size, text.length);
		chunks.push(text.substring(i, end));
		if (end === text.length) break;
		i += size - overlap;
	}
	return chunks;
}

// Chunking "consciente" de markdown: primeiro separa por seções (## ...) pra
// não cortar uma informação (ex: "Coordenador: Fulano") no meio da frase.
// Seções que ainda assim ficarem grandes demais são sub-divididas pelo
// chunker de tamanho fixo, mantendo o cabeçalho da seção em cada pedaço.
export function chunkMarkdown(text: string, maxSize = 1500): string[] {
	// Quebra antes de toda linha que começa um cabeçalho de nível 1 a 3
	// ("# ", "## ", "### "), sem consumir o cabeçalho (lookahead).
	const sections = text
		.split(/\n(?=#{1,3} )/)
		.filter((s) => s.trim().length > 0);

	const chunks: string[] = [];
	for (const section of sections) {
		if (section.length <= maxSize) {
			chunks.push(section);
			continue;
		}

		const headingMatch = section.match(/^#{1,3} .*$/m);
		const heading = headingMatch ? `${headingMatch[0]}\n\n` : "";
		const subChunks = chunkText(section, maxSize, 200);
		for (const [idx, sub] of subChunks.entries()) {
			chunks.push(idx === 0 ? sub : `${heading}${sub}`);
		}
	}

	return chunks;
}
