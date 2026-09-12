export type BookShelf =
  | "Fiction"
  | "Poetry"
  | "Business"
  | "Quant"
  | "Trading"
  | "Networking"
  | "Tech"
  | "Math"
  | "General";

const SHELF_ORDER: BookShelf[] = [
  "Fiction",
  "Poetry",
  "Business",
  "Quant",
  "Trading",
  "Networking",
  "Tech",
  "Math",
  "General",
];

const TYPO_FIXES: Array<[RegExp, string]> = [
  [/\bEnenmy\b/gi, "Enemy"],
  [/\bHerberts\b/gi, "Herbert's"],
];

/** Exact basename (no extension) → preferred display title / authors */
const KNOWN: Record<string, { title: string; authors?: string[] }> = {
  "$100m-leads-how-to-get-strangers-to-want-to-buy-your-stuff": {
    title: "$100M Leads",
    authors: ["Alex Hormozi"],
  },
  "100M Money Models How To Make Money (Alex Hormozi) (z-library.sk, 1lib.sk, z-lib.sk)": {
    title: "100M Money Models",
    authors: ["Alex Hormozi"],
  },
  "100M Offers How to Make Offers So Good People Feel Stupid Saying No (Alex Hormozi) (z-library.sk, 1lib.sk, z-lib.sk)": {
    title: "100M Offers",
    authors: ["Alex Hormozi"],
  },
  "Frank Herberts Dune Saga Collection Books 1 - 6 (Frank Herbert) (z-library.sk, 1lib.sk, z-lib.sk)": {
    title: "Dune Saga Collection (Books 1–6)",
    authors: ["Frank Herbert"],
  },
  "Ego is the Enenmy": {
    title: "Ego Is the Enemy",
    authors: ["Ryan Holiday"],
  },
  "How to Win Friends _ Influence People": {
    title: "How to Win Friends and Influence People",
    authors: ["Dale Carnegie"],
  },
  "Ikigai _ the Japanese secret to a long and happy life": {
    title: "Ikigai",
    authors: ["Héctor García", "Francesc Miralles"],
  },
  "The Almanack of Naval": {
    title: "The Almanack of Naval Ravikant",
    authors: ["Eric Jorgenson"],
  },
  "The psychology of money": {
    title: "The Psychology of Money",
    authors: ["Morgan Housel"],
  },
  "The millionaire fastlane": {
    title: "The Millionaire Fastlane",
    authors: ["MJ DeMarco"],
  },
  "Linchpin- Are You Indispensable": {
    title: "Linchpin: Are You Indispensable?",
    authors: ["Seth Godin"],
  },
  "Jonathan Livingston Seagull": {
    title: "Jonathan Livingston Seagull",
    authors: ["Richard Bach"],
  },
  Rework: {
    title: "Rework",
    authors: ["Jason Fried", "David Heinemeier Hansson"],
  },
  "Trading Psych 101 by Ubaid": {
    title: "Trading Psych 101",
    authors: ["Ubaid"],
  },
  "Mark Douglas - Trading in the Zone (complete and formatted)": {
    title: "Trading in the Zone",
    authors: ["Mark Douglas"],
  },
  "Disciplined Trader": {
    title: "The Disciplined Trader",
    authors: ["Mark Douglas"],
  },
  "Farnood By Jaun Elia(adabizouq.com)": {
    title: "Farnood",
    authors: ["Jaun Elia"],
  },
  "Guman by Jaun Elia(adabizouq.com)": {
    title: "Guman",
    authors: ["Jaun Elia"],
  },
  "Lekin By Jaun Elia(adabizouq.com)": {
    title: "Lekin",
    authors: ["Jaun Elia"],
  },
  "Shayed by JA(adabizouq.com)": {
    title: "Shayed",
    authors: ["Jaun Elia"],
  },
  "Inside the black box_ the simple truth about quantitative -- Narang, Rishi K_ -- Wiley finance series, Second edition, Hoboken, New Jersey, -- John": {
    title: "Inside the Black Box",
    authors: ["Rishi K. Narang"],
  },
  "The Man Who Solved the Market- How Jim Simons Launched the Quant Revolution": {
    title: "The Man Who Solved the Market",
    authors: ["Gregory Zuckerman"],
  },
  "The handbook of fixed income securities. (2021) - Fabozzi": {
    title: "The Handbook of Fixed Income Securities",
    authors: ["Frank J. Fabozzi"],
  },
  "Why Machines Learn The Elegant Math Behind Modern AI (2024, Penguin Publishing Group)- Anil Ananthaswamy": {
    title: "Why Machines Learn",
    authors: ["Anil Ananthaswamy"],
  },
  "Advanced Futures Trading Strategies (2023) - Robert Carver": {
    title: "Advanced Futures Trading Strategies",
    authors: ["Robert Carver"],
  },
  "Systematic Trading_ A unique new method for designing trading and investing systems (2015, Harriman House)": {
    title: "Systematic Trading",
    authors: ["Robert Carver"],
  },
  "The Elements of Quantitative Investing (2025) - Giuseppe A. Paleologo": {
    title: "The Elements of Quantitative Investing",
    authors: ["Giuseppe A. Paleologo"],
  },
  "Advanced Portfolio Management_ A Quant′s Guide for Fundamental Investors - Giuseppe A. Paleologo (2021, Wiley)": {
    title: "Advanced Portfolio Management",
    authors: ["Giuseppe A. Paleologo"],
  },
  "Stochastic Calculus for Finance I The Binomial Asset Pricing Model (Steven E. Shreve)": {
    title: "Stochastic Calculus for Finance I",
    authors: ["Steven E. Shreve"],
  },
  "Stochastic calculus for finance II Continuous time models (Steven E. Shreve)": {
    title: "Stochastic Calculus for Finance II",
    authors: ["Steven E. Shreve"],
  },
  "CCNA 200-301 Official Cert Guide Volume 1, 2nd (Wendell Odom) (z-library.sk, 1lib.sk, z-lib.sk)": {
    title: "CCNA 200-301 Official Cert Guide, Volume 1",
    authors: ["Wendell Odom"],
  },
  "CCNA 200-301 Official Cert Guide Volume 2, Second Edition (Wendell Odom, Jason Gooley, David Hucaby) (z-library.sk, 1lib.sk, z-lib.sk)": {
    title: "CCNA 200-301 Official Cert Guide, Volume 2",
    authors: ["Wendell Odom", "Jason Gooley", "David Hucaby"],
  },
  "Exam Ref Az-104 Microsoft Azure Administrator (Charles Pluta) (z-library.sk, 1lib.sk, z-lib.sk)": {
    title: "Exam Ref AZ-104 Microsoft Azure Administrator",
    authors: ["Charles Pluta"],
  },
  "Exam Ref AZ-700 Designing and Implementing Microsoft Azure Networking Solutions (Charles Pluta) (z-library.sk, 1lib.sk, z-lib.sk)": {
    title: "Exam Ref AZ-700 Azure Networking Solutions",
    authors: ["Charles Pluta"],
  },
  "Machine Trading_ Deploying Computer Algorithms to Conquer the Markets -Ernest P. Chan (2017, Wiley)": {
    title: "Machine Trading",
    authors: ["Ernest P. Chan"],
  },
  "Monte Carlo Methods in Financial Engineering (2003, Springer)-Paul Glasserman": {
    title: "Monte Carlo Methods in Financial Engineering",
    authors: ["Paul Glasserman"],
  },
  "Python for Finance_ Analyze Big Financial Data (2015, O'Reilly Media) - Hilpisch, Yves J": {
    title: "Python for Finance",
    authors: ["Yves Hilpisch"],
  },
  "Econometrics by Bruce E. Hansen ": {
    title: "Econometrics",
    authors: ["Bruce E. Hansen"],
  },
  "Dynamic Hedging_ Managing Vanilla and Exotic Options (1997, Wiley)": {
    title: "Dynamic Hedging",
    authors: ["Nassim Nicholas Taleb"],
  },
  "LLM Engineer’s Handbook (Paul Iusztin, Maxime Labonne)": {
    title: "LLM Engineer's Handbook",
    authors: ["Paul Iusztin", "Maxime Labonne"],
  },
  "The Art of Crafting Prompts Guide": {
    title: "The Art of Crafting Prompts",
  },
  "How to become A Quant in 2025": {
    title: "How to Become a Quant in 2025",
  },
  "Mathematical Thinking - For People Who Hate Math_ Level Up Your Analytical and Creative Thinking Skills. Excel at Problem-Solvi (2021, ARB Publications)Albert Rutherford": {
    title: "Mathematical Thinking for People Who Hate Math",
    authors: ["Albert Rutherford"],
  },
  "Mathematical Thinking - for People Who Hate Math_ Level Up Your Analytical and Creative Thinking Skills. Excel at Problem-Solving by Albert Rutherford (2021, ARB Publications)": {
    title: "Mathematical Thinking for People Who Hate Math",
    authors: ["Albert Rutherford"],
  },
  "Mathematical Thinking - for People Who Hate Math Level Up Your Analytical and Creative Thinking Skills Excel at Problem-Solving and Decision-Making": {
    title: "Mathematical Thinking for People Who Hate Math",
    authors: ["Albert Rutherford"],
  },
};

