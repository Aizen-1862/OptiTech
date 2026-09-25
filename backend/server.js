const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();


// ===============================
// MIDDLEWARE
// ===============================

app.use(cors({
    origin: "*"
}));

app.use(express.json());


// ===============================
// GEMINI SETUP
// ===============================

const apiKey = process.env.GEMINI_API_KEY;

console.log(
    "GEMINI KEY CHECK:",
    apiKey ? `Loaded (${apiKey.length} characters)` : "MISSING"
);

const ai = apiKey
    ? new GoogleGenAI({
        apiKey: apiKey
    })
    : null;


// ===============================
// HOME / TEST ROUTE
// ===============================

app.get("/", (req, res) => {

    res.json({
        status: "online",
        message: "OPITECH AI backend is running 🚀",
        ai: apiKey ? "Gemini configured" : "Gemini API key missing"
    });

});


// ===============================
// WAIT FUNCTION
// ===============================

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// ===============================
// GEMINI REQUEST WITH FALLBACK
// ===============================

async function generateWithFallback(prompt) {

    const models = [
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash"
    ];

    let lastError = null;

    for (let i = 0; i < models.length; i++) {

        const model = models[i];

        try {

            console.log(
                `Trying Gemini model: ${model}`
            );

            const response = await ai.models.generateContent({

                model: model,

                contents: prompt,

                config: {
                    maxOutputTokens: 1200,

                    thinkingConfig: {
                        thinkingLevel: "low"
                    }
                }

            });

            console.log(
                `SUCCESS with model: ${model}`
            );

            return {
                response,
                model
            };

        } catch (error) {

            lastError = error;

            console.error(
                `Model ${model} failed:`,
                error.message
            );

            const status = error.status;

            // Retry/fallback only for temporary server/rate errors
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

                // Don't keep trying other models
                // for API-key or request errors.
                throw error;

            }

        }

    }

    throw lastError;

}


// ===============================
// AI RECOMMENDATION ROUTE
// ===============================

app.post("/api/recommend", async (req, res) => {

    try {

        const { preferences } = req.body;

        console.log(
            "Received preferences:",
            preferences
        );


        // -------------------------------
        // CHECK PREFERENCES
        // -------------------------------

        if (!preferences) {

            return res.status(400).json({
                error: "Preferences are required"
            });

        }


        // -------------------------------
        // CHECK API KEY
        // -------------------------------

        if (!ai) {

            return res.status(500).json({
                error: "Gemini API key is missing"
            });

        }


        // -------------------------------
        // USER DATA
        // -------------------------------

        const productType =
            preferences.productType || "Any electronics";

        const country =
            preferences.country || "India";

        const currency =
            preferences.currency || "INR";

        const budget =
            preferences.budget || "Not specified";

        const uses =
            Array.isArray(preferences.uses)
                ? preferences.uses.join(", ")
                : "General use";

        const priority =
            preferences.priority || "Balanced";

        const brand =
            preferences.brand || "Any brand";


        // -------------------------------
        // OPITECH PROMPT
        // -------------------------------

        const prompt = `
You are OPITECH, an electronics recommendation assistant.

Analyze these user preferences:

Product type: ${productType}
Country: ${country}
Currency: ${currency}
Maximum budget: ${budget}
Uses: ${uses}
Priority: ${priority}
Preferred brand: ${brand}

Give a concise and practical recommendation.

Structure your response like this:

## 🎯 What You Need

Briefly describe the user's needs.

## ⚙️ What Matters

List the most important specifications for this use case.

## 💡 OPITECH Recommendation

Give suitable product types or models only when you are confident they are appropriate.

## 🔍 Why

Explain why the recommendation fits the user's needs.

## ⚖️ Trade-offs

Mention important compromises.

Rules:
- Respect the user's maximum budget.
- Respect the preferred brand when possible.
- Do not invent specifications.
- Do not invent current prices.
- Do not claim availability that you cannot verify.
- If current price information is unavailable, say that the price should be verified.
- Keep the response concise.
`;

        console.log(
            "Sending request to Gemini..."
        );


        const startTime = Date.now();


        // -------------------------------
        // GEMINI
        // -------------------------------

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


        // -------------------------------
        // RESPONSE TEXT
        // -------------------------------

        const text =
            result.response.text ||
            "No recommendation was generated.";


        return res.json({

            success: true,

            result: text,

            model: result.model,

            responseTime: `${elapsed}s`

        });


    } catch (error) {

        console.error(
            "========== GEMINI ERROR =========="
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
            "Full error:",
            error
        );

        console.error(
            "=================================="
        );


        return res.status(500).json({

            error: "Gemini AI generation failed",

            details:
                error.message ||
                "Unknown Gemini error"

        });

    }

});


// ===============================
// START SERVER
// ===============================

const PORT =
    process.env.PORT || 10000;

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `OPITECH backend running on port ${PORT}`
        );

    }
);
