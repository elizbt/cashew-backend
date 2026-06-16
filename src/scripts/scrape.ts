import * as fs from "node:fs";
import * as path from "node:path";
import { chromium } from "playwright";
import TurndownService from "turndown";

async function scrape(url: string) {
	console.log(`\n--- Iniciando captura via Playwright: ${url} ---`);

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
	});

	const page = await context.newPage();

	try {
		console.log("Navegando até a página...");
		await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

		await page.evaluate(() => {
			const selectors = [
				"nav",
				"header",
				"footer",
				"script",
				"style",
				"noscript",
				".menu",
				".sidebar",
				"#header",
				"#footer",
				".ads",
				".social-share",
			];
			for (const s of selectors) {
				const elements = document.querySelectorAll(s);
				for (const el of elements) {
					el.remove();
				}
			}
		});

		const contentHtml = await page.content();

		console.log("Convertendo para Markdown...");
		const turndownService = new TurndownService({
			headingStyle: "atx",
			codeBlockStyle: "fenced",
		});

		turndownService.addRule("remove-images", {
			filter: ["img"],
			replacement: () => "",
		});

		let markdown = turndownService.turndown(contentHtml);

		markdown = markdown
			.replace(/\n{3,}/g, "\n\n")
			.trim();

		if (!markdown) {
			throw new Error("O conteúdo gerado está vazio.");
		}

		const fileName = `captura-${Date.now()}.md`;
		const outputPath = path.join(process.cwd(), "src", "data", fileName);

		fs.writeFileSync(outputPath, markdown);

		console.log(`\n✅ Sucesso! Conteúdo salvo em: ${outputPath}`);
		console.log(
			`Dica: Agora você pode rodar: npm run ingest:local ${path.join("src", "data", fileName)}`,
		);
	} catch (error) {
		console.error("❌ Erro durante a captura:", error);
	} finally {
		await browser.close();
	}
}

const url = process.argv[2];
if (!url) {
	console.error("Uso: npm run scrape <URL>");
	process.exit(1);
}

scrape(url);
