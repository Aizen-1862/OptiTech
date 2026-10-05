const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 10000;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const GROQ_MODEL = "openai/gpt-oss-20b";


// =====================================================
// BASIC ROUTES
// =====================================================

app.get("/", (req, res) => {
    res.json({
        status: "online",
        message: "OPITECH AI backend is running 🚀",
        ai: "Groq + Tavily",
        livePrices: "Amazon India + Flipkart",
        images: false
    });
});


app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        groq: !!GROQ_API_KEY,
        tavily: !!TAVILY_API_KEY
    });
});


// =====================================================
// FETCH WITH TIMEOUT
// =====================================================

async function fetchWithTimeout(url, options = {}, timeout = 15000) {

    const controller = new AbortController();

    const timer = setTimeout(() => {
        controller.abort();
    }, timeout);

    try {

        return await fetch(url, {
            ...options,
            signal: controller.signal
        });

    } finally {

        clearTimeout(timer);

    }
}


// =====================================================
// TAVILY SEARCH
// =====================================================

async function tavilySearch(query, domains) {

    if (!TAVILY_API_KEY) {
        throw new Error("TAVILY_API_KEY is missing in Render.");
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

                query: query,

                search_depth: "basic",

                max_results: 4,

                include_answer: false,

                include_raw_content: false,

                include_images: false,

                include_domains: domains

            })
        },
        15000
    );


    const text = await response.text();


    if (!response.ok) {

        throw new Error(
            `Tavily error ${response.status}: ${text.slice(0, 500)}`
        );

    }


    let data;

    try {

        data = JSON.parse(text);

    } catch {

        throw new Error("Tavily returned invalid JSON.");

    }


    return data;

}


// =====================================================
// CLEAN TAVILY RESULTS
// =====================================================

function cleanSearchResults(data, marketplace) {

    if (
        !data ||
        !Array.isArray(data.results)
    ) {
        return [];
    }


    return data.results
        .filter(item => item && item.url)
        .map((item, index) => {

            return {

                index,

                marketplace,

                title: String(
                    item.title || ""
                ).slice(0, 250),

                url: String(
                    item.url || ""
                ),

                content: String(
                    item.content || ""
                )
                    .replace(/\s+/g, " ")
                    .slice(0, 500)

            };

        });

}


// =====================================================
// PRICE EXTRACTION
// =====================================================

function extractPrice(text) {

    if (!text) {
        return null;
    }


    const value = String(text);


    const patterns = [

        /₹\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,6})/i,

        /Rs\.?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,6})/i,

        /INR\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,6})/i

    ];


    for (const pattern of patterns) {

        const match = value.match(pattern);

        if (match && match[1]) {

            const number =
                Number(
                    match[1]
                        .replace(/,/g, "")
                );


            if (
                Number.isFinite(number) &&
                number > 500 &&
                number < 1000000
            ) {

                return number;

            }

        }

    }


    return null;

}


// =====================================================
// VALID MARKETPLACE URL
// =====================================================

function isMarketplaceUrl(url, marketplace) {

    if (!url) {
        return false;
    }


    try {

        const parsed = new URL(url);

        if (
            parsed.protocol !== "http:" &&
            parsed.protocol !== "https:"
        ) {
            return false;
        }


        const host =
            parsed.hostname.toLowerCase();


        if (marketplace === "amazon") {

            return (
                host.includes("amazon.in") ||
                host.includes("amazon.com")
            );

        }


        if (marketplace === "flipkart") {

            return host.includes("flipkart.com");

        }


        return false;

    } catch {

        return false;

    }

}


// =====================================================
// GROQ REQUEST
// =====================================================

