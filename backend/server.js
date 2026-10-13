
"use strict";

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const GROQ_MODEL = "openai/gpt-oss-20b";
const REQUIRED_COUNT = 3;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({
    status: "online",
    message: "OPITECH evidence-based recommendation backend",
    marketplaces: ["Amazon India", "Flipkart"],
    recommendationsPerRequest: REQUIRED_COUNT,
    rejectsAccessoriesAndServices: true,
    relevanceRanking: true,
    fallbackSearchEnabled: true
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    groqConfigured: Boolean(GROQ_API_KEY),
    tavilyConfigured: Boolean(TAVILY_API_KEY)
  });
});

async function fetchWithTimeout(url, options = {}, ms = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function minimumPrice(productType) {
  const type = normalizeText(productType);

  if (/laptop|desktop|pc/.test(type)) return 10000;
  if (/headphone|earbud|earphone|speaker/.test(type)) return 300;
  if (/monitor/.test(type)) return 2500;
  if (/tv|television/.test(type)) return 5000;
  if (/camera/.test(type)) return 3000;
  if (/watch/.test(type)) return 1000;
  if (/tablet|ipad/.test(type)) return 4000;

  return 5000;
}

function extractPrice(text, productType) {
  const value = String(text || "");
  const minimum = minimumPrice(productType);

  const patterns = [
    /₹\s*([0-9,]{3,10})/gi,
    /\bRs\.?\s*([0-9,]{3,10})/gi,
    /\bINR\s*([0-9,]{3,10})/gi
  ];

  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      const amount = Number(match[1].replace(/,/g, ""));
      const start = Math.max(0, match.index - 100);
      const end = Math.min(
        value.length,
        match.index + match[0].length + 100
      );

      const context = value.slice(start, end).toLowerCase();

      if (
        /\bemi\b|per month|\/month|monthly|exchange bonus|down payment/.test(context)
      ) {
        continue;
      }

      if (
        Number.isFinite(amount) &&
        amount >= minimum &&
        amount <= 10000000
      ) {
        return amount;
      }
    }
  }

  return null;
}

function isAccessoryOrService(title) {
  const text = normalizeText(title);

  const blockedPatterns = [
    /\bextended warranty\b/,
    /\bwarranty plan\b/,
    /\bprotection plan\b/,
    /\bmobile insurance\b/,
    /\bphone insurance\b/,
    /\bscreen protection plan\b/,
    /\binstallation service\b/,
    /\brepair service\b/,
    /\bservice charge\b/,
    /\bsubscription\b/,
    /\bmembership\b/,
    /\bcare pack\b/,
    /\bcare plan\b/,
    /\baccidental damage protection\b/,
    /\bcharging cable\b/,
    /\bcharger\b/,
    /\badapter\b/,
    /\bpower bank\b/,
    /\bphone case\b/,
    /\bmobile cover\b/,
    /\bback cover\b/,
    /\bscreen guard\b/,
    /\btempered glass\b/,
    /\bscreen protector\b/,
    /\bdisplay replacement\b/,
    /\bbattery replacement\b/,
    /\bspare part\b/,
    /\bremote control\b/,
    /\bwall mount\b/,
    /\bprotective case\b/,
    /\bkeyboard cover\b/,
    /\bcarrying case\b/,
    /\brefurbishment service\b/,
    /\bskin sticker\b/,
    /\bcompatible with\b/,
    /\bfor iphone\b/,
    /\bfor samsung galaxy\b/,
    /\bfor oneplus\b/
  ];

  return blockedPatterns.some(pattern => pattern.test(text));
}

