const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

if (!GROQ_API_KEY) {
    console.error("❌ GROQ_API_KEY is missing!");
}

if (!TAVILY_API_KEY) {
    console.error("❌ TAVILY_API_KEY is missing!");
}


/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
    res.json({
        status: "online",
        message: "OPITECH AI backend is running 🚀",
        ai: "Groq + Tavily Web Search"
    });
});


/* =========================
   TAVILY SEARCH
========================= */

async function searchProducts(query) {

    if (!TAVILY_API_KEY) {
        throw new Error("TAVILY_API_KEY is missing");
    }

    console.log("🔎 Searching Tavily:", query);

    const response = await fetch(
        "https://api.tavily.com/search",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                api_key: TAVILY_API_KEY,
                query: query,
                search_depth: "basic",
                topic: "general",
                max_results: 5,
                include_answer: false,
                include_raw_content: false,
                include_images: false
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {

        console.error("❌ Tavily error:", data);

        throw new Error(
            data.message ||
            data.detail ||
            "Tavily search failed"
        );
    }

    console.log(
        `✅ Tavily returned ${data.results?.length || 0} results`
    );

    return data.results || [];
}


/* =========================
   CLEAN AI JSON
========================= */

function extractJSON(text) {

    if (!text || typeof text !== "string") {
        throw new Error("AI returned an empty response");
    }

    let cleaned = text.trim();

    /*
       Remove markdown code fences
       Example:

       ```json
       {
          ...
       }
       ```
    */

    cleaned = cleaned
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();


    /*
       Find the first JSON object.
       This protects against the model adding
       a small sentence before the JSON.
    */

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (
        firstBrace === -1 ||
        lastBrace === -1 ||
        lastBrace <= firstBrace
    ) {
        throw new Error(
            "AI response did not contain a valid JSON object"
        );
    }

    cleaned = cleaned.substring(
        firstBrace,
        lastBrace + 1
    );


    try {

        return JSON.parse(cleaned);

    } catch (error) {

        console.error("❌ JSON parse error");
        console.error("AI output:");
        console.error(cleaned);

        throw new Error(
            "AI returned invalid JSON"
        );
    }
}


/* =========================
   VALIDATE RECOMMENDATIONS
========================= */

function validateRecommendations(data) {

    if (!data || typeof data !== "object") {
        throw new Error("AI returned invalid data");
    }

    if (
        !Array.isArray(data.recommendations)
    ) {
        throw new Error(
            "AI response does not contain recommendations"
        );
    }

    if (
        data.recommendations.length < 1
    ) {
        throw new Error(
            "AI returned no recommendations"
        );
    }

    /*
       Make sure every recommendation has
       the fields the frontend expects.
    */

    data.recommendations =
        data.recommendations.map(
            (item, index) => {

                return {

                    rank:
                        Number(item.rank) ||
                        index + 1,

                    name:
                        item.name ||
                        "Unknown product",

                    price:
                        item.price ||
                        "Price unavailable",

                    priceSource:
                        item.priceSource ||
                        "Web search",

                    matchScore:
                        Number(item.matchScore) ||
                        0,

                    why:
                        item.why ||
                        "Matches the requested requirements.",

                    strengths:
                        Array.isArray(item.strengths)
                            ? item.strengths.slice(0, 3)
                            : [],

                    tradeoffs:
                        Array.isArray(item.tradeoffs)
                            ? item.tradeoffs.slice(0, 2)
                            : []

                };

            }
        );

    /*
       Sort by rank
    */

    data.recommendations.sort(
        (a, b) =>
            Number(a.rank) -
            Number(b.rank)
    );

    return data;
}


/* =========================
   GROQ AI
========================= */

async function generateWithGroq(prompt) {

    if (!GROQ_API_KEY) {
        throw new Error(
            "GROQ_API_KEY is missing"
        );
    }

    console.log(
        "🤖 Sending request to Groq..."
    );

    const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization":
                    `Bearer ${GROQ_API_KEY}`
            },

            body: JSON.stringify({

                model:
                    "openai/gpt-oss-20b",

                messages: [

                    {
                        role: "system",

                        content: `
You are OPITECH, an electronics recommendation AI.

Your job is to analyze supplied web-search results and recommend real electronics products.

IMPORTANT RULES:

1. Use ONLY information contained in the supplied search results.
2. Never invent product names.
3. Never invent prices.
4. Never invent specifications.
5. Prefer current prices.
6. Respect the user's maximum budget.
7. Respect the preferred brand when possible.
8. Consider the user's use cases and priority.
9. Return exactly 3 recommendations when enough products exist.
10. Return ONLY valid JSON.
11. Do NOT use markdown.
12. Do NOT put the JSON inside code fences.
13. Do NOT add explanations before or after the JSON.

The JSON must have this structure:

{
  "recommendations": [
    {
      "rank": 1,
      "name": "Exact product model",
      "price": "₹24999",
      "priceSource": "Website name",
      "matchScore": 95,
      "why": "Short explanation",
      "strengths": [
        "Strength 1",
        "Strength 2",
        "Strength 3"
      ],
      "tradeoffs": [
        "Tradeoff 1",
        "Tradeoff 2"
      ]
    }
  ]
}
`
                    },

                    {
                        role: "user",
                        content: prompt
                    }

                ],

                temperature: 0.1,

                max_completion_tokens: 1200

            })
        }
    );

    const data = await response.json();


    if (!response.ok) {

        console.error(
            "❌ Groq error:",
            JSON.stringify(data, null, 2)
        );

        throw new Error(
            data.error?.message ||
            "Groq request failed"
        );
    }


    const text =
        data.choices?.[0]?.message?.content ||
        "";


    console.log(
        "========== RAW GROQ RESPONSE =========="
    );

    console.log(text);

    console.log(
        "========================================="
    );


    return text;
}


