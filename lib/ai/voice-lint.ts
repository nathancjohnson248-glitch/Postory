/**
 * Stock phrases that make a post read as AI-written. Checked locally (no
 * model call) on every draft; anything found becomes a review warning, and the
 * checker pass is asked to rewrite it.
 */
const CLICHES: [RegExp, string][] = [
  [/\b(excited|thrilled|delighted|stoked) to (announce|share|introduce|unveil)\b/i, "excited to announce"],
  [/\bexciting news\b/i, "exciting news"],
  [/\bhere'?s the thing\b/i, "here's the thing"],
  [/\bin today'?s (fast[- ]paced|digital|ever[- ]changing) world\b/i, "in today's fast-paced world"],
  [/\bwhether you'?re an? \w+/i, "whether you're a…"],
  [/\bit'?s not just (an? )?\w+[,.]? it'?s\b/i, "it's not just X, it's Y"],
  [/\bgame[- ]chang(er|ing)\b/i, "game-changer"],
  [/\brevolution(ary|ize|ise)\b/i, "revolutionary"],
  [/\bsupercharg(e|ed|ing)\b/i, "supercharge"],
  [/\bunlock(s|ing)?\b/i, "unlock"],
  [/\blevel up\b/i, "level up"],
  [/\bseamless(ly)?\b/i, "seamless"],
  [/\bempower(s|ing)?\b/i, "empower"],
  [/\bleverag(e|es|ing)\b/i, "leverage"],
  [/\bdelv(e|es|ing)\b/i, "delve"],
  [/\bcutting[- ]edge\b/i, "cutting-edge"],
  [/\b(we'?re|i'?m) humbled\b/i, "humbled"],
];

export function findCliches(text: string): string[] {
  const found = CLICHES.filter(([re]) => re.test(text)).map(([, label]) => label);
  const dashes = (text.match(/—/g) ?? []).length;
  if (dashes > 1) found.push(`${dashes} em dashes`);
  return found;
}

export const CLICHE_LIST = CLICHES.map(([, label]) => `"${label}"`).join(", ");

/**
 * The owner's hard preferences, applied in code rather than trusted to the
 * model: "never" means none, whatever the model wrote.
 */
export function enforcePreferences(text: string, prefs: { emoji: string; hashtags: string }) {
  let out = text;
  if (prefs.hashtags === "never") out = out.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "$1");
  if (prefs.emoji === "never") out = out.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "");
  if (out === text) return text;
  // Tidy what removal leaves behind: trailing spaces, empty last lines, doubled spaces.
  return out
    .split("\n")
    .map((l) => l.replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