function isProductUrl(url, marketplace) {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") return false;

    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (marketplace === "amazon") {
      const validHost =
        host === "amazon.in" || host.endsWith(".amazon.in");

      return validHost && (
        /\/dp\/[a-z0-9]{10}(?:\/|$)/i.test(path) ||
        /\/gp\/product\/[a-z0-9]{10}(?:\/|$)/i.test(path) ||
        /\/gp\/aw\/d\/[a-z0-9]{10}(?:\/|$)/i.test(path)
      );
    }

    if (marketplace === "flipkart") {
      const validHost =
        host === "flipkart.com" || host.endsWith(".flipkart.com");

      return validHost && /\/p\/itm[a-z0-9]+/i.test(path);
    }

    return false;
  } catch {
    return false;
  }
}

function looksLikeGuide(title, content = "") {
  const text = `${title} ${content}`.toLowerCase();

  return [
    /\bbuying guide\b/,
    /\bbuying guides\b/,
    /\bhow to choose\b/,
    /\bthings to know before buying\b/,
    /\bproduct comparison guide\b/,
    /\breview roundup\b/,
    /\bnews and updates\b/,
    /\bcategory page\b/,
    /\bbest \d+ .* (products|laptops|phones|headphones|tvs?)\b/,
    /\btop \d+ .* (products|laptops|phones|headphones|tvs?)\b/
  ].some(pattern => pattern.test(text));
}

function categoryFor(productType) {
  const type = normalizeText(productType);

  if (/phone|mobile/.test(type)) return "phone";
  if (/laptop|notebook/.test(type)) return "laptop";
  if (/television|\btv\b/.test(type)) return "tv";
  if (/tablet|ipad/.test(type)) return "tablet";
  if (/speaker|soundbar/.test(type)) return "speaker";

  if (/headphone|earbud|earphone|headset/.test(type)) {
    return "headphone";
  }

  if (/monitor|computer screen/.test(type)) return "monitor";
  if (/smartwatch|smart watch/.test(type)) return "smartwatch";
  if (/camera|dslr|mirrorless/.test(type)) return "camera";

  return null;
}

const CATEGORY_TERMS = {
  phone: [
    "smartphone", "mobile phone", "phone", "iphone",
    "galaxy", "redmi", "poco", "pixel", "oneplus",
    "realme", "oppo", "vivo", "motorola",
    "nothing phone", "cmf phone", "infinix", "tecno",
    "iqoo", "itel", "lava", "honor", "huawei"
  ],
  laptop: [
    "laptop", "notebook", "macbook", "thinkpad",
    "vivobook", "ideapad", "pavilion", "inspiron",
    "aspire", "latitude", "zenbook", "chromebook",
    "predator", "rog strix", "omen"
  ],
  tv: [
    "television", "smart tv", "qled", "oled",
    "led tv", "google tv", "android tv"
  ],
  tablet: [
    "tablet", "ipad", "galaxy tab",
    "xiaomi pad", "oneplus pad", "lenovo tab"
  ],
  speaker: [
    "speaker", "soundbar", "bluetooth speaker",
    "portable speaker"
  ],
  headphone: [
    "headphone", "headset", "earbud", "earbuds",
    "airpods", "earphones", "tws"
  ],
  monitor: [
    "monitor", "computer display", "computer screen"
  ],
  smartwatch: [
    "smartwatch", "smart watch", "galaxy watch", "apple watch"
  ],
  camera: [
    "camera", "mirrorless", "dslr", "action camera"
  ]
};

function matchesCategory(title, productType) {
  const category = categoryFor(productType);

  if (!category) return true;

  const text = normalizeText(title);

  return CATEGORY_TERMS[category].some(term =>
    text.includes(normalizeText(term))
  );
}

function isAnyBrand(brand) {
  return !brand ||
    ["any", "any brand", "other"].includes(normalizeText(brand));
}

