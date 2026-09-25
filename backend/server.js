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
// AI RECOMMENDATION ROUTE
// ===============================

app.post("/api/recommend", async (req, res) => {

    try {

        const { preferences } = req.body;

        console.log("Received preferences:", preferences);


        // -------------------------------
        // CHECK PREFERENCES
        // -------------------------------

        if (!preferences) {

            return res.status(400).json({
                error: "Preferences are required"
            });

        }


        // -------------------------------
        // CHECK GEMINI KEY
        // -------------------------------

        if (!ai) {

            return res.status(500).json({
                error: "Gemini API key is missing"
            });

        }


        // -------------------------------
        // CLEAN USER DATA
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
            Array.isArray(preferences.uses) && preferences.uses.length
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

Analyze the user's preferences and give a concise, useful recommendation.

USER:
Product type: ${productType}
Country: ${country}
Currency: ${currency}
Maximum budget: ${budget}
Uses: ${uses}
Priority: ${priority}
Preferred brand: ${brand}

Your response must:

1. Understand what the user actually needs.
2. Recommend suitable electronics or product categories.
3. Explain the important specifications.
4. Explain why those specifications matter for this user.
5. Mention important trade-offs.
6. Stay within the user's stated budget when possible.
7. Respect the preferred brand when possible.
8. Never invent specifications, prices, availability, or product models.
9. If current price information is unavailable, clearly say that the price should be verified.

Keep the answer easy to read.

Do not give an extremely long explanation.
`;


        console.log("Sending request to Gemini...");

        const startTime = Date.now();


        // -------------------------------
        // GEMINI REQUEST
        // -------------------------------

        const response = await ai.models.generateContent({

            model: "gemini-3.8-flash",

            contents: prompt,

            config: {
                temperature: 0.4,
                maxOutputTokens: 800
            }

        });


        const elapsed =
            ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(
            `Gemini response received in ${elapsed}s`
        );


        // -------------------------------
        // GET RESPONSE TEXT
        // -------------------------------

        const result =
            response.text || "No recommendation was generated.";


        return res.json({

            success: true,

            result: result,

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
                error.message || "Unknown Gemini error"

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
