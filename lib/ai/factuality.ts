/**
 * Lightweight factual guardrail. The prompt forbids invented figures; this
 * checks the output anyway. Any number in a generated post that doesn't
 * appear in the story or the business memory is flagged for the reviewer.
 */

const NUMBER_PATTERN = /(?<![\w.])[$€£]?\d[\d,]*(?:\.\d+)?(?:[%x×kKmM])?(?![\w])/g;

function normalise(token: string) {
  return token.replace(/[$€£,]/g, "").replace(/[%x×]$/i, "").toLowerCase();
}

function numbersIn(text: string) {
  return new Set((text.match(NUMBER_PATTERN) ?? []).map(normalise).filter((n) => n.length > 0));
}

export function findUnsupportedNumbers(generated: string, ...sources: string[]): string[] {
  const allowed = new Set<string>();
  for (const source of sources) for (const n of numbersIn(source)) allowed.add(n);
  const unsupported: string[] = [];
  for (const raw of generated.match(NUMBER_PATTERN) ?? []) {
    const n = normalise(raw);
    if (!n || allowed.has(n)) continue;
    // Expand "1.2k" style abbreviations before comparing.
    const abbreviated = /^(\d+(?:\.\d+)?)([km])$/i.exec(raw.replace(/[$€£,]/g, ""));
    if (abbreviated) {
      const value = Number(abbreviated[1]) * (abbreviated[2].toLowerCase() === "k" ? 1_000 : 1_000_000);
      if (allowed.has(String(value))) continue;
    }
    if (!unsupported.includes(raw)) unsupported.push(raw);
  }
  return unsupported;
}
