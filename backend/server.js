const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();


// =====================================
// MIDDLEWARE
// =====================================

app.use(cors({
    origin: "*"
}));

app.use(express.json());


// =====================================
// GEMINI SETUP
// =====================================

const apiKey = process.env.GEMINI_API_KEY;

console.log(
    "GEMINI KEY CHECK:",
    apiKey
        ? `Loaded (${apiKey.length} characters)`
        : "MISSING"
);

const ai = apiKey
    ? new GoogleGenAI({
        apiKey: apiKey
    })
    : null;


// =====================================
// HOME ROUTE
// =====================================

app.get("/", (req, res) => {

    res.json({
        status: "online",
        message: "OPITECH AI backend is running 🚀",
        ai: apiKey
            ? "Gemini configured"
            : "Gemini API key missing"
    });

});


// =====================================
// WAIT FUNCTION
// =====================================

function wait(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}


// =====================================
// GEMINI GENERATOR
// =====================================

async function generateWithFallback(prompt) {

    // Put the currently working free model first.
    const models = [
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.6-flash"
    ];

    let lastError = null;

    for (let i = 0; i < models.length; i++) {

        const model = models[i];

        try {

            console.log(
                `Trying Gemini model: ${model}`
            );

            const response =
                await ai.models.generateContent({

                    model: model,

                    contents: prompt,

                    config: {
                        maxOutputTokens: 1800
                    }

                });

            console.log(
                `SUCCESS with model: ${model}`
            );

            return {
                response: response,
                model: model
            };

        } catch (error) {

            lastError = error;

            console.error(
                `Model ${model} failed:`,
                error.message
            );

            const status = error.status;

            if (
                status === 429 ||
                status === 500 ||
                status === 502 ||
                status === 503 ||
                status === 504
            ) {

                if (i < models.length - 1) {

                    const delay =
                        1000 * Math.pow(2, i);

                    console.log(
                        `Waiting ${delay}ms before fallback...`
                    );

                    await wait(delay);

                    continue;
                }

            } else {

                throw error;

            }
        }
    }

    throw lastError;
}


// =====================================
// RECOMMENDATION ROUTE
// =====================================

