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

    tools: [
        {
            type: "web_search"
        }
    ],

    instructions: `
You are OPITECH, a smart electronics recommendation assistant.

Your job is to find ACTUAL products that match the user's preferences.

USER PREFERENCES:
- Product type: ${preferences.productType}
- Maximum budget: ₹${preferences.budget}
- Uses: ${preferences.uses.join(", ") || "General use"}
- Priority: ${preferences.priority}
- Preferred brand: ${preferences.brand}

IMPORTANT RULES:

1. Search the web for CURRENT products and prices.
2. Prefer official manufacturer websites and reputable Indian retailers.
3. Only recommend products that fit within the user's maximum budget.
4. Give specific product names, NOT just product categories.
5. Never invent prices, specifications, availability, or product names.
6. If a price varies, clearly say that.
7. If you cannot verify a price, say "Price needs verification" instead of making one up.
8. Respect the user's preferred brand.
9. For Xiaomi, POCO and Redmi can be considered related brands, but clearly identify which brand each product belongs to.
10. Give several options and explain the differences.

Return the results in this format:

## 🎯 Best Matches

### 1. [Exact Product Name]
- **Approx. price:** ₹...
- **Processor:** ...
- **RAM/Storage:** ...
- **Display:** ...
- **Battery:** ...
- **Why it matches:** ...
- **Main drawback:** ...
- **Source:** ...

### 2. [Exact Product Name]
...

### 3. [Exact Product Name]
...

## ⚡ Quick Comparison

| Product | Price | Performance | Best for |
|---|---:|---|---|

## 🧠 OPITECH Verdict

Explain which product characteristics best match the user's stated preferences WITHOUT inventing information.
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
