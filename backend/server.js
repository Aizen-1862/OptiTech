
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

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "OPITECH AI backend is running",
    ai: "Groq + Tavily",
    marketplaces: ["Amazon India", "Flipkart"],
    recommendationsPerRequest: REQUIRED_COUNT,
    productValidation: true,
    images: false,
    productLinksInFrontend: false
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    groqConfigured: Boolean(GROQ_API_KEY),
    tavilyConfigured: Boolean(TAVILY_API_KEY)
  });
});

async function fetchWithTimeout(url, options = {}, timeout = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

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

function extractPrice(text) {
  const value = String(text || "");

  const patterns = [
    /₹\s*([0-9,]{3,10})/i,
    /\bRs\.?\s*([0-9,]{3,10})/i,
    /\bINR\s*([0-9,]{3,10})/i
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;

    const amount = Number(match[1].replace(/,/g, ""));

    if (
      Number.isFinite(amount) &&
      amount >= 500 &&
      amount <= 10000000
    ) {
      return amount;
    }
  }

  return null;
}

function isAllowedMarketplaceUrl(url, marketplace) {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") return false;

    const host = parsed.hostname.toLowerCase();

    if (marketplace === "amazon") {
      return host === "amazon.in" ||
        host.endsWith(".amazon.in");
    }

    if (marketplace === "flipkart") {
      return host === "flipkart.com" ||
        host.endsWith(".flipkart.com");
    }

    return false;
  } catch {
    return false;
  }
}

// Only accept URLs that look like individual product pages.
// Search pages, category pages, and buying guides are rejected.
function isProductListingUrl(url, marketplace) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    if (!isAllowedMarketplaceUrl(url, marketplace)) {
      return false;
    }

    if (marketplace === "amazon") {
      return /\/dp\/[a-z0-9]{10}(?:\/|$)/i.test(path) ||
        /\/gp\/product\/[a-z0-9]{10}(?:\/|$)/i.test(path) ||
        /\/gp\/aw\/d\/[a-z0-9]{10}(?:\/|$)/i.test(path);
    }

    if (marketplace === "flipkart") {
      return /\/p\/itm[a-z0-9]+/i.test(path);
    }

    return false;
  } catch {
    return false;
  }
}

// Reject editorial pages even if their titles contain prices.
function looksLikeGuide(title, content) {
  const text = `${title} ${content}`.toLowerCase();

  const badPatterns = [
    /\bbuying guide\b/i,
    /\bbuying guides\b/i,
    /\bbest \d+ .* (?:products|laptops|phones|headphones|tv|tvs)\b/i,
    /\btop \d+ .* (?:products|laptops|phones|headphones|tv|tvs)\b/i,
    /\b\d+ best laptops\b/i,
    /\bhow to choose\b/i,
    /\bthings to know before buying\b/i,
    /\bproduct comparison guide\b/i,
    /\bbest .* for .* in \d{4}\b/i,
    /\breview roundup\b/i,
    /\bnews and updates\b/i,
    /\bcategory page\b/i
  ];

  return badPatterns.some((pattern) => pattern.test(text));
}

function matchesProductCategory(title, productType) {
  const text = normalizeText(title);
  const type = normalizeText(productType);

  const categoryTerms = {
    phone: [
      "phone", "smartphone", "iphone", "galaxy",
      "redmi", "poco", "pixel", "oneplus", "realme",
      "oppo", "vivo", "motorola", "nothing phone"
    ],
    laptop: [
      "laptop", "notebook", "macbook", "thinkpad",
      "vivobook", "ideapad", "pavilion", "inspiron",
      "aspire", "latitude", "zenbook", "chromebook"
    ],
    tv: [
      "television", "smart tv", " qled", " oled",
      "led tv", "google tv", "android tv"
    ],
    tablet: [
      "tablet", "ipad", "galaxy tab", "xiaomi pad",
      "oneplus pad", "lenovo tab"
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
      "monitor", "display", "computer screen"
    ],
    smartwatch: [
      "smartwatch", "smart watch", "watch series",
      "galaxy watch", "apple watch"
    ],
    camera: [
      "camera", "mirrorless", "dslr", "action camera"
    ]
  };

  let category = null;

  for (const key of Object.keys(categoryTerms)) {
    if (type.includes(key)) {
      category = key;
      break;
    }
  }

  // For broad or unlisted electronics categories, rely on
  // the individual-product URL and guide filters.
  if (!category) return true;

  return categoryTerms[category].some((term) =>
    text.includes(normalizeText(term))
  );
}

