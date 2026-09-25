const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is missing!");
}

const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY
});


/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
    res.json({
        status: "online",
        message: "OPITECH AI backend is running 🚀",
        ai: "Gemini + Google Search"
    });
});


/* =========================
   GEMINI + WEB SEARCH
========================= */

async function generateRecommendation(prompt) {

    const models = [
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.6-flash"
    ];

    let lastError = null;

    for (const model of models) {

        try {

            console.log(`Trying Gemini model: ${model}`);

            const response = await ai.models.generateContent({

                model: model,

                contents: prompt,

                config: {

                    tools: [
                        {
                            googleSearch: {}
                        }
                    ]

                }

            });

            console.log(`Gemini model succeeded: ${model}`);

            return response;

        } catch (error) {

            lastError = error;

            console.error(
                `Model ${model} failed:`,
                error.message || error
            );

        }

    }

    throw lastError;
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


        console.log("Received preferences:", {
            productType,
            country,
            currency,
            budget,
            uses,
            priority,
            brand
        });


        /* =========================
           AI PROMPT
        ========================= */

        const prompt = `
You are OPITECH, an electronics recommendation AI.

Your job is to find the BEST CURRENT products for the user's requirements.

USER REQUIREMENTS:

Product type: ${productType}
Country: ${country}
Currency: ${currency}
Maximum budget: ${budget}
Uses: ${Array.isArray(uses) ? uses.join(", ") : uses}
Priority: ${priority}
Preferred brand: ${brand}


IMPORTANT:

You MUST use Google Search to find CURRENT information.

Search the web for real products that are currently available in the user's country.

For every recommendation:

1. Find the exact product model.
2. Find its CURRENT price.
3. Prefer prices from:
   - official manufacturer stores
   - Amazon
   - Flipkart
   - Croma
   - Reliance Digital
   - other reputable retailers
4. Make sure the product fits within the user's maximum budget.
5. Do NOT invent a price.
6. Do NOT use "Verify current price".
7. Do NOT use "Check price".
8. Do NOT leave the price blank.
9. Return the actual numeric price found during your web search.
10. If multiple current prices exist, use the most relevant normal selling price and mention the source.
11. Do not use an old launch price if a newer selling price is available.


RANKING:

Return exactly 3 products.

Rank them:

#1 = strongest overall match
#2 = second strongest match
#3 = third strongest match

The ranking should consider:

- user's budget
- user's uses
- performance
- user's priority
- preferred brand
- current specifications
- current price
- overall value


PRICE:

The price MUST be the current price found from web search.

For India, return prices like:

₹24999

For USD:

$499

Do not write:

"Verify current price"

Do not write:

"Price unavailable"

Do not make up a price.


RETURN ONLY VALID JSON.

Use exactly this structure:

{
  "recommendations": [
    {
      "rank": 1,
      "name": "Exact Product Model",
      "price": "₹24999",
      "priceSource": "Source name",
      "matchScore": 95,
      "why": "Short explanation of why this product matches the user's requirements.",
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


        /* =========================
           CALL GEMINI
        ========================= */

        const response = await generateRecommendation(prompt);

        let text = response.text || "";

        console.log("RAW GEMINI RESPONSE:");
        console.log(text);


        /* =========================
           CLEAN JSON
        ========================= */

        text = text
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();


        let data;

        try {

            data = JSON.parse(text);

        } catch (parseError) {

            console.error("JSON parsing failed:", parseError);

            return res.status(500).json({
                error: "AI returned invalid JSON",
                raw: text
            });

        }


        /* =========================
           SORT BY RANK
        ========================= */

        if (
            data.recommendations &&
            Array.isArray(data.recommendations)
        ) {

            data.recommendations.sort(
                (a, b) => a.rank - b.rank
            );

        }


        /* =========================
           SEND RESULT
        ========================= */

        res.json({

            success: true,

            recommendations:
                data.recommendations || [],

            result:
                data.recommendations || []

        });


    } catch (error) {

        console.error("AI generation failed:");

        console.error(error);

        res.status(500).json({

            error: "AI generation failed",

            details:
                error.message || "Unknown error",

            type:
                error.name || "UnknownError",

            code:
                error.status || error.code || null

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
            `OPITECH BACKEND IS LIVE 🚀 PORT ${PORT}`
        );

    }
);