async function askGroq(
    userPrompt,
    amazonResults,
    flipkartResults
) {

    if (!GROQ_API_KEY) {

        throw new Error(
            "GROQ_API_KEY is missing in Render."
        );

    }


    const evidence = {

        amazon: amazonResults,

        flipkart: flipkartResults

    };


    const systemPrompt = `
You are OPITECH AI.

You recommend real electronics using ONLY the supplied Amazon India and Flipkart search evidence.

STRICT RULES:

1. NEVER invent products.
2. NEVER invent prices.
3. NEVER invent URLs.
4. NEVER invent specifications that are not supported by the evidence.
5. Prefer exact product/model names from the evidence.
6. Stay within the user's budget whenever possible.
7. Rank the best 3 products for the user's requirements.
8. A product may appear on Amazon, Flipkart, or both.
9. If a marketplace does not have a reliable match, return null.
10. Keep every explanation short.
11. Return ONLY valid JSON.
12. Do NOT return markdown.
13. Do NOT return code fences.
14. Do NOT include images.

Return exactly this structure:

{
  "recommendations": [
    {
      "rank": 1,
      "name": "Exact product name",
      "brand": "Brand",
      "price": 49999,
      "priceSource": "Amazon India",
      "matchScore": 95,
      "why": "Short reason",
      "strengths": [
        "Strength 1",
        "Strength 2",
        "Strength 3"
      ],
      "tradeoffs": [
        "Trade-off 1"
      ],
      "amazonIndex": 0,
      "amazonPrice": 49999,
      "flipkartIndex": 1,
      "flipkartPrice": 50999
    }
  ]
}

IMPORTANT:

amazonIndex must be the index of the selected Amazon result.

flipkartIndex must be the index of the selected Flipkart result.

If there is no reliable Amazon match:
"amazonIndex": null,
"amazonPrice": null

If there is no reliable Flipkart match:
"flipkartIndex": null,
"flipkartPrice": null

The main "price" should be the lowest reliable marketplace price.

priceSource should be:
"Amazon India"
or
"Flipkart"
or
"Amazon India + Flipkart"

Maximum 3 recommendations.
`;


    const userMessage = `
USER REQUIREMENTS:

${userPrompt}

SEARCH EVIDENCE:

${JSON.stringify(evidence)}
`;


    const response = await fetchWithTimeout(

        "https://api.groq.com/openai/v1/chat/completions",

        {
            method: "POST",

            headers: {

                "Content-Type":
                    "application/json",

                "Authorization":
                    `Bearer ${GROQ_API_KEY}`

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
                        content: userMessage
                    }

                ],

                temperature: 0.1,

                max_tokens: 1400,

                response_format: {
                    type: "json_object"
                }

            })

        },

        30000

    );


    const text =
        await response.text();


    if (!response.ok) {

        throw new Error(
            `Groq error ${response.status}: ${text.slice(0, 700)}`
        );

    }


    let data;

    try {

        data = JSON.parse(text);

    } catch {

        throw new Error(
            "Groq returned invalid JSON."
        );

    }


    const content =
        data?.choices?.[0]?.message?.content;


    if (
        !content ||
        typeof content !== "string"
    ) {

        throw new Error(
            "Groq returned an empty response."
        );

    }


    let result;

    try {

        result = JSON.parse(content);

    } catch {

        throw new Error(
            "Groq returned invalid recommendation JSON."
        );

    }


    if (
        !result ||
        !Array.isArray(
            result.recommendations
        )
    ) {

        throw new Error(
            "Groq response is missing recommendations."
        );

    }


    return result;

}


// =====================================================
// NORMALIZE AI RESULT
// =====================================================