function matchesBrand(title, requestedBrand) {
  const requested = normalizeText(requestedBrand);

  if (isAnyBrand(requested)) return true;

  const product = normalizeText(title);

  const aliases = {
    samsung: ["samsung", "galaxy"],
    xiaomi: ["xiaomi", "redmi", "poco"],
    redmi: ["redmi"],
    poco: ["poco"],
    apple: ["apple", "iphone", "macbook", "ipad", "airpods"],
    google: ["google pixel", "pixel"],
    oneplus: ["oneplus"],
    realme: ["realme"],
    oppo: ["oppo"],
    vivo: ["vivo"],
    motorola: ["motorola", "moto"],
    nothing: ["nothing phone", "cmf phone"],
    asus: ["asus", "rog"],
    lenovo: ["lenovo", "thinkpad", "ideapad", "legion"],
    dell: ["dell", "inspiron", "xps", "latitude"],
    acer: ["acer", "aspire", "predator"],
    hp: ["hewlett packard", "hp pavilion", "hp omen"],
    honor: ["honor"],
    huawei: ["huawei"],
    boat: ["boat"],
    sony: ["sony"],
    smartron: ["smartron"],
    iqoo: ["iqoo"],
    infinix: ["infinix"],
    tecno: ["tecno"],
    lava: ["lava"]
  };

  const terms = aliases[requested] || [requested];

  return terms.some(term => {
    const normalizedTerm = normalizeText(term);

    return normalizedTerm &&
      (` ${product} `).includes(` ${normalizedTerm} `);
  });
}

function hasConcreteProductTitle(title, productType) {
  const text = normalizeText(title);
  const category = categoryFor(productType);

  if (!text || text.length < 12) return false;
  if (looksLikeGuide(title)) return false;

  const vagueTitles = [
    /^best .* phone/,
    /^top .* phone/,
    /^mobile phones? under/,
    /^laptops? under/,
    /^smartphones? under/,
    /^latest .* products/
  ];

  if (vagueTitles.some(pattern => pattern.test(text))) return false;

  // Require a recognizable product family, not just a category keyword.
  if (
    category &&
    !CATEGORY_TERMS[category].some(term =>
      text.includes(normalizeText(term))
    )
  ) {
    return false;
  }

  // Avoid listings that are mostly marketing copy with no usable model clue.
  const words = text.split(" ").filter(Boolean);
  if (words.length < 3) return false;

  return true;
}

function validProduct(item, marketplace, input) {
  if (!item || !item.title || !item.url) return false;

  if (isAccessoryOrService(item.title)) return false;
  if (!isProductUrl(item.url, marketplace)) return false;
  if (looksLikeGuide(item.title, item.content)) return false;

  if (!matchesCategory(item.title, input.productType || "Phone")) {
    return false;
  }

  if (!hasConcreteProductTitle(item.title, input.productType || "Phone")) {
    return false;
  }

  return true;
}

async function tavilySearch(query, domain) {
  if (!TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is missing in Render.");
  }

  const response = await fetchWithTimeout(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "basic",
        max_results: 10,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        include_domains: [domain]
      })
    }
  );

  const raw = await response.text();
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Marketplace search returned invalid data.");
  }

  if (!response.ok) {
    throw new Error(`Marketplace search failed (${response.status}).`);
  }

  return (Array.isArray(data.results) ? data.results : [])
    .filter(item => item && item.url)
    .map(item => ({
      title: String(item.title || "").slice(0, 250),
      url: String(item.url || ""),
      content: String(item.content || "")
        .replace(/\s+/g, " ")
        .slice(0, 1500)
    }));
}