app.post("/api/recommend", async (req, res) => {

    try {

        // =================================
        // READ USER PREFERENCES
        // =================================

        const preferences = req.body.preferences;

        console.log(
            "Received preferences:",
            preferences
        );


        // =================================
        // CHECK PREFERENCES
        // =================================

        if (!preferences) {

            return res.status(400).json({
                error: "Preferences are required"
            });

        }


        // =================================
        // CHECK GEMINI
        // =================================

        if (!ai) {

            return res.status(500).json({
                error: "Gemini API key is missing"
            });

        }


        // =================================
        // USER DATA
        // =================================

        const productType =
            preferences.productType ||
            "Any electronics";

        const country =
            preferences.country ||
            "India";

        const currency =
            preferences.currency ||
            "INR";

        const budget =
            preferences.budget ||
            "Not specified";

        const uses =
            Array.isArray(preferences.uses)
                ? preferences.uses.join(", ")
                : "General use";

        const priority =
            preferences.priority ||
            "Balanced";

        const brand =
            preferences.brand ||
            "Any brand";


        // =================================
        // OPITECH AI PROMPT
        // =================================

        const prompt = `
You are OPITECH, an electronics recommendation engine.

Your job is to find the THREE best specific products for the user
and rank them #1, #2, and #3.

USER INFORMATION:

Product type: ${productType}
Country: ${country}
Currency: ${currency}
Maximum budget: ${budget}
Uses: ${uses}
Priority: ${priority}
Preferred brand: ${brand}


========================================
RANKING RULES
========================================

Rank products according to how well they match THIS USER.

Consider:

1. Product type
2. Maximum budget
3. Intended uses
4. User's selected priority
5. Preferred brand
6. Important specifications
7. Overall value
8. Important limitations

The ranking must be personalized.

#1 must be the strongest overall match.

#2 must be the second strongest match.

#3 must be the third strongest match.

Do NOT simply rank the most expensive product first.

Do NOT simply rank the most powerful product first.

A cheaper product can rank #1 if it is a better match for the
user's actual requirements.


========================================
PRODUCT RULES
========================================

Use real, specific product models.

For example:

GOOD:
"POCO X7 Pro"

BAD:
"A good gaming phone"

GOOD:
"OnePlus Nord 4"

BAD:
"A OnePlus phone"

Do not invent specifications.

Do not invent prices.

If you are uncertain about a current price, write:

"Verify current price"


========================================
BUDGET RULE
========================================

The user's maximum budget is:

${budget}

Prefer products within this budget.

Do not recommend a product above the maximum budget unless there
is an extremely important reason.

If a product is above the budget, it should normally NOT be ranked
above suitable products that fit within the budget.


========================================
BRAND RULE
========================================

Preferred brand:

${brand}

If the user selected a specific brand, prioritize suitable products
from that brand.

If the brand does not have suitable products, alternatives from
other brands can be considered.


========================================
OUTPUT
========================================

Return ONLY valid JSON.

Do not use Markdown.

Do not use code fences.

Use exactly this structure:

{
    "recommendations": [
        {
            "rank": 1,
            "product": "Exact product name",
            "price": "Price or Verify current price",
            "matchScore": 95,
            "why": "Why this product is the strongest match",
            "strengths": [
                "Strength 1",
                "Strength 2",
                "Strength 3"
            ],
            "tradeoffs": [
                "Limitation 1"
            ]
        },
        {
            "rank": 2,
            "product": "Exact product name",
            "price": "Price or Verify current price",
            "matchScore": 90,
            "why": "Why this product is the second strongest match",
            "strengths": [
                "Strength 1",
                "Strength 2",
                "Strength 3"
            ],
            "tradeoffs": [
                "Limitation 1"
            ]
        },
        {
            "rank": 3,
            "product": "Exact product name",
            "price": "Price or Verify current price",
            "matchScore": 85,
            "why": "Why this product is the third strongest match",
            "strengths": [
                "Strength 1",
                "Strength 2",
                "Strength 3"
            ],
            "tradeoffs": [
                "Limitation 1"
            ]
        }
    ]
}

matchScore must be a number from 0 to 100.

Return exactly three recommendations when three suitable products
can reasonably be identified.
`;


        console.log(
            "Sending ranking request to Gemini..."
        );


        const startTime = Date.now();


        // =================================
        // CALL GEMINI
        // =================================

        const result =
            await generateWithFallback(prompt);


        const elapsed =
            ((Date.now() - startTime) / 1000)
                .toFixed(2);


        console.log(
            `Gemini response received in ${elapsed}s`
        );

        console.log(
            `Model used: ${result.model}`
        );


        // =================================
        // GET RESPONSE TEXT
        // =================================

        let text = "";

        if (typeof result.response.text === "function") {
            text = result.response.text();
        } else {
            text = result.response.text || "";
        }

        text = String(text)
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();


        console.log(
            "Gemini raw response:",
            text
        );


        // =================================
        // PARSE JSON
        // =================================

        let data;

        try {

            data = JSON.parse(text);

        } catch (parseError) {

            console.error(
                "JSON parsing failed:",
                parseError.message
            );

            return res.status(500).json({

                error:
                    "Gemini returned invalid recommendation data",

                rawResult:
                    text

            });

        }


        // =================================
        // CHECK RECOMMENDATIONS
        // =================================

        if (
            !data ||
            !Array.isArray(data.recommendations)
        ) {

            return res.status(500).json({

                error:
                    "Gemini returned an invalid recommendation structure",

                rawResult:
                    text

            });

        }


        // =================================
        // SORT RECOMMENDATIONS
        // =================================

        data.recommendations =
            data.recommendations
                .sort((a, b) => {

                    return Number(a.rank) -
                        Number(b.rank);

                })
                .slice(0, 3);


        // =================================
        // FORCE RANK NUMBERS
        // =================================

        data.recommendations =
            data.recommendations.map(
                (product, index) => {

                    return {
                        ...product,
                        rank: index + 1
                    };

                }
            );


        // =================================
        // CREATE SIMPLE RESULT TEXT
        // =================================

        const resultText =
            data.recommendations
                .map(product => {

                    return (
                        `#${product.rank} ${product.product}\n` +
                        `Price: ${product.price}\n` +
                        `Match: ${product.matchScore}%\n` +
                        `${product.why}`
                    );

                })
                .join("\n\n");


        console.log(
            "FINAL RANKED RESULTS:",
            JSON.stringify(
                data.recommendations,
                null,
                2
            )
        );


        // =================================
        // SEND TO WEBSITE
        // =================================

        return res.json({

            success: true,

            // New structured ranking data
            recommendations:
                data.recommendations,

            // Compatibility with the old frontend
            result:
                resultText,

            model:
                result.model,

            responseTime:
                `${elapsed}s`

        });


    } catch (error) {

        console.error(
            "================================="
        );

        console.error(
            "OPITECH GEMINI ERROR"
        );

        console.error(
            "Message:",
            error.message
        );

        console.error(
            "Status:",
            error.status
        );

        console.error(
            "Code:",
            error.code
        );

        console.error(
            "================================="
        );


        return res.status(500).json({

            error:
                "Gemini AI generation failed",

            details:
                error.message ||
                "Unknown Gemini error"

        });

    }

});


// =====================================
// START SERVER
// =====================================

const PORT =
    process.env.PORT || 10000;

console.log(
    "Starting OPITECH backend..."
);

console.log(
    "PORT:",
    PORT
);

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "================================="
        );

        console.log(
            "OPITECH BACKEND IS LIVE 🚀"
        );

        console.log(
            `Listening on port ${PORT}`
        );

        console.log(
            "================================="
        );

    }
);