function normalizeRecommendations(
    aiResult,
    amazonResults,
    flipkartResults
) {

    const list =
        Array.isArray(
            aiResult?.recommendations
        )
            ? aiResult.recommendations
            : [];


    return list
        .slice(0, 3)
        .map((item, index) => {

            const amazonIndex =
                Number.isInteger(
                    item.amazonIndex
                )
                    ? item.amazonIndex
                    : null;


            const flipkartIndex =
                Number.isInteger(
                    item.flipkartIndex
                )
                    ? item.flipkartIndex
                    : null;


            const amazonResult =
                amazonIndex !== null &&
                amazonResults[amazonIndex]
                    ? amazonResults[amazonIndex]
                    : null;


            const flipkartResult =
                flipkartIndex !== null &&
                flipkartResults[flipkartIndex]
                    ? flipkartResults[flipkartIndex]
                    : null;


            let amazonPrice =
                Number(item.amazonPrice);


            if (
                !Number.isFinite(
                    amazonPrice
                )
            ) {

                amazonPrice =
                    amazonResult
                        ? extractPrice(
                            amazonResult.title +
                            " " +
                            amazonResult.content
                        )
                        : null;

            }


            let flipkartPrice =
                Number(item.flipkartPrice);


            if (
                !Number.isFinite(
                    flipkartPrice
                )
            ) {

                flipkartPrice =
                    flipkartResult
                        ? extractPrice(
                            flipkartResult.title +
                            " " +
                            flipkartResult.content
                        )
                        : null;

            }


            const validAmazonPrice =
                Number.isFinite(
                    amazonPrice
                )
                    ? amazonPrice
                    : null;


            const validFlipkartPrice =
                Number.isFinite(
                    flipkartPrice
                )
                    ? flipkartPrice
                    : null;


            let mainPrice =
                Number(item.price);


            if (
                !Number.isFinite(
                    mainPrice
                )
            ) {

                const prices =
                    [
                        validAmazonPrice,
                        validFlipkartPrice
                    ]
                        .filter(
                            x =>
                                Number.isFinite(x)
                        );


                mainPrice =
                    prices.length
                        ? Math.min(...prices)
                        : null;

            }


            let priceSource =
                item.priceSource ||
                "";


            if (
                validAmazonPrice !== null &&
                validFlipkartPrice !== null
            ) {

                priceSource =
                    "Amazon India + Flipkart";

            } else if (
                validAmazonPrice !== null
            ) {

                priceSource =
                    "Amazon India";

            } else if (
                validFlipkartPrice !== null
            ) {

                priceSource =
                    "Flipkart";

            }


            return {

                rank:
                    Number(item.rank) ||
                    index + 1,

                name:
                    String(
                        item.name ||
                        "Recommended product"
                    ),

                brand:
                    String(
                        item.brand ||
                        ""
                    ),

                price:
                    Number.isFinite(mainPrice)
                        ? mainPrice
                        : null,

                priceSource,

                // Images intentionally disabled.
                imageUrl: null,

                matchScore:
                    Number.isFinite(
                        Number(item.matchScore)
                    )
                        ? Math.max(
                            0,
                            Math.min(
                                100,
                                Number(
                                    item.matchScore
                                )
                            )
                        )
                        : null,

                why:
                    String(
                        item.why ||
                        "Good match for your selected requirements."
                    ),

                strengths:
                    Array.isArray(
                        item.strengths
                    )
                        ? item.strengths
                            .slice(0, 4)
                            .map(String)
                        : [],

                tradeoffs:
                    Array.isArray(
                        item.tradeoffs
                    )
                        ? item.tradeoffs
                            .slice(0, 3)
                            .map(String)
                        : [],

                amazon:
                    amazonResult &&
                    isMarketplaceUrl(
                        amazonResult.url,
                        "amazon"
                    )
                        ? {
                            price:
                                validAmazonPrice,
                            url:
                                amazonResult.url
                        }
                        : null,

                flipkart:
                    flipkartResult &&
                    isMarketplaceUrl(
                        flipkartResult.url,
                        "flipkart"
                    )
                        ? {
                            price:
                                validFlipkartPrice,
                            url:
                                flipkartResult.url
                        }
                        : null

            };

        })
        .filter(
            item =>
                item.name &&
                item.name !==
                    "Recommended product"
        );

}


// =====================================================
// FALLBACK RECOMMENDATIONS
// =====================================================

function createFallbackRecommendations(
    amazonResults,
    flipkartResults,
    budget
) {

    const all = [];


    for (
        const item of amazonResults
    ) {

        const price =
            extractPrice(
                item.title +
                " " +
                item.content
            );


        all.push({

            source: "Amazon India",

            result: item,

            price

        });

    }


    for (
        const item of flipkartResults
    ) {

        const price =
            extractPrice(
                item.title +
                " " +
                item.content
            );


        all.push({

            source: "Flipkart",

            result: item,

            price

        });

    }


    const numericBudget =
        Number(budget);


    const usable =
        all.filter(item => {

            if (
                !Number.isFinite(
                    item.price
                )
            ) {

                return true;

            }


            if (
                !Number.isFinite(
                    numericBudget
                )
            ) {

                return true;

            }


            return (
                item.price <=
                numericBudget * 1.15
            );

        });


    const chosen =
        (
            usable.length
                ? usable
                : all
        )
            .slice(0, 3);


    return chosen.map(
        (item, index) => {

            const price =
                Number.isFinite(
                    item.price
                )
                    ? item.price
                    : null;


            return {

                rank: index + 1,

                name:
                    item.result.title ||
                    "Product",

                brand: "",

                price,

                priceSource:
                    item.source,

                imageUrl: null,

                matchScore:
                    Math.max(
                        70,
                        90 - index * 5
                    ),

                why:
                    "This product was found in the live marketplace search results and may fit your requirements.",

                strengths: [
                    "Found in live marketplace search",
                    "Product listing available",
                    "Potentially suitable for your budget"
                ],

                tradeoffs: [
                    "AI ranking was temporarily unavailable"
                ],

                amazon:
                    item.source ===
                    "Amazon India" &&
                    isMarketplaceUrl(
                        item.result.url,
                        "amazon"
                    )
                        ? {
                            price,
                            url:
                                item.result.url
                        }
                        : null,

                flipkart:
                    item.source ===
                    "Flipkart" &&
                    isMarketplaceUrl(
                        item.result.url,
                        "flipkart"
                    )
                        ? {
                            price,
                            url:
                                item.result.url
                        }
                        : null

            };

        }
    );

}


// ============================================