/** Collapse name variants so Hormozi / Paleologo / Carver club correctly */
const AUTHOR_CANON: Array<[RegExp, string]> = [
  [/^alex\s+hormozi$/i, "Alex Hormozi"],
  [/^hormozi$/i, "Alex Hormozi"],
  [/^giuseppe(\s+a\.?)?\s+paleologo$/i, "Giuseppe A. Paleologo"],
  [/^paleologo$/i, "Giuseppe A. Paleologo"],
  [/^robert\s+carver$/i, "Robert Carver"],
  [/^carver$/i, "Robert Carver"],
  [/^mark\s+douglas$/i, "Mark Douglas"],
  [/^jaun\s+elia$/i, "Jaun Elia"],
  [/^j\.?\s*a\.?$/i, "Jaun Elia"],
  [/^steven(\s+e\.?)?\s+shreve$/i, "Steven E. Shreve"],
  [/^wendell\s+odom$/i, "Wendell Odom"],
  [/^charles\s+pluta$/i, "Charles Pluta"],
  [/^frank\s+herbert$/i, "Frank Herbert"],
  [/^rishi(\s+k\.?)?\s+narang$/i, "Rishi K. Narang"],
  [/^frank(\s+j\.?)?\s+fabozzi$/i, "Frank J. Fabozzi"],
  [/^paul\s+wilmott$/i, "Paul Wilmott"],
  [/^ernest(\s+p\.?)?\s+chan$/i, "Ernest P. Chan"],
  [/^yves(\s+j\.?)?\s+hilpisch$/i, "Yves Hilpisch"],
  [/^albert\s+rutherford$/i, "Albert Rutherford"],
  [/^nassim(\s+nicholas)?\s+taleb$/i, "Nassim Nicholas Taleb"],
  [/^ryan\s+holiday$/i, "Ryan Holiday"],
  [/^dale\s+carnegie$/i, "Dale Carnegie"],
  [/^morgan\s+housel$/i, "Morgan Housel"],
  [/^seth\s+godin$/i, "Seth Godin"],
];

