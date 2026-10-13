
"use strict";

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const GROQ_MODEL = "openai/gpt-oss-20b";

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "OPITECH AI backend is running",
    ai: "Groq + Tavily",
    marketplaces: ["Amazon India", "Flipkart"],
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

async function fetchWithTimeout(url, options = {}, timeout = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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
    if (Number.isFinite(amount) && amount >= 500 && amount <= 10000000) {
      return amount;
    }
  }

  return null;
}

function isAllowedMarketplaceUrl(url, marketplace) {
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) return false;

    const host = parsed.hostname.toLowerCase();

    if (marketplace === "amazon") {
      return host === "amazon.in" || host.endsWith(".amazon.in");
    }

    if (marketplace === "flipkart") {
      return host === "flipkart.com" || host.endsWith(".flipkart.com");
    }

    return false;
  } catch {
    return false;
  }
}

async function tavilySearch(query, domains) {
  if (!TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not configured in Render.");
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
        max_results: 5,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        include_domains: domains
      })
    },
    20000
  );

  const raw = await response.text();
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Marketplace search returned invalid data.");
  }

  if (!response.ok) {
    throw new Error(`Marketplace search error (${response.status}).`);
  }

  return (Array.isArray(data.results) ? data.results : [])
    .filter((item) => item && item.url)
    .map((item) => ({
      title: String(item.title || "").slice(0, 250),
      url: String(item.url || ""),
      content: String(item.content || "").replace(/\s+/g, " ").slice(0, 600)
    }));
}

function makeSearchQuery(input) {
  const uses = Array.isArray(input.uses) ? input.uses.slice(0, 8).join(", ") : "";
  const parts = [
    input.productType || "electronics",
    input.brand && input.brand !== "Any" ? input.brand : "",
    uses,
    input.priority || "Balanced",
    "price in India",
    "product model"
  ].filter(Boolean);

  return parts.join(" ");
}

async function askGroq(input, amazonResults, flipkartResults) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured in Render.");
  }

  const systemPrompt = `
You are OPITECH, an electronics recommendation assistant.
Use only the supplied marketplace search evidence. Never invent products, prices, specs, or claims.
Return JSON only in this format:
{
  "recommendations": [
    {
      "rank": 1,
      "name": "Exact product/model name from evidence",
      "brand": "Brand if known",
      "why": "Short reason based on the user's needs and the evidence",
      "strengths": ["Strength"],
      "tradeoffs": ["Trade-off"],
      "marketplace": "amazon",
      "resultIndex": 0,
      "matchScore": 85
    }
  ]
}
Choose at most 3 distinct, relevant products.
marketplace must be "amazon" or "flipkart".
resultIndex must refer to the zero-based item in the matching marketplace evidence array.
If there is not enough evidence for a recommendation, return fewer results rather than inventing one.
Do not include URLs or images in the response.
`;

  const userPrompt = {
    requirements: {
      productType: input.productType,
      country: input.country,
      currency: input.currency,
      budget: input.budget,
      uses: input.uses,
      priority: input.priority,
      brand: input.brand
    },
    marketplaceEvidence: {
      amazon: amazonResults.map((x) => ({ title: x.title, content: x.content })),
      flipkart: flipkartResults.map((x) => ({ title: x.title, content: x.content }))
    }
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
        max_tokens: 1300,
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
    throw new Error(`AI service error (${response.status}).`);
  }

  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("AI service returned an empty response.");
  }

  let result;
  try {
    result = JSON.parse(content);
  } catch {
    throw new Error("AI service returned invalid recommendation data.");
  }

  if (!Array.isArray(result.recommendations)) {
    throw new Error("AI response did not contain recommendations.");
  }

  return result.recommendations;
}

function fallbackRecommendations(amazonResults, flipkartResults, budget) {
  const all = [
    ...amazonResults.map((result) => ({ result, marketplace: "amazon" })),
    ...flipkartResults.map((result) => ({ result, marketplace: "flipkart" }))
  ].map((entry) => ({
    ...entry,
    price: extractPrice(`${entry.result.title} ${entry.result.content}`)
  }));

  const withinBudget = all.filter((item) =>
    item.price === null || item.price <= budget * 1.15
  );

  const chosen = (withinBudget.length ? withinBudget : all).slice(0, 3);

  return chosen.map((item, index) => ({
    rank: index + 1,
    name: item.result.title || "Marketplace result",
    brand: "",
    price: item.price,
    priceSource: item.marketplace === "amazon" ? "Amazon India search result" : "Flipkart search result",
    matchScore: null,
    why: "This item appeared in marketplace search results. Its exact fit and specifications still need to be checked.",
    strengths: ["Found in marketplace search"],
    tradeoffs: ["AI ranking was unavailable; verify the model and current price"],
    imageUrl: null
  }));
}

