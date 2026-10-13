
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
    message: "OPITECH recommendation backend is running",
    marketplaces: ["Amazon India", "Flipkart"],
    recommendationsPerRequest: REQUIRED_COUNT,
    rejectsAccessoriesAndServices: true,
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
      const start = Math.max(0, match.index - 80);
      const end = Math.min(
        value.length,
        match.index + match[0].length + 80
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

/*
 * Block service listings and accessories BEFORE category checks.
 * This prevents a warranty titled "Warranty for Mobile Phones"
 * from being treated as a phone.
 */
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
    /\bstand for\b/,
    /\bprotective case\b/,
    /\bkeyboard cover\b/,
    /\bcarrying case\b/,
    /\brefurbishment service\b/
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

  const patterns = [
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
  ];

  return patterns.some(pattern => pattern.test(text));
}

function matchesCategory(title, productType) {
  const text = normalizeText(title);
  const type = normalizeText(productType);

  const categories = {
    phone: [
      "smartphone", "mobile phone", "phone",
      "iphone", "galaxy", "redmi", "poco",
      "pixel", "oneplus", "realme", "oppo",
      "vivo", "motorola", "nothing phone"
    ],
    laptop: [
      "laptop", "notebook", "macbook",
      "thinkpad", "vivobook", "ideapad",
      "pavilion", "inspiron", "aspire",
      "latitude", "zenbook", "chromebook"
    ],
    tv: [
      "television", "smart tv", "qled",
      "oled", "led tv", "google tv", "android tv"
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
      "headphone", "headset", "earbud",
      "earbuds", "airpods", "earphones", "tws"
    ],
    monitor: [
      "monitor", "display", "computer screen"
    ],
    smartwatch: [
      "smartwatch", "smart watch",
      "galaxy watch", "apple watch"
    ],
    camera: [
      "camera", "mirrorless", "dslr", "action camera"
    ]
  };

  let category = null;

  if (/phone|mobile/.test(type)) category = "phone";
  else if (/laptop|notebook/.test(type)) category = "laptop";
  else if (/television|\btv\b/.test(type)) category = "tv";
  else if (/tablet|ipad/.test(type)) category = "tablet";
  else if (/speaker|soundbar/.test(type)) category = "speaker";
  else if (/headphone|earbud|earphone|headset/.test(type)) {
    category = "headphone";
  } else if (/monitor|computer screen/.test(type)) {
    category = "monitor";
  } else if (/smartwatch|smart watch/.test(type)) {
    category = "smartwatch";
  } else if (/camera|dslr|mirrorless/.test(type)) {
    category = "camera";
  }

  if (!category) return true;

  return categories[category].some(term =>
    text.includes(normalizeText(term))
  );
}

function matchesBrand(title, requestedBrand) {
  const requested = normalizeText(requestedBrand);

  if (
    !requested ||
    ["any", "any brand", "other"].includes(requested)
  ) {
    return true;
  }

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
    smartron: ["smartron"]
  };

  const terms = aliases[requested] || [requested];

  return terms.some(term => {
    const normalizedTerm = normalizeText(term);

    if (!normalizedTerm) return false;

    return (` ${product} `).includes(` ${normalizedTerm} `);
  });
}

