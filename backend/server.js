const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

if (!GROQ_API_KEY) {
    console.error("GROQ_API_KEY is missing!");
}

if (!TAVILY_API_KEY) {
    console.error("TAVILY_API_KEY is missing!");
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

    console.log("Searching Tavily:", query);

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

        console.error("Tavily error:", data);

        throw new Error(
            data.message ||
            data.detail ||
            "Tavily search failed"
        );
    }

    console.log(
        `Tavily returned ${data.results?.length || 0} results`
    );

    return data.results || [];
}


/* =========================
   GROQ AI
========================= */

async function generateWithGroq(prompt) {

    if (!GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is missing");
    }

    console.log("Sending optimized request to Groq...");

    const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GROQ_API_KEY}`
            },

            body: JSON.stringify({

                model: "openai/gpt-oss-20b",

                messages: [

                    {
                        role: "system",

                        content: `
You are OPITECH, an electronics recommendation AI.

Use ONLY the supplied web-search evidence.

Recommend exactly 3 real products.

Never invent product names, prices, or specifications.

Return ONLY valid JSON.
`
                    },

                    {
                        role: "user",
                        content: prompt
                    }

                ],

                temperature: 0.2,

                max_completion_tokens: 1200,

                response_format: {
                    type: "json_object"
                }

            })
        }
    );

    const data = await response.json();

    if (!response.ok) {

        console.error("Groq error:", data);

        throw new Error(
            data.error?.message ||
            "Groq request failed"
        );
    }

    const text =
        data.choices?.[0]?.message?.content || "";

    console.log("RAW GROQ RESPONSE:");
    console.log(text);

    return text;
}


/* =========================
   RECOMMENDATION API
========================= */

app.post("/api/recommend", async (req, res) => {

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
            "Received preferences:",
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
                error: "Product type is required"
            });

        }

        if (!budget) {

            return res.status(400).json({
                error: "Budget is required"
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

            `best ${productType} ${brandText} ${useText} ${country} current price`,

            `${brandText} ${productType} ${country} price specifications`

        ];


        /* =========================
           SEARCH WEB
        ========================= */

        let allResults = [];


        for (const query of searchQueries) {

            try {

                const results =
                    await searchProducts(query);

                allResults.push(...results);

            } catch (searchError) {

                console.error(
                    "Search query failed:",
                    searchError.message
                );

            }

        }


        /* =========================
           REMOVE DUPLICATES
        ========================= */

        const uniqueResults = [];

        const seenUrls = new Set();


        for (const result of allResults) {

            if (
                result.url &&
                !seenUrls.has(result.url)
            ) {

                seenUrls.add(result.url);

                uniqueResults.push(result);

            }

        }


        console.log(
            `Total unique search results: ${uniqueResults.length}`
        );


        if (uniqueResults.length === 0) {

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
                .map((result, index) => {

                    const content =
                        (result.content || "")
                            .replace(/\s+/g, " ")
                            .slice(0, 700);

                    return `
RESULT ${index + 1}
Title: ${result.title || "Unknown"}
URL: ${result.url || "Unknown"}
Content: ${content}
`;

                })
                .join("\n");


        console.log(
            `Sending ${searchData.length} characters of search data to Groq`
        );


        /* =========================
           AI PROMPT
        ========================= */

        const prompt = `
USER REQUIREMENTS

Product type: ${productType}
Country: ${country}
Currency: ${currency}
Maximum budget: ${budget}
Uses: ${useText}
Priority: ${priority || "general"}
Preferred brand: ${brand || "any"}

TASK

Using ONLY the current search results below, select exactly 3 real products.

Rules:

- Use exact product models.
- Prefer products within the budget.
- Respect the preferred brand when suitable products exist.
- Consider the user's use cases and priority.
- Use only prices supported by the search results.
- Do not invent prices.
- Do not invent specifications.
- Prefer current prices over launch prices.
- Prefer official manufacturers and reputable retailers.
- Each recommendation must be different.
- Return exactly 3 products.

SEARCH RESULTS

${searchData}

RETURN ONLY THIS JSON:

{
  "recommendations": [
    {
      "rank": 1,
      "name": "Exact Product Model",
      "price": "₹24999",
      "priceSource": "Source",
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
      "priceSource": "Source",
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
      "priceSource": "Source",
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

        const text =
            await generateWithGroq(prompt);


        /* =========================
           PARSE JSON
        ========================= */

        let data;

        try {

            data = JSON.parse(text);

        } catch (parseError) {

            console.error(
                "JSON parsing failed:",
                parseError
            );

            return res.status(500).json({

                error:
                    "AI returned invalid JSON",

                raw:
                    text

            });

        }


        /* =========================
           SORT RESULTS
        ========================= */

        if (
            data.recommendations &&
            Array.isArray(data.recommendations)
        ) {

            data.recommendations.sort(
                (a, b) =>
                    Number(a.rank) -
                    Number(b.rank)
            );

        }


        /* =========================
           SEND TO FRONTEND
        ========================= */

        res.json({

            success: true,

            recommendations:
                data.recommendations || [],

            result:
                data.recommendations || []

        });


    } catch (error) {

        console.error(
            "OPITECH AI generation failed:"
        );

        console.error(error);


        res.status(500).json({

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

});


/* =========================
   START SERVER
========================= */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `OPITECH BACKEND IS LIVE ON PORT ${PORT}`
        );

    }
);