function normalizeRecommendations(aiItems, amazonResults, flipkartResults, budget) {
  const output = [];
  const seen = new Set();

  for (const item of aiItems.slice(0, 8)) {
    const marketplace = item.marketplace === "flipkart" ? "flipkart" : "amazon";
    const sourceList = marketplace === "amazon" ? amazonResults : flipkartResults;
    const index = Number(item.resultIndex);

    if (!Number.isInteger(index) || index < 0 || !sourceList[index]) continue;

    const source = sourceList[index];
    const name = String(item.name || source.title || "").trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());

    const sourcePrice = extractPrice(`${source.title} ${source.content}`);
    const price = sourcePrice;

    if (price !== null && price > budget * 1.15) continue;

    const score = Number(item.matchScore);

    output.push({
      rank: output.length + 1,
      name,
      brand: String(item.brand || ""),
      price,
      priceSource: marketplace === "amazon" ? "Amazon India search result" : "Flipkart search result",
      matchScore: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null,
      why: String(item.why || "Compare this model against your selected needs."),
      strengths: Array.isArray(item.strengths) ? item.strengths.slice(0, 4).map(String) : [],
      tradeoffs: Array.isArray(item.tradeoffs) ? item.tradeoffs.slice(0, 3).map(String) : [],
      imageUrl: null
    });

    if (output.length === 3) break;
  }

  return output;
}

app.post("/recommendations", async (req, res) => {
  const input = req.body || {};
  const budget = Number(input.budget);

  if (!Number.isFinite(budget) || budget <= 0) {
    return res.status(400).json({ error: "Please enter a valid budget." });
  }

  if (!TAVILY_API_KEY) {
    return res.status(503).json({
      error: "Marketplace search is not configured. Add TAVILY_API_KEY in Render environment variables."
    });
  }

  try {
    const query = makeSearchQuery(input);

    const searchResults = await Promise.allSettled([
      tavilySearch(`${query} site:amazon.in`, ["amazon.in"]),
      tavilySearch(`${query} site:flipkart.com`, ["flipkart.com"])
    ]);

    const amazonResults = searchResults[0].status === "fulfilled"
      ? searchResults[0].value.filter((item) => isAllowedMarketplaceUrl(item.url, "amazon"))
      : [];

    const flipkartResults = searchResults[1].status === "fulfilled"
      ? searchResults[1].value.filter((item) => isAllowedMarketplaceUrl(item.url, "flipkart"))
      : [];

    if (!amazonResults.length && !flipkartResults.length) {
      const reason = searchResults
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason?.message)
        .filter(Boolean)[0];

      throw new Error(reason || "No marketplace results were found. Try another category or search later.");
    }

    let recommendations = [];
    let aiUnavailable = false;

    try {
      const aiItems = await askGroq(input, amazonResults, flipkartResults);
      recommendations = normalizeRecommendations(aiItems, amazonResults, flipkartResults, budget);
    } catch (error) {
      console.error("OPITECH AI fallback:", error.message);
      aiUnavailable = true;
    }

    if (!recommendations.length) {
      recommendations = fallbackRecommendations(amazonResults, flipkartResults, budget);
      aiUnavailable = true;
    }

    if (!recommendations.length) {
      throw new Error("Search results were found, but no usable recommendations could be prepared.");
    }

    return res.json({
      recommendations: recommendations.slice(0, 3),
      notice: aiUnavailable
        ? "Marketplace search fallback used. Check product details and prices before deciding."
        : "Prices are extracted from available marketplace search snippets and may be outdated."
    });
  } catch (error) {
    console.error("OPITECH recommendation error:", error.message);
    return res.status(502).json({
      error: error.message || "Could not prepare recommendations. Please try again."
    });
  }
});

app.listen(PORT, () => {
  console.log(`OPITECH backend listening on port ${PORT}`);
});