function isUsableProduct(result, marketplace, productType) {
  if (!result || !result.title || !result.url) {
    return false;
  }

  if (!isProductListingUrl(result.url, marketplace)) {
    return false;
  }

  if (looksLikeGuide(result.title, result.content)) {
    return false;
  }

  if (!matchesProductCategory(result.title, productType)) {
    return false;
  }

  const title = normalizeText(result.title);

  if (title.length < 5) return false;

  return true;
}

async function tavilySearch(query, domains) {
  if (!TAVILY_API_KEY) {
    throw new Error(
      "TAVILY_API_KEY is not configured in Render."
    );
  }

  const response = await fetchWithTimeout(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "basic",
        max_results: 10,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        include_domains: domains
      })
    },
    25000
  );

  const raw = await response.text();
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      "Marketplace search returned invalid data."
    );
  }

  if (!response.ok) {
    throw new Error(
      `Marketplace search error (${response.status}).`
    );
  }

  return (Array.isArray(data.results) ? data.results : [])
    .filter((item) => item && item.url)
    .map((item) => ({
      title: String(item.title || "").slice(0, 250),
      url: String(item.url || ""),
      content: String(item.content || "")
        .replace(/\s+/g, " ")
        .slice(0, 800)
    }));
}

function makeSearchQueries(input) {
  const type = String(input.productType || "electronics");
  const brand =
    input.brand && input.brand !== "Any"
      ? String(input.brand)
      : "";

  const uses = Array.isArray(input.uses)
    ? input.uses.slice(0, 6).join(" ")
    : "";

  const budget = Number(input.budget);
  const budgetText = Number.isFinite(budget)
    ? `under Rs ${budget}`
    : "";

  const common = [
    type,
    brand,
    uses,
    budgetText,
    "India exact model product price"
  ].filter(Boolean).join(" ");

  return [
    `${common} -guide -article -blog -roundup`,
    `${type} ${brand} actual product model price India ${budgetText}`
      .replace(/\s+/g, " ")
      .trim()
  ];
}

function deduplicateSearchResults(items) {
  const seen = new Set();

  return items.filter((item) => {
    try {
      const url = new URL(item.url);
      url.search = "";
      url.hash = "";

      const key = url.hostname + url.pathname;

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    } catch {
      return false;
    }
  });
}

async function searchMarketplace(queries, marketplace, domains, productType) {
  const results = await Promise.allSettled(
    queries.map((query) => tavilySearch(query, domains))
  );

  const combined = results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);

  const products = deduplicateSearchResults(combined)
    .filter((item) =>
      isUsableProduct(item, marketplace, productType)
    );

  if (!products.length) {
    const failure = results.find(
      (result) => result.status === "rejected"
    );

    if (failure) {
      console.warn(
        `${marketplace} search warning:`,
        failure.reason?.message
      );
    }
  }

  return products;
}

async function askGroq(input, amazonResults, flipkartResults) {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not configured in Render."
    );
  }

  const systemPrompt = `
You are OPITECH, an electronics recommendation assistant.

Return EXACTLY 3 DISTINCT products if at least 3 suitable
product listings are present in the supplied evidence.

STRICT RULES:
- Recommend real product models, not buying guides or articles.
- Every candidate has already passed product-page URL filtering.
- Never invent a product name, model, specification, or price.
- Choose products matching the requested product category.
- Prefer models within the user's budget.
- Never recommend the same model twice.
- Use the exact evidence index supplied.
- marketplace must be "amazon" or "flipkart".
- resultIndex must be the zero-based index in that marketplace list.
- Do not invent prices. The server will extract prices separately.
- If fewer than 3 suitable products are available, return only
  supported products. Never pad the list with invented products.

Return JSON only:
{
  "recommendations": [
    {
      "rank": 1,
      "name": "Exact product model from evidence",
      "brand": "Brand if known",
      "why": "Reason based on the supplied evidence and user needs",
      "strengths": ["Evidence-supported point"],
      "tradeoffs": ["Evidence-supported limitation"],
      "marketplace": "amazon",
      "resultIndex": 0,
      "matchScore": 85
    }
  ]
}
`;

  const userPrompt = {
    requirements: {
      productType: input.productType,
      country: input.country || "India",
      currency: input.currency || "INR",
      budget: Number(input.budget),
      uses: input.uses,
      priority: input.priority,
      brand: input.brand
    },
    requiredRecommendations: REQUIRED_COUNT,
    amazon: amazonResults.map((item, index) => ({
      resultIndex: index,
      title: item.title,
      content: item.content
    })),
    flipkart: flipkartResults.map((item, index) => ({
      resultIndex: index,
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
          {
            role: "user",
            content: JSON.stringify(userPrompt)
          }
        ],
        temperature: 0.1,
        max_tokens: 2200,
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
    throw new Error(
      `AI service error (${response.status}).`
    );
  }

  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("AI service returned an empty response.");
  }

  let result;

  try {
    result = JSON.parse(content);
  } catch {
    throw new Error(
      "AI service returned invalid recommendation data."
    );
  }

  if (!Array.isArray(result.recommendations)) {
    throw new Error(
      "AI response did not contain recommendations."
    );
  }

  return result.recommendations;
}

