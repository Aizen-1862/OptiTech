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
TAVILY WEB SEARCH
========================= */

async function searchProducts(query, country) {

```
if (!TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is missing");
}

console.log("🔎 Searching Tavily:", query);

const response = await fetch("https://api.tavily.com/search", {
    method: "POST",

    headers: {
        "Content-Type": "application/json"
    },

    body: JSON.stringify({
        api_key: TAVILY_API_KEY,

        query: query,

        search_depth: "basic",

        topic: "general",

        max_results: 8,

        include_answer: false,

        include_raw_content: false,

        include_images: false
    })
});

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
    `✅ Tavily returned ${data.results?.length || 0} results`
);

return data.results || [];
```

}

/* =========================
GROQ AI
========================= */

async function generateWithGroq(prompt) {

```
if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing");
}

console.log("🤖 Sending results to Groq...");

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
```

You are OPITECH, an electronics recommendation AI.

You analyze real web-search results and recommend
actual currently available electronics.

Never invent products.

Never invent prices.

Only use prices supported by the supplied search results.

Return ONLY valid JSON.
`
},

```
                {
                    role: "user",

                    content: prompt
                }

            ],

            temperature: 0.2,

            max_completion_tokens: 2500,

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
```

}

/* =========================
RECOMMENDATION API
========================= */

app.post("/api/recommend", async (req, res) => {

```
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
       SEARCH QUERIES
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


    const searchQueries = [

        `${brandText} ${productType} ${useText} under ${budget} ${currency} ${country}`,

        `best ${productType} ${brandText} ${useText} ${country} price ${currency}`,

        `${brandText} ${productType} current price ${country} ${currency}`

    ];


    /* =========================
       SEARCH WEB
    ========================= */

    let allResults = [];


    for (const query of searchQueries) {

        try {

            const results =
                await searchProducts(
                    query,
                    country
                );

            allResults.push(...results);

        } catch (searchError) {

            console.error(
                "Search query failed:",
                searchError.message
            );

        }

    }


    /* =========================
       REMOVE DUPLICATE RESULTS
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
        `📦 Total unique search results: ${uniqueResults.length}`
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
       PREPARE SEARCH DATA
    ========================= */

    const searchData =
        uniqueResults
            .slice(0, 20)
            .map((result, index) => {

                return `
```

RESULT ${index + 1}

Title:
${result.title || "Unknown"}

URL:
${result.url || "Unknown"}

Content:
${result.content || "No content available"}

`;
})
.join("\n");

```
    /* =========================
       AI PROMPT
    ========================= */

    const prompt = `
```

USER REQUIREMENTS

Product type:
${productType}

Country:
${country}

Currency:
${currency}

Maximum budget:
${budget}

Uses:
${useText}

Priority:
${priority || "general"}

Preferred brand:
${brand || "any"}

IMPORTANT RULES

You are given CURRENT WEB SEARCH RESULTS below.

Use ONLY those search results as evidence.

Return exactly 3 real products.

Each product must:

1. Be an exact product model.
2. Be relevant to the requested product type.
3. Match the user's intended uses.
4. Fit within the maximum budget when a reliable price is available.
5. Use a price supported by the search results.
6. Never invent a price.
7. Never invent specifications.
8. Prefer current retailer/manufacturer prices.
9. Prefer results from reputable retailers or official manufacturer websites.
10. Do not use old launch prices when a current selling price is available.
11. If the same product appears multiple times, combine the evidence.
12. The preferred brand should be respected when possible.
13. If the preferred brand has insufficient suitable products, use closely related alternatives only when necessary.

RANKING

Return:

#1 strongest overall match
#2 second strongest match
#3 third strongest match

Consider:

* budget
* use cases
* performance
* priority
* preferred brand
* specifications
* current price
* overall suitability

PRICE FORMAT

For India:

₹24999

For USD:

$499

Do NOT return:

"Price unavailable"

"Check price"

"Verify current price"

"Unknown"

PRICE SOURCE

priceSource must identify the website/store where the price evidence came from.

Example:

Amazon India

Flipkart

Croma

Samsung India

Xiaomi India

SEARCH RESULTS

${searchData}

RETURN ONLY THIS JSON STRUCTURE

{
"recommendations": [
{
"rank": 1,
"name": "Exact Product Model",
"price": "₹24999",
"priceSource": "Source name",
"matchScore": 95,
"why": "Short explanation.",
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
"price": "₹XXXXX",
"priceSource": "Source name",
"matchScore": 90,
"why": "Short explanation.",
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
"price": "₹XXXXX",
"priceSource": "Source name",
"matchScore": 85,
"why": "Short explanation.",
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

```
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
            "❌ JSON parsing failed:",
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
        Array.isArray(
            data.recommendations
        )
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
        "❌ OPITECH AI generation failed:"
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
```

});

/* =========================
START SERVER
========================= */

app.listen(
PORT,
"0.0.0.0",
() => {

```
    console.log(
        `🚀 OPITECH BACKEND IS LIVE ON PORT ${PORT}`
    );

}
```

);
