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
//
// Todo chunk também recebe o título do documento (# ...) no topo: os arquivos
// de curso têm seções idênticas ("## Coordenação"), e sem o título um chunk
// "Coordenador: Fulano" chega ao modelo sem dizer de qual curso ele é — o
// modelo então recusa responder (regra de não misturar cursos no prompt).
export function chunkMarkdown(text: string, maxSize = 1500): string[] {
	const titleMatch = text.match(/^# .*$/m);
	const title = titleMatch ? titleMatch[0] : null;

	// Quebra antes de toda linha que começa um cabeçalho de nível 1 a 3
	// ("# ", "## ", "### "), sem consumir o cabeçalho (lookahead).
	const sections = text
		.split(/\n(?=#{1,3} )/)
		.filter((s) => s.trim().length > 0);

	const chunks: string[] = [];
	for (const section of sections) {
		const sectionChunks: string[] = [];
		if (section.length <= maxSize) {
			sectionChunks.push(section);
		} else {
			const headingMatch = section.match(/^#{1,3} .*$/m);
			const heading = headingMatch ? `${headingMatch[0]}\n\n` : "";
			const subChunks = chunkText(section, maxSize, 200);
			for (const [idx, sub] of subChunks.entries()) {
				sectionChunks.push(idx === 0 ? sub : `${heading}${sub}`);
			}
		}

		for (const chunk of sectionChunks) {
			chunks.push(
				title && !chunk.startsWith(title) ? `${title}\n\n${chunk}` : chunk,
			);
		}
	}

	return chunks;
}
