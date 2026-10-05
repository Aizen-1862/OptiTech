const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 10000;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const GROQ_MODEL = "openai/gpt-oss-20b";


// ===============================
// BASIC ROUTES
// ===============================

app.get("/", (req, res) => {
    res.json({
        status: "online",
        message: "OPITECH AI backend is running 🚀",
        ai: "Groq + Tavily",
        livePrices: "Amazon India + Flipkart"
    });
});


// ===============================
// TAVILY SEARCH
// ===============================

async function tavilySearch(query, domains = []) {
    if (!TAVILY_API_KEY) {
        throw new Error("TAVILY_API_KEY is missing");
    }

    const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            api_key: TAVILY_API_KEY,
            query,
            search_depth: "basic",
            max_results: 5,
            include_answer: false,
            include_raw_content: false,
            include_images: true,
            ...(domains.length
                ? { include_domains: domains }
                : {})
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `Tavily error ${response.status}: ${errorText}`
        );
    }

    return await response.json();
}


// ===============================
// GROQ
// ===============================

async function askGroq(prompt) {
    if (!GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is missing");
    }

    const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                temperature: 0.1,
                max_tokens: 3500,
                messages: [
                    {
                        role: "system",
                        content: `
You are OPITECH AI, an electronics recommendation engine.

You receive search evidence from the web.

IMPORTANT RULES:

1. Recommend real products only.
2. NEVER invent a product.
3. NEVER invent a price.
4. NEVER invent an Amazon URL.
5. NEVER invent a Flipkart URL.
6. NEVER invent an image URL.
7. Use the supplied search evidence.
8. Prefer Amazon India and Flipkart evidence.
9. The user's budget must be respected.
10. Return maximum 3 recommendations.
11. Return ONLY valid JSON.
12. Do not use markdown.
13. Do not put JSON inside code fences.

JSON format:

{
  "recommendations": [
    {
      "rank": 1,
      "name": "Product name",
      "brand": "Brand",
      "price": 0,
      "currency": "INR",
      "priceSource": "Amazon India",
      "imageUrl": "",
      "amazon": {
        "title": "",
        "price": 0,
        "url": ""
      },
      "flipkart": {
        "title": "",
        "price": 0,
        "url": ""
      },
      "matchScore": 0,
      "why": "",
      "strengths": [],
      "tradeoffs": []
    }
  ]
}

If a marketplace result is not available, leave that marketplace object empty.

Do not guess missing information.
`
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
            `Groq error ${response.status}: ${errorText}`
        );
    }

    const data = await response.json();

    const content =
        data &&
        data.choices &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content;

    if (!content || !content.trim()) {
        throw new Error("Groq returned an empty response");
    }

    return content.trim();
}


// ===============================
// HELPERS
// ===============================

