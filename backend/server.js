
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
    message: "OPITECH marketplace recommendation backend is running",
    marketplaces: ["Amazon India", "Flipkart"],
    recommendationsPerRequest: REQUIRED_COUNT,
    strictBrandFilter: true,
    strictBudgetFilter: true
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
    return await fetch(url, { ...options, signal: controller.signal });
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

  const prices = [];

  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      const amount = Number(match[1].replace(/,/g, ""));
      const start = Math.max(0, match.index - 50);
      const end = Math.min(value.length, match.index + match[0].length + 60);
      const context = value.slice(start, end).toLowerCase();

      if (/\bemi\b|per month|\/month|monthly|exchange bonus|down payment/.test(context)) {
        continue;
      }

      if (Number.isFinite(amount) && amount >= minimum && amount <= 10000000) {
        prices.push(amount);
      }
    }
  }

  return prices.length ? prices[0] : null;
}

function isProductUrl(url, marketplace) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;

    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (marketplace === "amazon") {
      const validHost = host === "amazon.in" || host.endsWith(".amazon.in");

      return validHost && (
        /\/dp\/[a-z0-9]{10}(?:\/|$)/i.test(path) ||
        /\/gp\/product\/[a-z0-9]{10}(?:\/|$)/i.test(path) ||
        /\/gp\/aw\/d\/[a-z0-9]{10}(?:\/|$)/i.test(path)
      );
    }

    if (marketplace === "flipkart") {
      const validHost = host === "flipkart.com" || host.endsWith(".flipkart.com");
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

function matchesCategory(title, productType) {
  const text = normalizeText(title);
  const type = normalizeText(productType);

  const categories = {
    phone: ["phone", "smartphone", "iphone", "galaxy", "redmi", "poco", "pixel", "oneplus", "realme", "oppo", "vivo", "motorola", "nothing phone"],
    laptop: ["laptop", "notebook", "macbook", "thinkpad", "vivobook", "ideapad", "pavilion", "inspiron", "aspire", "latitude", "zenbook", "chromebook"],
    tv: ["television", "smart tv", "qled", "oled", "led tv", "google tv", "android tv"],
    tablet: ["tablet", "ipad", "galaxy tab", "xiaomi pad", "oneplus pad", "lenovo tab"],
    speaker: ["speaker", "soundbar", "bluetooth speaker", "portable speaker"],
    headphone: ["headphone", "headset", "earbud", "earbuds", "airpods", "earphones", "tws"],
    monitor: ["monitor", "display", "computer screen"],
    smartwatch: ["smartwatch", "smart watch", "galaxy watch", "apple watch"],
    camera: ["camera", "mirrorless", "dslr", "action camera"]
  };

  const category = Object.keys(categories).find(key => type.includes(key));
  if (!category) return true;

  return categories[category].some(term => text.includes(normalizeText(term)));
}

function matchesBrand(title, requestedBrand) {
  const requested = normalizeText(requestedBrand);

  if (!requested || requested === "any" || requested === "any brand" || requested === "other") {
    return true;
  }

  const product = normalizeText(title);
  const aliases = {
    samsung: ["samsung", "galaxy"],
    xiaomi: ["xiaomi", "redmi", "poco"],
    redmi: ["redmi"],
    poco: ["poco"],
    apple: ["apple", "iphone", "macbook", "ipad", "airpods"],
    google: ["google", "pixel"],
    oneplus: ["oneplus"],
    realme: ["realme"],
    oppo: ["oppo"],
    vivo: ["vivo"],
    motorola: ["motorola", "moto"],
    nothing: ["nothing phone"],
    asus: ["asus", "rog"],
    lenovo: ["lenovo", "thinkpad", "ideapad", "legion"],
    dell: ["dell", "inspiron", "xps", "latitude"],
    acer: ["acer", "aspire", "predator"],
    hp: ["hp", "hewlett packard", "pavilion", "omen"],
    honor: ["honor"],
    huawei: ["huawei"],
    boat: ["boat"],
    sony: ["sony"]
  };

  const terms = aliases[requested] || [requested];
  return terms.some(term => product.includes(normalizeText(term)));
}

function validProduct(item, marketplace, input) {
  if (!item || !item.title || !item.url) return false;
  if (!isProductUrl(item.url, marketplace)) return false;
  if (looksLikeGuide(item.title, item.content)) return false;
  if (!matchesCategory(item.title, input.productType || "Phone")) return false;
  if (!matchesBrand(item.title, input.brand)) return false;
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
      content: String(item.content || "").replace(/\s+/g, " ").slice(0, 1500)
    }));
}

