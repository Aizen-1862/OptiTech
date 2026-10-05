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
        livePrices: "Amazon India + Flipkart"
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
// TAVILY SEARCH
// =====================================================

async function tavilySearch(query, domains) {

    if (!TAVILY_API_KEY) {
        throw new Error("TAVILY_API_KEY is missing in Render.");
    }

    const response = await fetch(
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
                include_images: true,
                include_domains: domains
            })
        }
    );

    const text = await response.text();

    if (!response.ok) {
        throw new Error(
            `Tavily error ${response.status}: ${text}`
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
// CLEAN SEARCH RESULTS
// =====================================================

function cleanSearchResults(data, marketplace) {

    if (!data || !Array.isArray(data.results)) {
        return [];
    }

    return data.results.map((item, index) => {

        return {
            index: index,
            marketplace: marketplace,
            title: item.title || "",
            url: item.url || "",
            content: String(item.content || "")
                .replace(/\s+/g, " ")
                .slice(0, 700)
        };

    });
}


// =====================================================
// GROQ
// =====================================================

async function askGroq(userPrompt, amazonResults, flipkartResults) {

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
You are OPITECH AI, an electronics recommendation engine.

Your task is to recommend the best real products for the user's requirements.

IMPORTANT:

- Use ONLY products found in the supplied search evidence.
- NEVER invent a product model.
- NEVER invent a price.
- NEVER invent an Amazon URL.
- NEVER invent a Flipkart URL.
- NEVER invent an image URL.
- Prefer exact model names from the evidence.
- Stay within the user's budget whenever possible.
- Rank products based on the user's requested uses and priorities.
- Return a maximum of 3 products.
- Amazon and Flipkart prices must come from the supplied evidence.
- If a marketplace does not have a reliable matching result, use null.
- Do not put explanations outside the JSON.

The frontend expects this exact JSON structure:

{
  "recommendations": [
    {
      "rank": 1,
      "name": "exact product name",
      "brand": "brand",
      "price": 49999,
      "priceSource": "Amazon India",
      "imageUrl": null,
      "matchScore": 95,
      "why": "short explanation",
      "strengths": [
        "strength 1",
        "strength 2",
        "strength 3"
      ],
     