function getCandidatePrice(source) {
  // Only extract prices from results already confirmed to be
  // individual product pages. Snippet prices can still be stale.
  return extractPrice(
    `${source.title} ${source.content}`
  );
}

function normalizeRecommendations(
  aiItems,
  amazonResults,
  flipkartResults,
  budget,
  productType
) {
  const output = [];
  const seenNames = new Set();
  const seenSources = new Set();

  for (const item of aiItems.slice(0, 10)) {
    const marketplace =
      item.marketplace === "flipkart"
        ? "flipkart"
        : item.marketplace === "amazon"
          ? "amazon"
          : null;

    if (!marketplace) continue;

    const sourceList =
      marketplace === "amazon"
        ? amazonResults
        : flipkartResults;

    const index = Number(item.resultIndex);

    if (
      !Number.isInteger(index) ||
      index < 0 ||
      !sourceList[index]
    ) {
      continue;
    }

    const source = sourceList[index];

    // Revalidate the exact evidence item before accepting it.
    if (!isUsableProduct(source, marketplace, productType)) {
      continue;
    }

    const name = String(item.name || source.title).trim();

    if (
      looksLikeGuide(name, "") ||
      !matchesProductCategory(name, productType)
    ) {
      continue;
    }

    const normalizedName = normalizeText(name);
    const sourceKey = `${marketplace}:${index}`;

    if (
      !normalizedName ||
      seenNames.has(normalizedName) ||
      seenSources.has(sourceKey)
    ) {
      continue;
    }

    const price = getCandidatePrice(source);

    if (price !== null && price > budget * 1.15) {
      continue;
    }

    seenNames.add(normalizedName);
    seenSources.add(sourceKey);

    const score = Number(item.matchScore);

    output.push({
      rank: output.length + 1,
      name,
      brand: String(item.brand || ""),
      price,
      priceSource:
        marketplace === "amazon"
          ? "Amazon India product listing"
          : "Flipkart product listing",
      matchScore: Number.isFinite(score)
        ? Math.max(0, Math.min(100, score))
        : null,
      why: String(
        item.why ||
        "Compare the product's verified listing details against your needs."
      ),
      strengths: Array.isArray(item.strengths)
        ? item.strengths.slice(0, 4).map(String)
        : [],
      tradeoffs: Array.isArray(item.tradeoffs)
        ? item.tradeoffs.slice(0, 3).map(String)
        : [],
      imageUrl: null
    });

    if (output.length === REQUIRED_COUNT) break;
  }

  return output;
}