/* More query variations help find individual product pages. */
function makeQueries(input) {
  const type = String(input.productType || "Phone");
  const brand = input.brand && !["any", "other"].includes(normalizeText(input.brand))
    ? String(input.brand)
    : "";

  const uses = Array.isArray(input.uses) ? input.uses.slice(0, 6).join(" ") : "";
  const budget = Number(input.budget);
  const budgetText = Number.isFinite(budget) ? `under Rs ${budget}` : "";
  const common = [type, brand, uses, budgetText, "India"].filter(Boolean).join(" ");

  return [
    `${common} exact model price official product listing`,
    `${type} ${brand} product price Rs ${budget} site:amazon.in/dp`,
    `${type} ${brand} product price Rs ${budget} site:flipkart.com`,
    `${type} ${brand} full model name current price India`,
    `${type} ${brand} specifications price individual listing India`
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

async function searchMarketplace(queries, marketplace, domain, input) {
  const results = await Promise.allSettled(
    queries.map(query => tavilySearch(query, domain))
  );

  const combined = results
    .filter(result => result.status === "fulfilled")
    .flatMap(result => result.value);

  const valid = deduplicate(combined).filter(item =>
    validProduct(item, marketplace, input)
  );

  /* Keep only candidates with a parseable price inside the budget. */
  const budget = Number(input.budget);

  return valid.filter(item => {
    const price = extractPrice(`${item.title} ${item.content}`, input.productType || "Phone");
    return price !== null && price <= budget;
  });
}

async function askGroq(input, amazon, flipkart) {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is missing in Render.");

  const systemPrompt = `
You are OPITECH, an evidence-based electronics recommender.
Return valid JSON only, with a "recommendations" array of up to 3 items.
Use only the supplied marketplace evidence. Never invent model names, prices,
features, specifications, or URLs. The selected brand and budget are mandatory.
Do not recommend duplicate models. Do not make unsupported performance claims.
Use the exact supplied title by referring to its result index.

Each item:
{
  "marketplace": "amazon" or "flipkart",
  "resultIndex": 0,
  "why": "Short explanation grounded in the user's needs and supplied evidence",
  "strengths": ["Only evidence-supported points"],
  "tradeoffs": ["Only evidence-supported limitations"]
}
`;

  const userPrompt = {
    requirements: {
      productType: input.productType,
      country: "India",
      currency: "INR",
      budget: Number(input.budget),
      uses: input.uses || [],
      priority: input.priority || "Balanced",
      brand: input.brand || "Any"
    },
    amazon: amazon.map((item, resultIndex) => ({
      resultIndex, title: item.title, content: item.content
    })),
    flipkart: flipkart.map((item, resultIndex) => ({
      resultIndex, title: item.title, content: item.content
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

  if (!response.ok) throw new Error(`AI service failed (${response.status}).`);

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

  return Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
}

function modelKey(name) {
  return normalizeText(name)
    .replace(/\b(black|white|blue|green|olive|silver|grey|gray|purple|pink|orange)\b/g, "")
    .replace(/\b(4gb|6gb|8gb|12gb|16gb|128gb|256gb|512gb|1tb|2tb)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createRecommendation(source, marketplace, input, aiItem = {}) {
  const price = extractPrice(
    `${source.title} ${source.content}`,
    input.productType || "Phone"
  );

  if (price === null || price > Number(input.budget)) return null;

  return {
    name: source.title.trim(),
    brand: input.brand && !["any", "other"].includes(normalizeText(input.brand))
      ? String(input.brand)
      : "",
    price,
    priceSource: marketplace === "amazon"
      ? "Amazon India search evidence — confirm checkout price"
      : "Flipkart search evidence — confirm checkout price",
    matchScore: null,
    why: String(aiItem.why ||
      "This listing passed the product-page, category, brand and budget checks. Compare its exact configuration and specifications with your needs."),
    strengths: Array.isArray(aiItem.strengths) ? aiItem.strengths.slice(0, 4).map(String) : [],
    tradeoffs: Array.isArray(aiItem.tradeoffs) ? aiItem.tradeoffs.slice(0, 3).map(String) : [],
    imageUrl: null
  };
}

/*
 * Use AI's order first, then fill any remaining positions from other valid
 * listings. The fallback still applies the same URL, category, brand and
 * budget checks; it never substitutes another brand when one was selected.
 */
function buildRecommendations(aiItems, amazon, flipkart, input) {
  const output = [];
  const seenModels = new Set();
  const seenSources = new Set();

  function add(source, marketplace, aiItem = {}, index = -1) {
    if (!source || !validProduct(source, marketplace, input)) return;

    const sourceKey = `${marketplace}:${index}`;
    if (index >= 0 && seenSources.has(sourceKey)) return;

    const recommendation = createRecommendation(source, marketplace, input, aiItem);
    if (!recommendation) return;

    const key = modelKey(recommendation.name);
    if (!key || seenModels.has(key)) return;

    seenModels.add(key);
    if (index >= 0) seenSources.add(sourceKey);
    output.push(recommendation);
  }

  for (const item of Array.isArray(aiItems) ? aiItems : []) {
    const marketplace = ["amazon", "flipkart"].includes(item.marketplace)
      ? item.marketplace
      : null;

    if (!marketplace) continue;

    const list = marketplace === "amazon" ? amazon : flipkart;
    const index = Number(item.resultIndex);

    if (!Number.isInteger(index) || index < 0 || !list[index]) continue;
    add(list[index], marketplace, item, index);

    if (output.length === REQUIRED_COUNT) return output;
  }

  /* Fill the gaps from remaining evidence-backed listings. */
  for (let i = 0; i < amazon.length && output.length < REQUIRED_COUNT; i++) {
    add(amazon[i], "amazon", {}, i);
  }

  for (let i = 0; i < flipkart.length && output.length < REQUIRED_COUNT; i++) {
    add(flipkart[i], "flipkart", {}, i);
  }

  return output;
}

app.post("/recommendations", async (req, res) => {
  const input = req.body || {};
  const budget = Number(input.budget);

  if (!Number.isFinite(budget) || budget <= 0) {
    return res.status(400).json({ error: "Please enter a valid budget." });
  }

  if (!GROQ_API_KEY || !TAVILY_API_KEY) {
    return res.status(503).json({
      error: "Add GROQ_API_KEY and TAVILY_API_KEY to Render environment variables."
    });
  }

  try {
    const queries = makeQueries(input);

    const results = await Promise.allSettled([
      searchMarketplace(queries, "amazon", "amazon.in", input),
      searchMarketplace(queries, "flipkart", "flipkart.com", input)
    ]);

    const amazon = results[0].status === "fulfilled" ? results[0].value : [];
    const flipkart = results[1].status === "fulfilled" ? results[1].value : [];

    console.log("OPITECH verified candidate counts:", {
      productType: input.productType,
      brand: input.brand || "Any",
      budget,
      amazon: amazon.length,
      flipkart: flipkart.length
    });

    if (amazon.length + flipkart.length < REQUIRED_COUNT) {
      return res.status(502).json({
        error: `Only ${amazon.length + flipkart.length} listings passed the product-page, category, brand and price checks. Try another search or choose Any brand to broaden the results.`
      });
    }

    let aiItems = [];

    try {
      aiItems = await askGroq(input, amazon, flipkart);
    } catch (aiError) {
      console.error("OPITECH AI ranking unavailable; using verified candidates:", aiError.message);
    }

    const recommendations = buildRecommendations(aiItems, amazon, flipkart, input);

    if (recommendations.length !== REQUIRED_COUNT) {
      return res.status(502).json({
        error: `Only ${recommendations.length} distinct listings passed the final checks. OPITECH will not invent missing products or prices. Try again or broaden your filters.`
      });
    }

    recommendations.forEach((item, index) => {
      item.rank = index + 1;
    });

    return res.json({
      recommendations,
      recommendationCount: recommendations.length,
      notice: "Prices are extracted from marketplace search evidence and may be outdated. Confirm the exact model, configuration, seller and checkout price before buying."
    });
  } catch (error) {
    console.error("OPITECH recommendation error:", error.message);

    return res.status(502).json({
      error: error.message || "Could not prepare accurate recommendations. Please try again."
    });
  }
});

app.listen(PORT, () => {
  console.log(`OPITECH backend listening on port ${PORT}`);
});