function makeQueries(input, broaden = false) {
  const type = String(input.productType || "Phone");

  const brand = !broaden && !isAnyBrand(input.brand)
    ? String(input.brand)
    : "";

  const uses = Array.isArray(input.uses)
    ? input.uses.slice(0, 5).join(" ")
    : "";

  const budget = Number(input.budget);
  const common = [
    type,
    brand,
    uses,
    `under Rs ${budget}`,
    "India"
  ].filter(Boolean).join(" ");

  return [
    `${common} exact product model price`,
    `${type} ${brand} price Rs ${budget} site:amazon.in/dp`,
    `${type} ${brand} price Rs ${budget} site:flipkart.com`,
    `${type} ${brand} model specifications price India`
  ]
    .map(query => query.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function deduplicate(items) {
  const seen = new Set();

  return items.filter(item => {
    try {
      const url = new URL(item.url);
      url.search = "";
      url.hash = "";

      const key = `${url.hostname}${url.pathname}`.toLowerCase();

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    } catch {
      return false;
    }
  });
}

function getPrice(item, productType) {
  return extractPrice(item.title, productType) ??
    extractPrice(item.content, productType);
}

function filterCandidates(items, marketplace, input, strictBrand) {
  const budget = Number(input.budget);

  const candidates = deduplicate(items).filter(item => {
    if (!validProduct(item, marketplace, input)) return false;

    if (strictBrand && !matchesBrand(item.title, input.brand)) {
      return false;
    }

    const price = getPrice(item, input.productType || "Phone");

    return price !== null && price <= budget;
  });

  return candidates;
}

async function searchMarketplace(
  queries,
  marketplace,
  domain,
  input,
  strictBrand
) {
  const results = await Promise.allSettled(
    queries.map(query => tavilySearch(query, domain))
  );

  const combined = results
    .filter(result => result.status === "fulfilled")
    .flatMap(result => result.value);

  return filterCandidates(combined, marketplace, input, strictBrand);
}

/*
 * Evidence-based relevance scoring.
 * A keyword in a listing is evidence to investigate, not proof that
 * the device performs at a particular level.
 */
function getPriorityKeywords(value) {
  const text = normalizeText(value);

  if (/gaming|game|gamer/.test(text)) {
    return [
      "gaming", "snapdragon", "dimensity", "mediatek",
      "qualcomm", "processor", "refresh rate",
      "cooling", "vapor chamber", "gpu", "ram"
    ];
  }

  if (/battery|battery life|long lasting/.test(text)) {
    return [
      "battery", "mah", "fast charging",
      "charging", "endurance", "battery life"
    ];
  }

  if (/camera|photography|photo|video/.test(text)) {
    return [
      "camera", "megapixel", "mp", "ois",
      "optical image stabilization", "4k", "ultrawide"
    ];
  }

  if (/performance|speed|multitask/.test(text)) {
    return [
      "processor", "snapdragon", "dimensity",
      "mediatek", "ram", "performance", "gpu"
    ];
  }

  if (/student|study|college|school/.test(text)) {
    return [
      "battery", "weight", "ssd", "ram",
      "keyboard", "display", "warranty"
    ];
  }

  if (/display|screen/.test(text)) {
    return [
      "amoled", "oled", "lcd", "refresh rate",
      "resolution", "brightness", "display"
    ];
  }

  return [];
}

function getEvidenceText(item) {
  return normalizeText(`${item.title || ""} ${item.content || ""}`);
}

function calculateMatchScore(item, input) {
  const evidence = getEvidenceText(item);
  const budget = Number(input.budget);
  const price = getPrice(item, input.productType || "Phone");

  let score = 35;

  if (price !== null && budget > 0) {
    const ratio = price / budget;

    if (ratio <= 0.95) score += 8;
    if (ratio <= 0.80) score += 4;
    if (ratio > 1) score -= 30;
  }

  if (matchesBrand(item.title, input.brand)) score += 8;

  const uses = Array.isArray(input.uses) ? input.uses : [];
  const priority = input.priority ? [input.priority] : [];
  const preferences = [...uses, ...priority];

  const keywords = new Set(
    preferences.flatMap(getPriorityKeywords)
  );

  let hits = 0;

  for (const keyword of keywords) {
    if (evidence.includes(normalizeText(keyword))) {
      hits++;
    }
  }

  score += Math.min(hits * 4, 24);

  // Listing specificity can improve confidence, but is not proof of truth.
  if (/\b(8gb|12gb|16gb|256gb|512gb|1tb)\b/.test(evidence)) {
    score += 3;
  }

  if (evidence.length > 180) score += 2;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function modelKey(name) {
  return normalizeText(name)
    .replace(/\b(black|white|blue|green|olive|silver|grey|gray|purple|pink|orange)\b/g, "")
    .replace(/\b(4gb|6gb|8gb|12gb|16gb|128gb|256gb|512gb|1tb|2tb)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeEvidencePoints(source, input) {
  const evidence = getEvidenceText(source);
  const points = [];
  const preferences = [
    ...(Array.isArray(input.uses) ? input.uses : []),
    input.priority || ""
  ];

  const mappings = [
    {
      label: "Gaming-related details appear in the listing",
      pattern: /\bgaming\b|\bgpu\b|\bprocessor\b|\bsnapdragon\b|\bdimensity\b|\brefresh rate\b/
    },
    {
      label: "Battery-related details appear in the listing",
      pattern: /\bbattery\b|\bmah\b|\bfast charging\b|\bbattery life\b/
    },
    {
      label: "Camera-related details appear in the listing",
      pattern: /\bcamera\b|\bmegapixel\b|\boptical image stabilization\b|\b4k\b/
    },
    {
      label: "Memory or storage details appear in the listing",
      pattern: /\b(4gb|6gb|8gb|12gb|16gb|128gb|256gb|512gb|1tb)\b/
    },
    {
      label: "Display-related details appear in the listing",
      pattern: /\bamoled\b|\boled\b|\blcd\b|\brefresh rate\b|\bbrightness\b/
    }
  ];

  for (const mapping of mappings) {
    if (mapping.pattern.test(evidence)) {
      points.push(mapping.label);
    }
  }

  if (points.length === 0) {
    points.push(
      "A product listing and usable price were found; verify the full specifications before buying."
    );
  }

  const requested = preferences
    .map(normalizeText)
    .filter(Boolean);

  if (
    requested.some(value => /gaming|game/.test(value)) &&
    !/\bsnapdragon\b|\bdimensity\b|\bprocessor\b|\bgpu\b|\bgaming\b/.test(evidence)
  ) {
    points.push(
      "The available listing evidence does not establish gaming performance."
    );
  }

  if (
    requested.some(value => /battery/.test(value)) &&
    !/\bbattery\b|\bmah\b|\bbattery life\b/.test(evidence)
  ) {
    points.push(
      "The available listing evidence does not establish battery endurance."
    );
  }

  return points.slice(0, 4);
}

function buildWhy(source, input, brandMatches, alternativesUsed) {
  const uses = Array.isArray(input.uses) ? input.uses : [];
  const needs = uses.length ? uses.join(", ") : "your selected preferences";

  if (alternativesUsed && !brandMatches) {
    return `This is an alternative brand. It passed the available category and budget checks; compare its verified specifications for ${needs} before buying.`;
  }

  return `This listing passed the available category and budget checks. Compare its verified specifications for ${needs} before deciding.`;
}

function createRecommendation(
  source,
  marketplace,
  input,
  alternativesUsed = false
) {
  const price = getPrice(source, input.productType || "Phone");

  if (price === null || price > Number(input.budget)) return null;

  const brandMatches = matchesBrand(source.title, input.brand);

  return {
    name: source.title.trim(),
    brandMatchesPreference: brandMatches,
    price,
    priceSource: marketplace === "amazon"
      ? "Amazon India search evidence — confirm checkout price"
      : "Flipkart search evidence — confirm checkout price",
    marketplace: marketplace === "amazon" ? "Amazon India" : "Flipkart",
    matchScore: calculateMatchScore(source, input),
    why: buildWhy(source, input, brandMatches, alternativesUsed),
    strengths: safeEvidencePoints(source, input),
    tradeoffs: [
      "Search snippets may omit specifications or variant details.",
      "Confirm the exact model, seller, warranty and checkout price before buying."
    ],
    imageUrl: null
  };
}

async function askGroq(input, amazon, flipkart, alternativesUsed) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing in Render.");
  }

  const systemPrompt = `
You are OPITECH, an electronics candidate ranker.

Return valid JSON only:
{"recommendations":[...]}

Choose up to 3 DIFFERENT products from the supplied candidate evidence.
Do not invent products, prices, URLs, model names or specifications.
Never select accessories, warranties, services or guide pages.
Respect the category, budget and selected needs.
Rank products using only the provided listing evidence.
Do not make claims about battery endurance, gaming benchmarks,
processor performance or camera quality unless the supplied evidence
directly supports the claim.
Use only the supplied marketplace name and resultIndex.
Return fewer than 3 if evidence is insufficient.

Each item:
{
  "marketplace": "amazon" or "flipkart",
  "resultIndex": 0
}
`;

  const userPrompt = {
    requirements: {
      productType: input.productType || "Phone",
      country: "India",
      currency: "INR",
      budget: Number(input.budget),
      uses: Array.isArray(input.uses) ? input.uses : [],
      priority: input.priority || "Balanced",
      requestedBrand: input.brand || "Any",
      alternativeBrandsAllowed: alternativesUsed
    },
    amazon: amazon.map((item, resultIndex) => ({
      resultIndex,
      title: item.title,
      content: item.content,
      priceEvidence: getPrice(item, input.productType || "Phone"),
      relevanceScore: calculateMatchScore(item, input)
    })),
    flipkart: flipkart.map((item, resultIndex) => ({
      resultIndex,
      title: item.title,
      content: item.content,
      priceEvidence: getPrice(item, input.productType || "Phone"),
      relevanceScore: calculateMatchScore(item, input)
    }))
  };

  const response = await fetchWithTimeout(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPrompt) }
        ],
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      })
    },
    35000
  );

  const raw = await response.text();
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("AI service returned invalid data.");
  }

  if (!response.ok) {
    throw new Error(`AI service failed (${response.status}).`);
  }

  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("AI service returned an empty response.");
  }

  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI recommendation data was invalid.");
  }

  return Array.isArray(parsed.recommendations)
    ? parsed.recommendations
    : [];
}

