const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();

app.use(cors({
    origin: "*"
}));

app.use(express.json());

const apiKey = process.env.OPENAI_API_KEY;

console.log(
    "OPENAI KEY CHECK:",
    apiKey ? `Loaded (${apiKey.length} characters)` : "MISSING"
);

const client = new OpenAI({
    apiKey: apiKey
});


// HOME / TEST ROUTE
app.get("/", (req, res) => {
    res.json({
        status: "online",
        message: "OPITECH AI backend is running 🚀"
    });
});


// AI RECOMMENDATION ROUTE
app.post("/api/recommend", async (req, res) => {

    try {

        const { preferences } = req.body;

        console.log("Received preferences:", preferences);

        if (!preferences) {
            return res.status(400).json({
                error: "Preferences are required"
            });
        }

        const response = await client.responses.create({

            model: "gpt-5.6-luna",

            instructions: `
You are OPITECH, a smart electronics recommendation assistant.

Analyze the user's electronics preferences.

USER PREFERENCES:
- Product type: ${preferences.productType}
- Country: ${preferences.country}
- Currency: ${preferences.currency}
- Maximum budget: ${preferences.budget}
- Uses: ${preferences.uses?.join(", ") || "General use"}
- Priority: ${preferences.priority}
- Preferred brand: ${preferences.brand}

Give useful and practical recommendations.

Do not invent specifications or prices.

Explain:
1. What the user needs
2. Suitable product types
3. Important specifications
4. Why those specifications matter
5. Important trade-offs

If you do not know a current price, clearly say that the price needs verification.
`,

            input: JSON.stringify(preferences)

        });

        console.log("AI response received");

        return res.json({
            success: true,
            result: response.output_text
        });

    } catch (error) {

        console.error("========== OPENAI ERROR ==========");
        console.error("Message:", error.message);
        console.error("Status:", error.status);
        console.error("Code:", error.code);
        console.error("Type:", error.type);
        console.error("Full error:", error);
        console.error("==================================");

        return res.status(500).json({
            error: "AI generation failed",
            details: error.message || "Unknown server error",
            type: error.type || "unknown",
            code: error.code || "unknown"
        });

    }

});


// START SERVER
const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `OPITECH backend running on port ${PORT}`
    );

});