export function canonicalAuthor(name: string): string {
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (!cleaned) return cleaned;
  for (const [re, canon] of AUTHOR_CANON) {
    if (re.test(cleaned)) return canon;
  }
  return cleaned;
}

export function primaryAuthor(authors: string[]): string {
  if (!authors.length) return "Unknown author";
  return canonicalAuthor(authors[0]);
}

export function shelfOrder() {
  return SHELF_ORDER;
}

export function isGarbageTitle(title: string): boolean {
  const t = title.trim();
  if (!t || t.length < 3) return true;
  if (/^[0-9a-f]{8,}$/i.test(t)) return true;
  if (/^\d{4,}$/.test(t)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f-]{10,}$/i.test(t)) return true;
  if (/^[0-9a-f]{6,}[0-9a-f-]{0,20}$/i.test(t) && /[0-9]/.test(t) && !/[aeiou ]/i.test(t)) {
    return true;
  }
  // UUID / content-hash style with few letters
  const letters = (t.match(/[a-z]/gi) || []).length;
  const hexish = (t.match(/[0-9a-f]/gi) || []).length;
  if (t.length >= 8 && hexish / t.length > 0.85 && letters < 4) return true;
  return false;
}

function stripExtension(name: string) {
  return name.replace(/\.(epub|pdf|mobi|azw3|fb2|cbz)$/i, "");
}