/* =========================
   RECOMMENDATION API
========================= */

app.post(
    "/api/recommend",
    async (req, res) => {

        try {

            const {
                productType,
                country,
                currency,
                budget,
                uses,
                priority,
                brand
            } = req.body;


            console.log(
                "📥 Received preferences:",
                {
                    productType,
                    country,
                    currency,
                    budget,
                    uses,
                    priority,
                    brand
                }
            );


            /* =========================
               VALIDATION
            ========================= */

            if (!productType) {

                return res.status(400).json({
                    error:
                        "Product type is required"
                });

            }


            if (!budget) {

                return res.status(400).json({
                    error:
                        "Budget is required"
                });

            }


            /* =========================
               USER DATA
            ========================= */

            const useText =
                Array.isArray(uses)
                    ? uses.join(", ")
                    : (uses || "general use");


            const brandText =
                brand &&
                brand.toLowerCase() !== "any"
                    ? brand
                    : "";


            /* =========================
               SEARCH QUERIES
            ========================= */

            const searchQueries = [

                `${brandText} ${productType} ${useText} under ${budget} ${currency} ${country}`,

                `best ${productType} ${brandText} ${useText} ${country} current price specifications`,

                `${brandText} ${productType} ${country} price specifications official`

            ];


            /* =========================
               SEARCH WEB
            ========================= */

            let allResults = [];


            for (
                const query
                of searchQueries
            ) {

                try {

                    const results =
                        await searchProducts(
                            query
                        );

                    allResults.push(
                        ...results
                    );

                } catch (searchError) {

                    console.error(
                        "⚠️ Search failed:",
                        searchError.message
                    );

                }

            }


            /* =========================
               REMOVE DUPLICATES
            ========================= */

            const uniqueResults = [];

            const seenUrls =
                new Set();


            for (
                const result
                of allResults
            ) {

                if (
                    result.url &&
                    !seenUrls.has(
                        result.url
                    )
                ) {

                    seenUrls.add(
                        result.url
                    );

                    uniqueResults.push(
                        result
                    );

                }

            }


            console.log(
                `📊 Unique search results: ${uniqueResults.length}`
            );


            if (
                uniqueResults.length === 0
            ) {

                return res.status(500).json({

                    error:
                        "No current product information was found.",

                    details:
                        "Tavily returned no usable search results."

                });

            }


            /* =========================
               COMPRESS SEARCH DATA
            ========================= */

            const searchData =
                uniqueResults
                    .slice(0, 8)
                    .map(
                        (result, index) => {

                            const content =
                                (
                                    result.content ||
                                    ""
                                )
                                    .replace(
                                        /\s+/g,
                                        " "
                                    )
                                    .slice(
                                        0,
                                        650
                                    );


                            return `
RESULT ${index + 1}

Title:
${result.title || "Unknown"}

URL:
${result.url || "Unknown"}

Content:
${content}
`;

                        }
                    )
                    .join("\n");


            console.log(
                `📦 Sending ${searchData.length} characters of search data to Groq`
            );


            /* =========================
               AI PROMPT
            ========================= */

            const prompt = `
USER REQUIREMENTS

Product type: ${productType}

Country:
${country || "India"}

Currency:
${currency || "INR"}

Maximum budget:
${budget}

Uses:
${useText}

Priority:
${priority || "general"}

Preferred brand:
${brand || "any"}


TASK

Analyze ONLY the search results below.

Select exactly 3 different real products whenever at least 3 suitable products are present.

The recommendations should:

- Be real products.
- Use exact model names.
- Prefer products within the maximum budget.
- Respect the preferred brand.
- Match the user's use cases.
- Match the user's priority.
- Use prices that appear in the supplied search results.
- Prefer current prices.
- Prefer reputable retailers or official manufacturer information.
- Never invent missing information.


IMPORTANT

If a product's exact price is not supported by the search results, write:

"Price unavailable"

instead of guessing.

Do not invent specifications.

Return ONLY JSON.


SEARCH RESULTS

${searchData}


OUTPUT FORMAT

{
  "recommendations": [
    {
      "rank": 1,
      "name": "Exact Product Model",
      "price": "₹24999",
      "priceSource": "Source website",
      "matchScore": 95,
      "why": "Short explanation",
      "strengths": [
        "Strength 1",
        "Strength 2",
        "Strength 3"
      ],
      "tradeoffs": [
        "Tradeoff 1",
        "Tradeoff 2"
      ]
    },
    {
      "rank": 2,
      "name": "Exact Product Model",
      "price": "₹24999",
      "priceSource": "Source website",
      "matchScore": 90,
      "why": "Short explanation",
      "strengths": [
        "Strength 1",
        "Strength 2",
        "Strength 3"
      ],
      "tradeoffs": [
        "Tradeoff 1",
        "Tradeoff 2"
      ]
    },
    {
      "rank": 3,
      "name": "Exact Product Model",
      "price": "₹24999",
      "priceSource": "Source website",
      "matchScore": 85,
      "why": "Short explanation",
      "strengths": [
        "Strength 1",
        "Strength 2",
        "Strength 3"
      ],
      "tradeoffs": [
        "Tradeoff 1",
        "Tradeoff 2"
      ]
    }
  ]
}
`;


            /* =========================
               CALL GROQ
            ========================= */

            const aiText =
                await generateWithGroq(
                    prompt
                );


            /* =========================
               PARSE AI JSON
            ========================= */

            let resultData;


            try {

                resultData =
                    extractJSON(
                        aiText
                    );

                resultData =
                    validateRecommendations(
                        resultData
                    );

            } catch (jsonError) {

                console.error(
                    "❌ AI JSON validation failed:",
                    jsonError.message
                );

                return res.status(500).json({

                    error:
                        "AI returned invalid recommendation data.",

                    details:
                        jsonError.message

                });

            }


            /* =========================
               SEND TO FRONTEND
            ========================= */

            console.log(
                `✅ Returning ${resultData.recommendations.length} recommendations`
            );


            return res.json({

                success: true,

                recommendations:
                    resultData.recommendations,

                result:
                    resultData.recommendations

            });

        } catch (error) {

            console.error(
                "❌ OPITECH AI generation failed:"
            );

            console.error(error);


            return res.status(500).json({

                error:
                    "AI generation failed",

                details:
                    error.message ||
                    "Unknown error",

                type:
                    error.name ||
                    "UnknownError",

                code:
                    error.status ||
                    error.code ||
                    null

            });

        }

    }
);


/* =========================
   START SERVER
========================= */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🚀 OPITECH BACKEND IS LIVE ON PORT ${PORT}`
        );

    }
);
