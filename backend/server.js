const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

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

        // OpenAI connection will be added in the next step.
        res.json({
            success: true,
            message: "Preferences received!",
            preferences: preferences
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Something went wrong"
        });
    }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`OPITECH backend running on port ${PORT}`);
});
