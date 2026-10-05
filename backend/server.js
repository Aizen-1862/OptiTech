const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 10000;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const GROQ_MODEL = "openai/gpt-oss-20b";


// ======================================================
// BASIC ROUTE
// ======================================================

app.get("/", (req, res) => {
    res.json({
        status: "online",
        message: "OPITECH AI backend is running 🚀",
        ai: "Groq + Tavily",
        livePrices: "Amazon India + Flipkart"
    });
});


// ======================================================
// TAVILY SEARCH
// ======================================================

async function tavilySearch(query, domains = []) {

    if (!TAVILY_API_KEY) {
        throw new Error("TAVILY_API_KEY is missing");
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

                max_results: 5,

                include_answer: false,

                include_raw_content: false,

                include_images: false,

                ...(domains.length
                    ? {
                        include_domains: domains
                    }
                    : {})
            })
        }
    );

    const responseText = await response.text();

    if (!response.ok) {
        throw new Error(
            `Tavily error ${response.status}: ${responseText}`
        );
    }

    try {
        return JSON.parse(responseText);
    } catch {
        throw new Error(
            "Tavily returned invalid JSON"
        );
    }
}


// ======================================================
// GROQ STRUCTURED OUTPUT
// ======================================================

async function askGroq(prompt) {

    if (!GROQ_API_KEY) {
        throw new Error(
            "GROQ_API_KEY is missing"
        );
    }

    const schema = {
        type: "object",

        additionalProperties: false,

        properties: {

            recommendations: {
                type: "array",

                items: {

                    type: "object",

                    additionalProperties: false,

                    properties: {

                        rank: {
                            type: "integer"
                        },

                        name: {
                            type: "string"
                        },

                        brand: {
                            type: "string"
                        },

                        matchScore: {
                            type: "integer"
                        },

                        why: {
                            type: "string"
                        },

                        strengths: {
                            type: "array",
                            items: {
                                type: "string"
                            }
                        },

                        tradeoffs: {
                            type: "array",
                            items: {
                                type: "string"
                            }
                        },

                        amazonIndex: {
                            type: [
                                "integer",
                                "null"
                            ]
                        },

                        flipkartIndex: {
                            type: [
                                "integer",
                                "null"
                            ]
                        }

                    },

                    required: [
                        "rank",
                        "name",
                        "brand",
                        "matchScore",
                        "why",
                        "strengths",
                        "tradeoffs",
                        "amazonIndex",
                        "flipkartIndex"
                    ]
                }
            }

        },

        required: [
            "recommendations"
        ]
    };


    const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json",

                "Authorization":
                    `Bearer ${GROQ_API_KEY}`
            },

            body: JSON.stringify({

                model: GROQ_MODEL,

                temperature: 0,

                max_tokens: 2200,

                reasoning_effort: "low",

                response_format: {

                    type: "json_schema",

                    json_schema: {

                        name:
                            "opitech_recommendations",

                        strict: true,

                        schema

                    }

                },

                messages: [

                    {
                        role: "system",

                        content: `
You are OPITECH AI.

Your job is to rank real electronics products using ONLY the supplied web-search evidence.

CRITICAL RULES:

1. Never invent a product.
2. Never invent a price.
3. Never invent a URL.
4. Never invent an image.
5. Choose products that actually appear in the supplied evidence.
6. Prefer exact model matches.
7. Do not confuse similar models.
8. Respect the user's budget.
9. Return at most 3 recommendations.
10. amazonIndex must refer to an item in the supplied Amazon results.
11. flipkartIndex must refer to an item in the supplied Flipkart results.
12. If there is no reliable