function buildRecommendations(
  aiItems,
  amazon,
  flipkart,
  input,
  alternativesUsed
) {
  const output = [];
  const seenModels = new Set();
  const seenSources = new Set();

  function add(source, marketplace, index) {
    if (!source || !validProduct(source, marketplace, input)) return;

    const sourceKey = `${marketplace}:${index}`;
    if (seenSources.has(sourceKey)) return;

    const recommendation = createRecommendation(
      source,
      marketplace,
      input,
      alternativesUsed
    );

    if (!recommendation) return;

    const key = modelKey(recommendation.name);
    if (!key || seenModels.has(key)) return;

    seenModels.add(key);
    seenSources.add(sourceKey);
    output.push(recommendation);
  }

  // Respect AI ranking when it references valid candidate indices.
  for (const item of Array.isArray(aiItems) ? aiItems : []) {
    const marketplace = ["amazon", "flipkart"].includes(item.marketplace)
      ? item.marketplace
      : null;

    if (!marketplace) continue;

    const list = marketplace === "amazon" ? amazon : flipkart;
    const index = Number(item.resultIndex);

    if (!Number.isInteger(index) || index < 0 || !list[index]) {
      continue;
    }

    add(list[index], marketplace, index);

    if (output.length === REQUIRED_COUNT) return output;
  }

  // Fill any gaps using locally scored candidates.
  const remaining = [
    ...amazon.map((item, index) => ({
      item,
      marketplace: "amazon",
      index
    })),
    ...flipkart.map((item, index) => ({
      item,
      marketplace: "flipkart",
      index
    }))
  ].sort((a, b) =>
    calculateMatchScore(b.item, input) -
    calculateMatchScore(a.item, input)
  );

  for (const candidate of remaining) {
    if (output.length >= REQUIRED_COUNT) break;

    add(
      candidate.item,
      candidate.marketplace,
      candidate.index
    );
  }

  // Final order is based on the calculated evidence score.
  output.sort((a, b) => b.matchScore - a.matchScore);

  return output.slice(0, REQUIRED_COUNT);
}

