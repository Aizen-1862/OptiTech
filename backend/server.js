const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();

app.use(cors());
app.use(express.json());

const apiKey = process.env.OPENAI_API_KEY;

console.log(
    "OPENAI KEY CHECK:",
    apiKey ? `Loaded (${apiKey.length} characters)` : "MISSING"
);

const client = new OpenAI({
    apiKey: apiKey
});

app.get("/", (req, res) => {
    res.json({
        status: "online",
        message: "OPITECH AI backend is running 🚀"
    });
});

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
You are OPITECH, an electronics recommendation assistant.

Analyze the user's budget, usage, preferences and priorities.

Give practical recommendations.

Do not invent specifications or prices.
If current product information is unavailable, clearly say so.

Return:
1. Understanding of the user's needs
2. Recommended product categories
3. Important specifications to look for
4. Why those specifications matter
5. Important trade-offs
`,
            input: JSON.stringify(preferences)
        });

        console.log("AI response received");

        return res.json({
            success: true,
            result: response.output_text
        });

    } catch (error) {
        console.error("OPENAI ERROR:", error);

        return res.status(500).json({
            error: "AI generation failed",
            details: error.message || "Unknown server error"
        });
    }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`OPITECH backend running on port ${PORT}`);
});