function cleanJson(text) {
    let cleaned = text.trim();

    if (cleaned.startsWith("```")) {
        cleaned = cleaned
            .replace(/^```json/i, "")
            .replace(/^```/i, "")
            .replace(/```$/i, "")
            .trim();
    }

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1) {
        cleaned = cleaned.substring(
            firstBrace,
            lastBrace + 1
        );
    }

    return cleaned;
}


function extractPrice(text) {
    if (!text) return null;

    const patterns = [
        /₹\s?([0-9,]{3,})/gi,
        /INR\s?([0-9,]{3,})/gi,
        /Rs\.?\s?([0-9,]{3,})/gi
    ];

    for (const pattern of patterns) {
        const match = pattern.exec(text);

        if (match && match[1]) {
            const number = Number(
                match[1].replace(/,/g, "")
            );

            if (
                Number.isFinite(number) &&
                number >= 500 &&
                number <= 1000000
            ) {
                return number;
            }
        }
    }

    return null;
}


function isAmazon(url) {
    if (!url) return false;

    return (
        url.includes("amazon.in") ||
        url.includes("amzn.in")
    );
}


function isFlipkart(url) {
    if (!url) return false;

    return url.includes("flipkart.com");
}


function normalizeUrl(url) {
    if (!url || typeof url !== "string") {
        return "";
    }

    return url.trim();
}


function getSearchText(result) {
    return [
        result.title || "",
        result.url || "",
        result.content || ""
    ].join(" ");
}


function findMarketplaceResult(results, productName, marketplace) {
    if (!Array.isArray(results)) return null;

    const words = String(productName || "")
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length >= 3);

    let best = null;
    let bestScore = 0;

    for (const result of results) {
        const url = normalizeUrl(result.url);

        if (marketplace === "amazon" && !isAmazon(url)) {
            continue;
        }

        if (marketplace === "flipkart" && !isFlipkart(url)) {
            continue;
        }

        const text = getSearchText(result).toLowerCase();

        let score = 0;

        for (const word of words) {
            if (text.includes(word)) {
                score++;
            }
        }

        if (score > bestScore) {
            bestScore = score;
            best = result;
        }
    }

    return best;
}


function makeMarketplaceObject(result) {
    if (!result) {
        return {
            title: "",
            price: null,
            url: ""
        };
    }

    const text = getSearchText(result);

    return {
        title: result.title || "",
        price: extractPrice(text),
        url: normalizeUrl(result.url)
    };
}


function findImage(searchData, productName) {
    if (!searchData) return "";

    const words = String(productName || "")
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length >= 3);

    const images =
        Array.isArray(searchData.images)
            ? searchData.images
            : [];

    for (const image of images) {
        if (typeof image === "string") {
            return image;
        }

        if (
            image &&
            typeof image.url === "string"
        ) {
            return image.url;
        }
    }

    return "";
}


// ===============================
// RECOMMENDATION API
// ===============================

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
        } = req.body || {};

        if (!productType) {
            return res.status(400).json({
                error: "productType is required"
            });
        }

        const numericBudget =
            Number(
                String(budget || "")
                    .replace(/,/g, "")
                    .replace(/[^\d.]/g, "")
            );

        if (
            !Number.isFinite(numericBudget) ||
            numericBudget <= 0
        ) {
            return res.status(400).json({
                error: "A valid budget is required"
            });
        }


        const useText =
            Array.isArray(uses)
                ? uses.join(", ")
                : String(uses || "general use");

        const baseQuery = [
            productType,
            brand && brand !== "any"
                ? brand
                : "",
            `${country || "India"}`,
            `${currency || "INR"} ${numericBudget}`,
            useText,
            priority || "balanced",
            "best current price specifications"
        ]
            .filter(Boolean)
            .join(" ");


        console.log("================================");
        console.log("OPITECH REQUEST");
        console.log(baseQuery);
        console.log("================================");


        // ===============================
        // LIVE MARKETPLACE SEARCHES
        // ===============================

        const amazonQuery =
            `${baseQuery} site:amazon.in`;

        const flipkartQuery =
            `${baseQuery} site:flipkart.com`;

        const generalQuery =
            `${baseQuery} current price specifications`;


        const [
            amazonData,
            flipkartData,
            generalData
        ] = await Promise.all([
            tavilySearch(
                amazonQuery,
                ["amazon.in"]
            ),

            tavilySearch(
                flipkartQuery,
                ["flipkart.com"]
            ),

            tavilySearch(
                generalQuery
            )
        ]);


        const amazonResults =
            Array.isArray(amazonData.results)
                ? amazonData.results
                : [];

        const flipkartResults =
            Array.isArray(flipkartData.results)
                ? flipkartData.results
                : [];

        const generalResults =
            Array.isArray(generalData.results)
                ? generalData.results
                : [];


        console.log(
            `Amazon results: ${amazonResults.length}`
        );

        console.log(
            `Flipkart results: ${flipkartResults.length}`
        );

        console.log(
            `General results: ${generalResults.length}`
        );


        // ===============================
        // SEND EVIDENCE TO GROQ
        // ===============================

        const evidence = {
            amazon: amazonResults.map(item => ({
                title: item.title || "",
                url: item.url || "",
                content: item.content || ""
            })),

            flipkart: flipkartResults.map(item => ({
                title: item.title || "",
                url: item.url || "",
                content: item.content || ""
            })),

            general: generalResults.map(item => ({
                title: item.title || "",
                url: item.url || "",
                content: item.content || ""
            }))
        };


        const prompt = `
User requirements:

Product type: ${productType}
Country: ${country || "India"}
Currency: ${currency || "INR"}
Budget: ${numericBudget}
Uses: ${useText}
Priority: ${priority || "balanced"}
Preferred brand: ${brand || "any"}

LIVE WEB SEARCH EVIDENCE:

${JSON.stringify(evidence, null, 2)}

Choose the best products for this user.

Remember:
- Use only evidence above.
- Prefer products within budget.
- Amazon India and Flipkart are the required marketplaces.
- Do not invent prices.
- Do not invent links.
- Do not invent images.
- Return valid JSON only.
`;


        const aiText = await askGroq(prompt);

        console.log("Groq response received.");


        let aiJson;

        try {
            aiJson = JSON.parse(
                cleanJson(aiText)
            );
        } catch (parseError) {
            console.error(
                "JSON parse failed:",
                aiText
            );

            return res.status(502).json({
                error: "AI returned invalid JSON",
                details:
                    "Groq response could not be parsed."
            });
        }


        let recommendations =
            Array.isArray(aiJson.recommendations)
                ? aiJson.recommendations
                : [];


        // ===============================
        // VERIFY / ENRICH MARKETPLACE DATA
        // ===============================

        recommendations =
            recommendations
                .slice(0, 3)
                .map((product, index) => {

                    const productName =
                        product.name || "";

                    const amazonMatch =
                        findMarketplaceResult(
                            amazonResults,
                            productName,
                            "amazon"
                        );

                    const flipkartMatch =
                        findMarketplaceResult(
                            flipkartResults,
                            productName,
                            "flipkart"
                        );


                    const amazon =
                        makeMarketplaceObject(
                            amazonMatch
                        );

                    const flipkart =
                        makeMarketplaceObject(
                            flipkartMatch
                        );


                    let finalPrice = null;
                    let finalSource = "";


                    if (
                        amazon.price &&
                        amazon.price <= numericBudget
                    ) {
                        finalPrice =
                            amazon.price;

                        finalSource =
                            "Amazon India";
                    }


                    if (
                        flipkart.price &&
                        flipkart.price <= numericBudget
                    ) {
                        if (
                            finalPrice === null ||
                            flipkart.price < finalPrice
                        ) {
                            finalPrice =
                                flipkart.price;

                            finalSource =
                                "Flipkart";
                        }
                    }


                    if (
                        finalPrice === null &&
                        amazon.price
                    ) {
                        finalPrice =
                            amazon.price;

                        finalSource =
                            "Amazon India";
                    }


                    if (
                        finalPrice === null &&
                        flipkart.price
                    ) {
                        finalPrice =
                            flipkart.price;

                        finalSource =
                            "Flipkart";
                    }


                    let imageUrl =
                        product.imageUrl || "";


                    if (!imageUrl) {
                        imageUrl =
                            findImage(
                                amazonData,
                                productName
                            );
                    }


                    if (!imageUrl) {
                        imageUrl =
                            findImage(
                                flipkartData,
                                productName
                            );
                    }


                    return {
                        rank:
                            index + 1,

                        name:
                            productName,

                        brand:
                            product.brand || "",

                        price:
                            finalPrice,

                        currency:
                            currency || "INR",

                        priceSource:
                            finalSource ||
                            "Live marketplace search",

                        imageUrl,

                        amazon,

                        flipkart,

                        matchScore:
                            Number(
                                product.matchScore
                            ) || 0,

                        why:
                            product.why || "",

                        strengths:
                            Array.isArray(
                                product.strengths
                            )
                                ? product.strengths
                                : [],

                        tradeoffs:
                            Array.isArray(
                                product.tradeoffs
                            )
                                ? product.tradeoffs
                                : []
                    };
                });


        return res.json({
            success: true,
            recommendations,
            checkedAt:
                new Date().toISOString(),

            priceNotice:
                "Prices and availability are checked from current web search results and may change on Amazon India or Flipkart."
        });


    } catch (error) {

        console.error(
            "OPITECH ERROR:",
            error
        );

        return res.status(500).json({
            error: "AI generation failed",
            details:
                error.message || "Unknown server error"
        });
    }
});


// ===============================
// START SERVER
// ===============================

app.listen(PORT, "0.0.0.0", () => {
    console.log(
        `OPITECH backend running on port ${PORT}`
    );
});
