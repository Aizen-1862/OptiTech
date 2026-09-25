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

```
res.json({
    status: "online",
    message: "OPITECH AI backend is running 🚀",
    ai: apiKey ? "Gemini configured" : "Gemini API key missing"
});
```

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

```
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
                maxOutputTokens: 1600,

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
```

}

// ===============================
// AI RECOMMENDATION ROUTE
// ===============================

app.post("/api/recommend", async (req, res) => {

```
try {

    const { preferences } = req.body;

    console.log(
        "Received preferences:",
        preferences
    );


    // ===============================
    // CHECK PREFERENCES
    // ===============================

    if (!preferences) {

        return res.status(400).json({
            error: "Preferences are required"
        });

    }


    // ===============================
    // CHECK API KEY
    // ===============================

    if (!ai) {

        return res.status(500).json({
            error: "Gemini API key is missing"
        });

    }


    // ===============================
    // USER DATA
    // ===============================

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


    // ===============================
    // OPITECH RANKING PROMPT
    // ===============================

    const prompt = `
```

You are OPITECH, an electronics recommendation engine.

Your job is to analyze the user's preferences and produce the
THREE most suitable products, ranked from #1 to #3.

USER PREFERENCES:

Product type: ${productType}
Country: ${country}
Currency: ${currency}
Maximum budget: ${budget}
Uses: ${uses}
Priority: ${priority}
Preferred brand: ${brand}

===============================
RANKING SYSTEM
==============

Evaluate candidate products using these factors:

1. Match with the user's selected product type.
2. Stay within the user's maximum budget whenever possible.
3. Match the user's intended uses.
4. Give extra importance to the user's selected priority.
5. Respect the preferred brand when possible.
6. Consider important specifications for the user's use case.
7. Consider overall value for the user's requirements.
8. Penalize products that fail an important requirement.

The ranking must represent the BEST MATCH for THIS USER,
not simply the most expensive or most powerful product.

#1 = strongest overall match.
#2 = second strongest match.
#3 = third strongest match.

Do NOT rank randomly.

Do NOT give more than 3 products.

Do NOT give fewer than 3 products unless there genuinely are fewer
suitable products available.

===============================
IMPORTANT RULES
===============

* Respect the maximum budget.
* Respect the preferred brand when possible.
* If the preferred brand has suitable alternatives, consider them.
* Do not invent specifications.
* Do not invent current prices.
* Do not pretend that an uncertain specification is confirmed.
* If a product's exact price is uncertain, clearly state that it needs verification.
* Do not recommend an obviously unsuitable product just to fill a ranking.
* Use actual product models when possible.
* Avoid generic product categories such as "a good gaming phone".
* Each recommendation must be a specific product model.

===============================
OUTPUT FORMAT
=============

Return ONLY valid JSON.

Use exactly this structure:

{
"recommendations": [
{
"rank": 1,
"product": "Exact product name",
"price": "Price or 'Verify current price'",
"matchScore": 0,
"why": "Short explanation of why this is a strong match",
"strengths": [
"Important strength",
"Important strength",
"Important strength"
],
"tradeoffs": [
"Important limitation"
]
},
{
"rank": 2,
"product": "Exact product name",
"price": "Price or 'Verify current price'",
"matchScore": 0,
"why": "Short explanation",
"strengths": [
"Important strength",
"Important strength",
"Important strength"
],
"tradeoffs": [
"Important limitation"
]
},
{
"rank": 3,
"product": "Exact product name",
"price": "Price or 'Verify current price'",
"matchScore": 0,
"why": "Short explanation",
"strengths": [
"Important strength",
"Important strength",
"Important strength"
],
"tradeoffs": [
"Important limitation"
]
}
]
}

The matchScore should be a reasonable percentage from 0 to 100
representing how closely the product matches THIS USER'S requirements.

Do not use the score as the only reason for ranking.

Return JSON only.
`;

````
    console.log(
        "Sending ranking request to Gemini..."
    );


    const startTime = Date.now();


    // ===============================
    // GEMINI
    // ===============================

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


    // ===============================
    // RESPONSE TEXT
    // ===============================

    let text =
        result.response.text ||
        "";


    text = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();


    // ===============================
    // PARSE RANKED RESULTS
    // ===============================

    let recommendations;

    try {

        recommendations =
            JSON.parse(text);

    } catch (parseError) {

        console.error(
            "Failed to parse Gemini JSON:",
            parseError.message
        );

        console.error(
            "Gemini returned:",
            text
        );

        return res.status(500).json({

            error: "Gemini returned invalid recommendation data",

            rawResult: text

        });

    }


    // ===============================
    // VALIDATE RESULTS
    // ===============================

    if (
        !recommendations ||
        !Array.isArray(recommendations.recommendations)
    ) {

        return res.status(500).json({

            error: "Invalid recommendation structure"

        });

    }


    // Make sure the ranking is always
    // ordered #1 → #2 → #3.

    recommendations.recommendations =
        recommendations.recommendations
            .sort((a, b) => a.rank - b.rank)
            .slice(0, 3);


    console.log(
        "Final ranked recommendations:",
        recommendations.recommendations
    );


    // ===============================
    // SEND RESULT TO FRONTEND
    // ===============================

    return res.json({

        success: true,

        recommendations:
            recommendations.recommendations,

        model:
            result.model,

        responseTime:
            `${elapsed}s`

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

        error:
            "Gemini AI generation failed",

        details:
            error.message ||
            "Unknown Gemini error"

    });

}
````

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

```
    console.log(
        `OPITECH backend running on port ${PORT}`
    );

}
```

);