function applyTypos(s: string) {
  let out = s;
  for (const [re, rep] of TYPO_FIXES) out = out.replace(re, rep);
  return out;
}

function cleanBasename(raw: string) {
  let s = stripExtension(raw);
  s = s.replace(/\(z-library\.sk[^)]*\)/gi, "");
  s = s.replace(/\(adabizouq\.com\)/gi, "");
  s = s.replace(/\[([^\]]+)\]/g, "$1");
  s = s.replace(/_/g, " ");
  s = s.replace(/\s{2,}/g, " ");
  s = s.replace(/\s+-\s+/g, " — ");
  s = s.replace(/\s+,/g, ",");
  s = s.trim().replace(/^[\s.\-_]+|[\s.\-_]+$/g, "");
  return applyTypos(s);
}

function titleCaseLight(s: string) {
  // Keep intentional casing mostly; only fix all-lowercase short titles
  if (s === s.toLowerCase() && s.length < 60) {
    return s.replace(/\b([a-z])/g, (m) => m.toUpperCase());
  }
  return s;
}

export function parseFileNameMeta(fileName: string): {
  title: string;
  authors: string[];
} {
  const base = fileName.split(/[/\\]/).pop() || fileName;
  const key = stripExtension(base);
  const known = KNOWN[key];
  if (known) {
    return { title: known.title, authors: known.authors || [] };
  }

  let cleaned = cleanBasename(base);
  let authors: string[] = [];

  // "Title (Author Name)" leftover author parens
  const parenAuthor = cleaned.match(/\(([^)]+)\)\s*$/);
  if (parenAuthor && /[A-Za-z]{2,}/.test(parenAuthor[1]) && parenAuthor[1].split(" ").length <= 5) {
    const maybe = parenAuthor[1].trim();
    if (!/^\d{4}$/.test(maybe) && !/wiley|springer|oreilly|apress|mit press|penguin|harriman|no starch|mcgraw/i.test(maybe)) {
      authors = [maybe.replace(/\s*,\s*/g, ", ")];
      cleaned = cleaned.slice(0, parenAuthor.index).trim();
    }
  }

  // "Title — Author" or "Title - Author"
  const dash = cleaned.match(/^(.*?)(?:\s+[—–-]\s+)(.+)$/);
  if (dash) {
    const right = dash[2].trim();
    // Author-like if short and not a subtitle with many words about the topic
    if (
      right.length < 60 &&
      !/\d{4}/.test(right) &&
      (/,/.test(right) || /^(by\s+)/i.test(right) || right.split(/\s+/).length <= 5)
    ) {
      authors = [right.replace(/^by\s+/i, "")];
      cleaned = dash[1].trim();
    }
  }

  const byMatch = cleaned.match(/^(.*?)\s+by\s+(.+)$/i);
  if (byMatch && byMatch[2].split(/\s+/).length <= 6) {
    cleaned = byMatch[1].trim();
    authors = [byMatch[2].trim()];
  }

  // Drop trailing publisher crumbs
  cleaned = cleaned
    .replace(/\s*\(\d{4}[^)]*\)\s*$/g, "")
    .replace(/\s*[—–-]\s*(Wiley|Springer|O'Reilly|Apress|MIT Press).*$/i, "")
    .trim();

  cleaned = titleCaseLight(cleaned);
  // Prefer first clause before overly long subtitle
  if (cleaned.length > 90 && cleaned.includes(":")) {
    cleaned = cleaned.split(":")[0].trim();
  }

  return { title: cleaned || cleanBasename(base), authors };
}

export function resolveDisplayTitle(
  metaTitle: string,
  fileName: string,
): { title: string; authors: string[]; usedFileName: boolean } {
  const fromFile = parseFileNameMeta(fileName);
  const base = (fileName.split(/[/\\]/).pop() || fileName).replace(
    /\.(epub|pdf|mobi|azw3|fb2|cbz)$/i,
    "",
  );
  // Always honor curated filename maps
  if (KNOWN[base]) {
    return { ...fromFile, usedFileName: true };
  }
  if (!metaTitle || isGarbageTitle(metaTitle)) {
    return { ...fromFile, usedFileName: true };
  }
  const meta = applyTypos(metaTitle.trim());
  if (isGarbageTitle(meta) || (meta.length < 8 && fromFile.title.length > meta.length + 10)) {
    return { ...fromFile, usedFileName: true };
  }
  // Prefer cleaned filename when metadata is a near-raw dump of the messy path
  if (
    /\(z-library|adabizouq|1lib\.sk/i.test(meta) ||
    meta.length > fromFile.title.length + 40
  ) {
    return { ...fromFile, usedFileName: true };
  }
  return {
    title: meta,
    authors: fromFile.authors,
    usedFileName: false,
  };
}

export function inferShelf(fileName: string, title: string, authors: string[]): BookShelf {
  const path = fileName.toLowerCase();
  const blob = `${path} ${title} ${authors.join(" ")}`.toLowerCase();

  if (path.includes("jaun elia") || /jaun elia|farnood|guman|lekin|shayed/.test(blob)) {
    return "Poetry";
  }
  if (path.includes("psych books") || /trading in the zone|disciplined trader|trading psych|price action/.test(blob)) {
    return "Trading";
  }
  if (path.includes("quant books") || /quant|stochastic|portfolio|hedging|option volatility|monte carlo|fabozzi|wilmott|carver|paleologo|narang|simons|systematic trading|expected returns|glasserman|shreve/.test(blob)) {
    return "Quant";
  }
  if (/ccna|azure|comptia|fortigate|network engineer|az-104|az-700|security\+/.test(blob)) {
    return "Networking";
  }
  if (/dune|jonathan livingston seagull/.test(blob)) {
    return "Fiction";
  }
  if (/hormozi|100m|rework|ikigai|naval|linchpin|ego is the enemy|carnegie|millionaire fastlane|psychology of money/.test(blob)) {
    return "Business";
  }
  if (/python|git|llm|deep learning|machine learning|prompt|data analysis|jupyter/.test(blob)) {
    return "Tech";
  }
  if (/mathematics|discrete math|ergodic|bayesian|statistics|time series/.test(blob)) {
    return "Math";
  }
  if (path.includes("/general/") || path.includes("general\\")) {
    return "Business";
  }
  return "General";
}

export function formatBytes(size: number) {
  if (size < 1048576) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1048576).toFixed(1)} MB`;
}

/** Stable accent for coverless spines */
export function spineHue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  // Avoid purple-ish hues; keep earthy paper tones
  const hues = [18, 28, 38, 150, 165, 200, 210, 25, 45];
  return hues[h % hues.length];
}