function validProduct(item, marketplace, input) {
  if (!item || !item.title || !item.url) return false;

  // Reject services/accessories first.
  if (isAccessoryOrService(item.title)) return false;

  if (!isProductUrl(item.url, marketplace)) return false;
  if (looksLikeGuide(item.title, item.content)) return false;
  if (!matchesCategory(item.title, input.productType || "Phone")) {
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

function isAnyBrand(brand) {
  return !brand ||
    ["any", "any brand", "other"].includes(normalizeText(brand));
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
  const budgetText = `under Rs ${budget}`;

  const common = [
    type,
    brand,
    uses,
    budgetText,
    "India"
  ].filter(Boolean).join(" ");

  return [
    `${common} exact product model current price`,
    `${type} ${brand} price Rs ${budget} site:amazon.in/dp`,
    `${type} ${brand} price Rs ${budget} site:flipkart.com`,
    `${type} ${brand} full model name specifications price India`
  ].map(query => query.replace(/\s+/g, " ").trim());
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
  // Prefer a price explicitly present in the product title.
  return extractPrice(
    item.title,
    productType
  ) ?? extractPrice(
    item.content,
    productType
  );
}

function filterCandidates(items, marketplace, input, strictBrand) {
  const budget = Number(input.budget);

  return deduplicate(items).filter(item => {
    if (!validProduct(item, marketplace, input)) return false;

    if (strictBrand && !matchesBrand(item.title, input.brand)) {
      return false;
    }

    const price = getPrice(item, input.productType || "Phone");

    return price !== null && price <= budget;
  });
}

async function searchMarketplace(queries, marketplace, domain, input, strictBrand) {
  const results = await Promise.allSettled(
    queries.map(query => tavilySearch(query, domain))
  );

  const combined = results
    .filter(result => result.status === "fulfilled")
    .flatMap(result => result.value);

  return filterCandidates(combined, marketplace, input, strictBrand);
}

async function askGroq(input, amazon, flipkart, alternativesUsed) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing in Render.");
  }

  const systemPrompt = `
You are OPITECH, an evidence-based electronics recommender.

Return valid JSON only:
{"recommendations":[...]}

Choose exactly 3 DIFFERENT actual products from the supplied evidence.
Never recommend warranties, insurance, accessories, services, guides,
category pages, or subscriptions.

Never invent prices, specifications, features, models, or URLs.
Only use the supplied result indices.
Respect the user's budget and requested product category.
Prioritize the user's stated uses and priority.
Prefer the requested brand whenever matching candidates are supplied.
If alternatives were enabled, clearly identify when a product is from
a different brand. Do not pretend it matches the requested brand.

Each recommendation must have:
{
  "marketplace": "amazon" or "flipkart",
  "resultIndex": 0,
  "why": "Short explanation",
  "strengths": ["Evidence-supported points only"],
  "tradeoffs": ["Evidence-supported limitations only"]
}

If the evidence is insufficient, return fewer products rather than inventing
a product. The server will validate every selection.
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
      content: item.content
    })),
    flipkart: flipkart.map((item, resultIndex) => ({
      resultIndex,
      title: item.title,
      content: item.content
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
        max_tokens: 2500,
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

function modelKey(name) {
  return normalizeText(name)
    .replace(/\b(black|white|blue|green|olive|silver|grey|gray|purple|pink|orange)\b/g, "")
    .replace(/\b(4gb|6gb|8gb|12gb|16gb|128gb|256gb|512gb|1tb|2tb)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createRecommendation(source, marketplace, input, aiItem = {}, alternativesUsed = false) {
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
    matchScore: null,
    why: String(aiItem.why || (
      alternativesUsed && !brandMatches
        ? "This is an alternative brand because fewer matching products were found for your selected brand. Check its specifications against your needs."
        : "This product passed the available product-page, category and budget checks. Confirm the exact model and specifications before buying."
    )),
    strengths: Array.isArray(aiItem.strengths)
      ? aiItem.strengths.slice(0, 4).map(String)
      : [],
    tradeoffs: Array.isArray(aiItem.tradeoffs)
      ? aiItem.tradeoffs.slice(0, 3).map(String)
      : [],
    imageUrl: null
  };
}

function buildRecommendations(aiItems, amazon, flipkart, input, alternativesUsed) {
  const output = [];
  const seenModels = new Set();
  const seenSources = new Set();

  function add(source, marketplace, aiItem = {}, index = -1) {
    if (!source || !validProduct(source, marketplace, input)) return;

    const keySource = `${marketplace}:${index}`;

    if (index >= 0 && seenSources.has(keySource)) return;

    const recommendation = createRecommendation(
      source,
      marketplace,
      input,
      aiItem,
      alternativesUsed
    );

    if (!recommendation) return;

    const key = modelKey(recommendation.name);

    if (!key || seenModels.has(key)) return;

    seenModels.add(key);

    if (index >= 0) seenSources.add(keySource);

    output.push(recommendation);
  }

  // AI-ranked results first.
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

    add(list[index], marketplace, item, index);

    if (output.length === REQUIRED_COUNT) return output;
  }

  // Fill gaps from remaining validated candidates.
  for (let i = 0; i < amazon.length && output.length < REQUIRED_COUNT; i++) {
    add(amazon[i], "amazon", {}, i);
  }

  for (let i = 0; i < flipkart.length && output.length < REQUIRED_COUNT; i++) {
    add(flipkart[i], "flipkart", {}, i);
  }

  return output;
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

  const amazon = results[0].status === "fulfilled"
    ? results[0].value
    : [];

  const flipkart = results[1].status === "fulfilled"
    ? results[1].value
    : [];

  return { amazon, flipkart };
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

    // Pass 1: search the selected brand, if one was chosen.
    let { amazon, flipkart } = await collectCandidates(input, strictBrand);
    let alternativesUsed = false;

    console.log("OPITECH primary search:", {
      productType: input.productType || "Phone",
      brand: requestedBrand,
      budget,
      amazon: amazon.length,
      flipkart: flipkart.length
    });

    // Pass 2: broaden to other brands only when needed.
    // The response explicitly discloses when an alternative is used.
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
          `OPITECH found only ${amazon.length + flipkart.length} valid product listings with usable prices. ` +
          "It will not fill missing recommendations with warranties, accessories, or invented products. " +
          "Try again, increase the budget, or choose Any brand."
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
        "OPITECH AI ranking unavailable; using validated candidates:",
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
          `Only ${recommendations.length} distinct products passed the final validation. ` +
          "Please try again or broaden your filters."
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
        "Search-result prices may be outdated; confirm the exact model, seller and checkout price.",
        usedAlternativeBrand
          ? `Some results use alternatives to the requested brand: ${requestedBrand}.`
          : ""
      ].filter(Boolean).join(" ")
    });
  } catch (error) {
    console.error("OPITECH recommendation error:", error.message);

    return res.status(502).json({
      error: "Could not prepare reliable recommendations. Please try again."
    });
  }
});

app.listen(PORT, () => {
  console.log(`OPITECH backend listening on port ${PORT}`);
});
