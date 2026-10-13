
"use strict";

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const GROQ_MODEL = "openai/gpt-oss-20b";
const REQUIRED_RECOMMENDATIONS = 3;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "OPITECH AI backend is running",
    ai: "Groq + Tavily",
    marketplaces: ["Amazon India", "Flipkart"],
    recommendationsPerRequest: REQUIRED_RECOMMENDATIONS,
    images: false,
    productLinksInFrontend: false
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    groqConfigured: Boolean(GROQ_API_KEY),
    tavilyConfigured: Boolean(TAVILY_API_KEY),
    recommendationsPerRequest: REQUIRED_RECOMMENDATIONS
  });
});

async function fetchWithTimeout(url, options = {}, timeout = 20000) {
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
      return host === "amazon.in" || host.endsWith(".amazon.in");
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
    20000
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
        .slice(0, 600)
    }))
    .filter((item) => item.title);
}

function makeSearchQuery(input) {
  const uses = Array.isArray(input.uses)
    ? input.uses.slice(0, 8).join(", ")
    : "";

  return [
    input.productType || "electronics",
    input.brand && input.brand !== "Any"
      ? input.brand
      : "",
    uses,
    input.priority || "Balanced",
    "India price specifications product model"
  ].filter(Boolean).join(" ");
}

async function askGroq(input, amazonResults, flipkartResults) {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not configured in Render."
    );
  }

  const systemPrompt = `
You are OPITECH, an electronics recommendation assistant.

Your goal is to return EXACTLY 3 DISTINCT product recommendations
whenever the supplied marketplace evidence contains at least
3 distinct, relevant products.

IMPORTANT RULES:
1. Return 3 recommendations, not 1 or 2, whenever evidence permits.
2. Recommend three different product models, not three listings
   of the same model.
3. Use only the supplied Amazon India and Flipkart evidence.
4. Never invent a product, price, specification, or feature.
5. Respect the user's selected product category and budget.
6. Prefer products within the user's budget.
7. If a price is unknown, do not invent one.
8. Select the best three different matches for the user's needs.
9. Use the exact zero-based resultIndex of the chosen evidence.
10. marketplace must be exactly "amazon" or "flipkart".
11. Do not include URLs or images.
12. If fewer than three distinct relevant products exist in the
    evidence, return only the genuinely supported products.

Return valid JSON only, in this format:
{
  "recommendations": [
    {
      "rank": 1,
      "name": "Exact product model from evidence",
      "brand": "Brand if known",
      "why": "Reason based on user needs and evidence",
      "strengths": ["Evidence-supported strength"],
      "tradeoffs": ["Evidence-supported trade-off"],
      "marketplace": "amazon",
      "resultIndex": 0,
      "matchScore": 85
    }
  ]
}

Rank recommendations from best overall match to third-best match.
Do not add markdown or explanatory text outside the JSON.
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
    requiredRecommendationCount: REQUIRED_RECOMMENDATIONS,
    marketplaceEvidence: {
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
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: JSON.stringify(userPrompt)
          }
        ],
        temperature: 0.1,
        max_tokens: 2200,
        response_format: {
          type: "json_object"
        }
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

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(official|online|buy|price|deal|offer)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function fallbackRecommendations(
  amazonResults,
  flipkartResults,
  budget
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
  ].map((entry) => ({
    ...entry,
    price: extractPrice(
      `${entry.result.title} ${entry.result.content}`
    )
  }));

  const seen = new Set();

  const unique = all.filter((item) => {
    const key = normalizeName(item.result.title);

    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });

  const affordable = unique.filter(
    (item) =>
      item.price === null ||
      item.price <= budget * 1.15
  );

  const unknownPrice = affordable.filter(
    (item) => item.price === null
  );

  const priced = affordable.filter(
    (item) => item.price !== null
  );

  priced.sort((a, b) => a.price - b.price);

  // Prefer results with a detected price, then fill remaining
  // positions with results whose prices could not be extracted.
  const candidates = [...priced, ...unknownPrice];

  return candidates
    .slice(0, REQUIRED_RECOMMENDATIONS)
    .map((item, index) => ({
      rank: index + 1,
      name: item.result.title,
      brand: "",
      price: item.price,
      priceSource:
        item.marketplace === "amazon"
          ? "Amazon India search result"
          : "Flipkart search result",
      matchScore: null,
      why:
        "Found in marketplace search results. Check the exact model and specifications before deciding.",
      strengths: [
        "Found in marketplace search"
      ],
      tradeoffs: [
        "AI ranking unavailable; verify the model and current price"
      ],
      imageUrl: null
    }));
}

function normalizeRecommendations(
  aiItems,
  amazonResults,
  flipkartResults,
  budget
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
    const name = String(
      item.name || source.title || ""
    ).trim();

    const normalizedName = normalizeName(name);
    const sourceKey = `${marketplace}:${index}`;

    if (
      !name ||
      !normalizedName ||
      seenNames.has(normalizedName) ||
      seenSources.has(sourceKey)
    ) {
      continue;
    }

    const price = extractPrice(
      `${source.title} ${source.content}`
    );

    // Reject clearly over-budget products.
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
          ? "Amazon India search result"
          : "Flipkart search result",
      matchScore: Number.isFinite(score)
        ? Math.max(0, Math.min(100, score))
        : null,
      why: String(
        item.why ||
        "Compare this model against your selected needs."
      ),
      strengths: Array.isArray(item.strengths)
        ? item.strengths.slice(0, 4).map(String)
        : [],
      tradeoffs: Array.isArray(item.tradeoffs)
        ? item.tradeoffs.slice(0, 3).map(String)
        : [],
      imageUrl: null
    });

    if (output.length === REQUIRED_RECOMMENDATIONS) {
      break;
    }
  }

  return output;
}

app.post("/recommendations", async (req, res) => {
  const input = req.body || {};
  const budget = Number(input.budget);

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
    const query = makeSearchQuery(input);

    const searchResults = await Promise.allSettled([
      tavilySearch(
        `${query} site:amazon.in`,
        ["amazon.in"]
      ),
      tavilySearch(
        `${query} site:flipkart.com`,
        ["flipkart.com"]
      )
    ]);

    const amazonResults =
      searchResults[0].status === "fulfilled"
        ? searchResults[0].value.filter(
            (item) =>
              isAllowedMarketplaceUrl(item.url, "amazon")
          )
        : [];

    const flipkartResults =
      searchResults[1].status === "fulfilled"
        ? searchResults[1].value.filter(
            (item) =>
              isAllowedMarketplaceUrl(item.url, "flipkart")
          )
        : [];

    if (!amazonResults.length && !flipkartResults.length) {
      const reason = searchResults
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason?.message)
        .filter(Boolean)[0];

      throw new Error(
        reason ||
        "No marketplace results were found. Try another search."
      );
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
        budget
      );
    } catch (error) {
      console.error(
        "OPITECH AI fallback:",
        error.message
      );

      aiUnavailable = true;
    }

    // Recover missing recommendations from distinct search results.
    // Never fabricate products just to fill three cards.
    if (recommendations.length < REQUIRED_RECOMMENDATIONS) {
      const fallback = fallbackRecommendations(
        amazonResults,
        flipkartResults,
        budget
      );

      const existingNames = new Set(
        recommendations.map((item) =>
          normalizeName(item.name)
        )
      );

      for (const item of fallback) {
        const key = normalizeName(item.name);

        if (!key || existingNames.has(key)) continue;

        existingNames.add(key);

        recommendations.push({
          ...item,
          rank: recommendations.length + 1
        });

        if (
          recommendations.length ===
          REQUIRED_RECOMMENDATIONS
        ) {
          break;
        }
      }

      if (recommendations.length > 0) {
        aiUnavailable = true;
      }
    }

    // Do not return a misleading one- or two-card result.
    if (recommendations.length !== REQUIRED_RECOMMENDATIONS) {
      return res.status(502).json({
        error:
          `OPITECH could verify only ${recommendations.length} distinct recommendations. ` +
          "Please try again or adjust your category, brand, or budget."
      });
    }

    recommendations = recommendations
      .slice(0, REQUIRED_RECOMMENDATIONS)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

    return res.json({
      recommendations,
      recommendationCount: recommendations.length,
      notice: aiUnavailable
        ? "Some recommendations were selected directly from marketplace search results because the AI could not supply three distinct matches. Verify model details and prices."
        : "Prices are extracted from marketplace search snippets and may be outdated."
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