async function collectCandidates(input, strictBrand) {
  const queries = makeQueries(input, !strictBrand);

  const results = await Promise.allSettled([
    searchMarketplace(
      queries,
      "amazon",
      "amazon.in",
      input,
      strictBrand
    ),
    searchMarketplace(
      queries,
      "flipkart",
      "flipkart.com",
      input,
      strictBrand
    )
  ]);

  return {
    amazon: results[0].status === "fulfilled"
      ? results[0].value
      : [],
    flipkart: results[1].status === "fulfilled"
      ? results[1].value
      : []
  };
}

app.post("/recommendations", async (req, res) => {
  const input = req.body || {};
  const budget = Number(input.budget);

  if (!Number.isFinite(budget) || budget <= 0) {
    return res.status(400).json({
      error: "Please enter a valid budget."
    });
  }

  if (!GROQ_API_KEY || !TAVILY_API_KEY) {
    return res.status(503).json({
      error: "Add GROQ_API_KEY and TAVILY_API_KEY to Render environment variables."
    });
  }

  try {
    const requestedBrand = input.brand || "Any";
    const strictBrand = !isAnyBrand(requestedBrand);

    let { amazon, flipkart } = await collectCandidates(
      input,
      strictBrand
    );

    let alternativesUsed = false;

    console.log("OPITECH primary search:", {
      productType: input.productType || "Phone",
      brand: requestedBrand,
      budget,
      amazon: amazon.length,
      flipkart: flipkart.length
    });

    if (
      strictBrand &&
      amazon.length + flipkart.length < REQUIRED_COUNT
    ) {
      console.log("OPITECH: broadening search to other brands.");

      const broader = await collectCandidates(input, false);

      amazon = deduplicate([...amazon, ...broader.amazon]);
      flipkart = deduplicate([...flipkart, ...broader.flipkart]);

      alternativesUsed = true;
    }

    console.log("OPITECH final candidate pool:", {
      amazon: amazon.length,
      flipkart: flipkart.length,
      alternativesUsed
    });

    if (amazon.length + flipkart.length < REQUIRED_COUNT) {
      return res.status(502).json({
        error:
          `OPITECH found only ${amazon.length + flipkart.length} listings ` +
          "that passed its available category, URL and price checks. " +
          "It will not invent missing products. Try again, increase your budget, or choose Any brand."
      });
    }

    let aiItems = [];

    try {
      aiItems = await askGroq(
        input,
        amazon,
        flipkart,
        alternativesUsed
      );
    } catch (aiError) {
      console.error(
        "OPITECH AI ranking unavailable; using local ranking:",
        aiError.message
      );
    }

    const recommendations = buildRecommendations(
      aiItems,
      amazon,
      flipkart,
      input,
      alternativesUsed
    );

    if (recommendations.length !== REQUIRED_COUNT) {
      return res.status(502).json({
        error:
          `Only ${recommendations.length} distinct listings passed final checks. ` +
          "Try again or broaden your filters."
      });
    }

    recommendations.forEach((item, index) => {
      item.rank = index + 1;
    });

    const usedAlternativeBrand = recommendations.some(
      item => !item.brandMatchesPreference
    );

    return res.json({
      recommendations,
      recommendationCount: recommendations.length,
      alternativesUsed: usedAlternativeBrand,
      notice: [
        "Prices come from marketplace search evidence and may be outdated. Confirm the exact variant, seller and checkout price.",
        "Match scores indicate listing relevance, not verified benchmark results.",
        "Specifications may be incomplete in search snippets; verify them before buying.",
        usedAlternativeBrand
          ? `Some results are alternatives to ${requestedBrand}.`
          : ""
      ].filter(Boolean).join(" ")
    });
  } catch (error) {
    console.error("OPITECH recommendation error:", error.message);

    return res.status(502).json({
      error: "Could not prepare recommendations right now. Please try again."
    });
  }
});

app.listen(PORT, () => {
  console.log(`OPITECH backend listening on port ${PORT}`);
});