function fallbackRecommendations(
  amazonResults,
  flipkartResults,
  budget,
  productType,
  existingRecommendations = []
) {
  const all = [
    ...amazonResults.map((result) => ({
      result,
      marketplace: "amazon"
    })),
    ...flipkartResults.map((result) => ({
      result,
      marketplace: "flipkart"
    }))
  ];

  const existingNames = new Set(
    existingRecommendations.map((item) =>
      normalizeText(item.name)
    )
  );

  const candidates = all
    .filter(({ result, marketplace }) =>
      isUsableProduct(result, marketplace, productType)
    )
    .map((entry) => ({
      ...entry,
      price: getCandidatePrice(entry.result)
    }))
    .filter((item) => {
      if (
        item.price !== null &&
        item.price > budget * 1.15
      ) {
        return false;
      }

      const name = normalizeText(item.result.title);

      return name && !existingNames.has(name);
    });

  // Prefer results with a visible price, then those without one.
  candidates.sort((a, b) => {
    if (a.price === null && b.price !== null) return 1;
    if (a.price !== null && b.price === null) return -1;

    if (a.price !== null && b.price !== null) {
      return a.price - b.price;
    }

    return 0;
  });

  const output = [];
  const seenNames = new Set(existingNames);

  for (const item of candidates) {
    const name = String(item.result.title || "").trim();
    const key = normalizeText(name);

    if (!key || seenNames.has(key)) continue;

    seenNames.add(key);

    output.push({
      rank: existingRecommendations.length + output.length + 1,
      name,
      brand: "",
      price: item.price,
      priceSource:
        item.marketplace === "amazon"
          ? "Amazon India product listing"
          : "Flipkart product listing",
      matchScore: null,
      why:
        "This is an individual product listing found on a supported marketplace. Compare its model, configuration, and current price with your requirements.",
      strengths: ["Individual product listing found"],
      tradeoffs: [
        "AI ranking unavailable; verify specifications and current price"
      ],
      imageUrl: null
    });

    if (
      existingRecommendations.length + output.length >=
      REQUIRED_COUNT
    ) {
      break;
    }
  }

  return output;
}

app.post("/recommendations", async (req, res) => {
  const input = req.body || {};
  const budget = Number(input.budget);
  const productType = String(input.productType || "Phone");

  if (!Number.isFinite(budget) || budget <= 0) {
    return res.status(400).json({
      error: "Please enter a valid budget."
    });
  }

  if (!TAVILY_API_KEY) {
    return res.status(503).json({
      error:
        "Marketplace search is not configured. Add TAVILY_API_KEY in Render environment variables."
    });
  }

  try {
    const queries = makeSearchQueries(input);

    const searchResults = await Promise.allSettled([
      searchMarketplace(
        queries,
        "amazon",
        ["amazon.in"],
        productType
      ),
      searchMarketplace(
        queries,
        "flipkart",
        ["flipkart.com"],
        productType
      )
    ]);

    const amazonResults =
      searchResults[0].status === "fulfilled"
        ? searchResults[0].value
        : [];

    const flipkartResults =
      searchResults[1].status === "fulfilled"
        ? searchResults[1].value
        : [];

    console.log("OPITECH validated search results:", {
      productType,
      amazonProducts: amazonResults.length,
      flipkartProducts: flipkartResults.length
    });

    const totalProducts =
      amazonResults.length + flipkartResults.length;

    if (totalProducts < REQUIRED_COUNT) {
      return res.status(502).json({
        error:
          `Only ${totalProducts} individual product listings passed validation. ` +
          "The search did not find three suitable products. Try again or adjust your category, brand, or budget."
      });
    }

    let recommendations = [];
    let aiUnavailable = false;

    try {
      const aiItems = await askGroq(
        input,
        amazonResults,
        flipkartResults
      );

      recommendations = normalizeRecommendations(
        aiItems,
        amazonResults,
        flipkartResults,
        budget,
        productType
      );
    } catch (error) {
      console.error("OPITECH AI fallback:", error.message);
      aiUnavailable = true;
    }

    // Fill missing slots only with other validated product listings.
    if (recommendations.length < REQUIRED_COUNT) {
      const fallback = fallbackRecommendations(
        amazonResults,
        flipkartResults,
        budget,
        productType,
        recommendations
      );

      recommendations = [
        ...recommendations,
        ...fallback
      ].slice(0, REQUIRED_COUNT);

      aiUnavailable = true;
    }

    if (recommendations.length !== REQUIRED_COUNT) {
      return res.status(502).json({
        error:
          `OPITECH could verify only ${recommendations.length} distinct product listings that fit the current filters. ` +
          "No articles or buying guides were used to fill missing recommendations. Try again or adjust your search."
      });
    }

    recommendations = recommendations.map((item, index) => ({
      ...item,
      rank: index + 1
    }));

    return res.json({
      recommendations,
      recommendationCount: recommendations.length,
      notice: aiUnavailable
        ? "Some options were selected directly from validated marketplace product listings because AI ranking was unavailable. Confirm model details and current prices before deciding."
        : "Recommendations use individual marketplace product listings. Search snippets can be outdated, so confirm the current price and configuration before buying."
    });
  } catch (error) {
    console.error(
      "OPITECH recommendation error:",
      error.message
    );

    return res.status(502).json({
      error:
        error.message ||
        "Could not prepare recommendations. Please try again."
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `OPITECH backend listening on port ${PORT}`
  );
});
