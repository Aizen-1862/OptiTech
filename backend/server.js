const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();

app.use(cors());
app.use(express.json());

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
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
If product information is not provided, clearly say that current product data is needed.

Return:
1. Understanding of the user's needs
2. Recommended product categories
3. Important specifications to look for
4. Explanation of why those specifications matter
5. Any important trade-offs
            `,
            input: JSON.stringify(preferences)
        });

        res.json({
            success: true,
            result: response.output_text
        });

    } catch (error) {
        console.error("OpenAI error:", error);

        res.status(500).json({
            error: "AI generation failed",
            details: error.message
        });
    }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`OPITECH backend running on port ${PORT}`);
});
