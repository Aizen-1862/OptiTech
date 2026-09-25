const BACKEND_URL = "https://opitech-backend.onrender.com";

let selectedType = "Phone";

const currencySymbols = {
    INR: "₹",
    USD: "$",
    GBP: "£",
    CAD: "C$",
    AUD: "A$",
    EUR: "€",
    AED: "د.إ",
    SGD: "S$"
};


/* =========================
   CURRENCY
========================= */

const currencySelect = document.getElementById("currency");
const currencySymbol = document.getElementById("currencySymbol");

if (currencySelect && currencySymbol) {
    currencySymbol.textContent =
        currencySymbols[currencySelect.value] || "";

    currencySelect.addEventListener("change", () => {
        currencySymbol.textContent =
            currencySymbols[currencySelect.value] || "";
    });
}


/* =========================
   PRODUCT TYPE
========================= */

document.querySelectorAll(".option").forEach(button => {

    button.addEventListener("click", () => {

        document.querySelectorAll(".option").forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        selectedType = button.dataset.type;

        console.log("Selected product:", selectedType);
    });

});


/* =========================
   GET SELECTED USES
========================= */

function getSelectedUses() {

    const checkboxes = document.querySelectorAll(
        '.checkbox-grid input[type="checkbox"]:checked'
    );

    return Array.from(checkboxes).map(
        checkbox => checkbox.value
    );
}


/* =========================
   GET PREFERENCES
========================= */

function getPreferences() {

    return {

        productType: selectedType,

        country:
            document.getElementById("country")?.value ||
            "India",

        currency:
            document.getElementById("currency")?.value ||
            "INR",

        budget:
            document.getElementById("budget")?.value ||
            "",

        uses:
            getSelectedUses(),

        priority:
            document.getElementById("priority")?.value ||
            "balanced",

        brand:
            document.getElementById("brand")?.value ||
            "any"
    };
}


/* =========================
   MAIN OPITECH AI
========================= */

async function testOPITECHAI() {

    const resultsContainer =
        document.getElementById("resultsContainer");

    if (!resultsContainer) {
        console.error("resultsContainer not found.");
        return;
    }


    /* SHOW LOADING */

    resultsContainer.innerHTML = `
        <div class="result-card">
            <h2>🤖 OPITECH AI is thinking...</h2>
            <p>
                Searching products, prices and specifications...
            </p>
        </div>
    `;


    /* GET USER PREFERENCES */

    const preferences = getPreferences();

    console.log(
        "Sending preferences:",
        preferences
    );


    try {

        /* =========================
           SEND DIRECTLY TO BACKEND
           
           IMPORTANT:
           Do NOT wrap this inside
           { preferences: preferences }
        ========================= */

        const response = await fetch(
            `${BACKEND_URL}/api/recommend`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(preferences)
            }
        );


        const data = await response.json();


        console.log(
            "OPITECH backend response:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data.details ||
                data.error ||
                "AI request failed"
            );

        }


        /* =========================
           GET RECOMMENDATIONS
        ========================= */

        const recommendations =
            data.recommendations ||
            data.result ||
            [];


        if (
            !Array.isArray(recommendations) ||
            recommendations.length === 0
        ) {

            throw new Error(
                "OPITECH did not return any recommendations."
            );

        }


        /* =========================
           DISPLAY RESULTS
        ========================= */

        resultsContainer.innerHTML = `
            <div class="result-card">

                <h2>🤖 OPITECH AI Recommendations</h2>

                <div class="recommendations-container">

                    ${formatRecommendations(
                        recommendations
                    )}

                </div>

            </div>
        `;


    } catch (error) {

        console.error(
            "OPITECH AI Error:",
            error
        );


        resultsContainer.innerHTML = `
            <div class="result-card">

                <h2>❌ AI connection failed</h2>

                <p>
                    ${escapeHTML(
                        error.message ||
                        "Something went wrong."
                    )}
                </p>

            </div>
        `;

    }

}


/* =========================
   FORMAT RECOMMENDATIONS
========================= */

function formatRecommendations(
    recommendations
) {

    return recommendations
        .sort(
            (a, b) =>
                Number(a.rank || 999) -
                Number(b.rank || 999)
        )
        .map(product => {

            const rank =
                product.rank || "";

            const name =
                product.name ||
                "Unknown product";

            const price =
                product.price ||
                "Price unavailable";

            const priceSource =
                product.priceSource ||
                "Web search";

            const matchScore =
                product.matchScore ??
                "N/A";

            const why =
                product.why ||
                "No explanation provided.";


            const strengths =
                Array.isArray(product.strengths)
                    ? product.strengths
                    : [];

            const tradeoffs =
                Array.isArray(product.tradeoffs)
                    ? product.tradeoffs
                    : [];


            return `

                <div class="ai-recommendation">

                    <h3>
                        #${escapeHTML(String(rank))}
                        ${escapeHTML(name)}
                    </h3>


                    <p>
                        💰
                        <strong>
                            ${escapeHTML(String(price))}
                        </strong>
                    </p>


                    <p>
                        🎯
                        <strong>
                            ${escapeHTML(
                                String(matchScore)
                            )}% Match
                        </strong>
                    </p>


                    <p>
                        <strong>
                            Why OPITECH chose it:
                        </strong>
                        ${escapeHTML(why)}
                    </p>


                    ${
                        strengths.length > 0
                            ? `
                                <div>
                                    <strong>
                                        ✅ Strengths
                                    </strong>

                                    <ul>
                                        ${strengths
                                            .map(
                                                item =>
                                                    `<li>${escapeHTML(
                                                        String(item)
                                                    )}</li>`
                                            )
                                            .join("")}
                                    </ul>
                                </div>
                              `
                            : ""
                    }


                    ${
                        tradeoffs.length > 0
                            ? `
                                <div>
                                    <strong>
                                        ⚠️ Tradeoffs
                                    </strong>

                                    <ul>
                                        ${tradeoffs
                                            .map(
                                                item =>
                                                    `<li>${escapeHTML(
                                                        String(item)
                                                    )}</li>`
                                            )
                                            .join("")}
                                    </ul>
                                </div>
                              `
                            : ""
                    }


                    <p class="price-source">

                        🔎 Price source:
                        ${escapeHTML(
                            String(priceSource)
                        )}

                    </p>

                </div>

            `;

        })
        .join("");

}


/* =========================
   ESCAPE HTML
========================= */

function escapeHTML(value) {

    return String(value)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");
}


/* =========================
   OPTIONAL OLD FUNCTION
========================= */

function formatAIResponse(text) {

    if (!text) {
        return "No recommendation was returned.";
    }

    return String(text)
        .replace(/\n/g, "<br>")
        .replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );
}
