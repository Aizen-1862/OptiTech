/* =========================================================
   OPITECH - FRONTEND JAVASCRIPT
   Groq + Tavily Backend
========================================================= */


/* =========================================================
   BACKEND
========================================================= */

const BACKEND_URL = "https://opitech-backend.onrender.com";


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let selectedType = "Phone";


/* =========================================================
   CURRENCY SYMBOLS
========================================================= */

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


/* =========================================================
   PAGE INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    console.log("🚀 OPITECH frontend loaded");

    setupProductTypeButtons();

    setupCurrency();

    setupFindButton();

});


/* =========================================================
   PRODUCT TYPE BUTTONS
========================================================= */

function setupProductTypeButtons() {

    const options =
        document.querySelectorAll(".option");

    options.forEach(option => {

        option.addEventListener("click", () => {

            options.forEach(item => {
                item.classList.remove("active");
            });

            option.classList.add("active");

            selectedType =
                option.dataset.type ||
                option.textContent.trim();

            console.log(
                "📱 Selected product:",
                selectedType
            );

        });

    });

}


/* =========================================================
   CURRENCY
========================================================= */

function setupCurrency() {

    const currency =
        document.getElementById("currency");

    const symbol =
        document.getElementById("currencySymbol");

    if (!currency) {
        return;
    }

    function updateCurrencySymbol() {

        const value =
            currency.value;

        if (symbol) {

            symbol.textContent =
                currencySymbols[value] ||
                value;

        }

    }

    currency.addEventListener(
        "change",
        updateCurrencySymbol
    );

    updateCurrencySymbol();

}


/* =========================================================
   FIND BUTTON
========================================================= */

function setupFindButton() {

    const button =
        document.getElementById("findButton");

    if (!button) {

        console.warn(
            "⚠️ Find button not found"
        );

        return;
    }

    /*
       Remove old inline behavior if necessary.
       Your HTML may already contain onclick.
       This listener still works safely.
    */

    button.addEventListener(
        "click",
        testOPITECHAI
    );

}


/* =========================================================
   GET SELECTED USES
========================================================= */

function getSelectedUses() {

    const checkboxes =
        document.querySelectorAll(
            '.checkbox-grid input[type="checkbox"]:checked'
        );

    return Array.from(checkboxes)
        .map(checkbox => {

            /*
               Prefer value attribute.
               Fall back to label text.
            */

            return (
                checkbox.value ||
                checkbox.dataset.use ||
                checkbox.parentElement?.textContent?.trim() ||
                ""
            ).trim();

        })
        .filter(Boolean);

}


/* =========================================================
   GET VALUE SAFELY
========================================================= */

function getValue(id, fallback = "") {

    const element =
        document.getElementById(id);

    if (!element) {
        return fallback;
    }

    return element.value?.trim() || fallback;

}


/* =========================================================
   MAIN OPITECH AI FUNCTION
========================================================= */

async function testOPITECHAI() {

    console.log(
        "🚀 OPITECH AI search started"
    );


    /* =====================================================
       GET USER PREFERENCES
    ===================================================== */

    const productType =
        selectedType ||
        getValue("productType", "Phone");

    const country =
        getValue(
            "country",
            "India"
        );

    const currency =
        getValue(
            "currency",
            "INR"
        );

    const budget =
        getValue(
            "budget",
            ""
        );

    const priority =
        getValue(
            "priority",
            "balanced"
        );

    const brand =
        getValue(
            "brand",
            "any"
        );

    const uses =
        getSelectedUses();


    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!budget) {

        showError(
            "Please enter your budget first."
        );

        return;

    }


    /* =====================================================
       REQUEST OBJECT
    ===================================================== */

    const preferences = {

        productType,
        country,
        currency,
        budget,
        uses,
        priority,
        brand

    };


    console.log(
        "📤 Sending preferences:",
        preferences
    );


    /* =====================================================
       BUTTON LOADING STATE
    ===================================================== */

    const button =
        document.getElementById("findButton");

    const originalButtonText =
        button?.innerHTML ||
        "🔍 Find My Best Matches";


    if (button) {

        button.disabled = true;

        button.innerHTML =
            "⏳ Finding the best matches...";

    }


    /* =====================================================
       SHOW LOADING
    ===================================================== */

    showLoading();


    /* =====================================================
       CALL BACKEND
    ===================================================== */

    try {

        const response =
            await fetch(
                `${BACKEND_URL}/api/recommend`,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify(
                            preferences
                        )

                }
            );


        console.log(
            "📡 Backend HTTP status:",
            response.status
        );


        /* =================================================
           READ RESPONSE
        ================================================= */

        const rawText =
            await response.text();


        console.log(
            "📥 Raw backend response:",
            rawText
        );


        let data;


        try {

            data =
                JSON.parse(rawText);

        } catch {

            throw new Error(
                "Backend returned an invalid response."
            );

        }


        /* =================================================
           HANDLE BACKEND ERROR
        ================================================= */

        if (!response.ok) {

            console.error(
                "❌ Backend error:",
                data
            );

            throw new Error(
                data.details ||
                data.error ||
                `Backend error ${response.status}`
            );

        }


        /* =================================================
           GET RECOMMENDATIONS
        ================================================= */

        const recommendations =
            data.recommendations ||
            data.result;


        if (
            !Array.isArray(
                recommendations
            )
        ) {

            throw new Error(
                "AI returned no recommendations."
            );

        }


        if (
            recommendations.length === 0
        ) {

            throw new Error(
                "No suitable products were found."
            );

        }


        console.log(
            "✅ Recommendations received:",
            recommendations
        );


        /* =================================================
           DISPLAY RESULTS
        ================================================= */

        displayRecommendations(
            recommendations,
            preferences
        );


    } catch (error) {

        console.error(
            "❌ OPITECH AI failed:",
            error
        );


        showError(
            error.message ||
            "Something went wrong while finding recommendations."
        );


    } finally {

        /* =================================================
           RESTORE BUTTON
        ================================================= */

        if (button) {

            button.disabled = false;

            button.innerHTML =
                originalButtonText;

        }

    }

}


/* =========================================================
   LOADING SCREEN
========================================================= */

function showLoading() {

    let container =
        document.getElementById(
            "results"
        );


    if (!container) {

        container =
            document.querySelector(
                ".results"
            );

    }


    if (!container) {

        console.warn(
            "⚠️ Results container not found"
        );

        return;

    }


    container.innerHTML = `

        <div class="opitech-loading">

            <div class="loading-spinner"></div>

            <h2>
                OPITECH AI is searching...
            </h2>

            <p>
                Checking current products,
                prices and specifications.
            </p>

        </div>

    `;


    container.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/* =========================================================
   DISPLAY ERROR
========================================================= */

function showError(message) {

    let container =
        document.getElementById(
            "results"
        );


    if (!container) {

        container =
            document.querySelector(
                ".results"
            );

    }


    if (!container) {

        alert(message);

        return;

    }


    container.innerHTML = `

        <div class="opitech-error">

            <div class="error-icon">
                ⚠️
            </div>

            <h2>
                AI connection failed
            </h2>

            <p>
                ${escapeHTML(message)}
            </p>

            <button
                class="retry-button"
                onclick="testOPITECHAI()"
            >
                🔄 Try Again
            </button>

        </div>

    `;


    container.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/* =========================================================
   DISPLAY RECOMMENDATIONS
========================================================= */

function displayRecommendations(
    recommendations,
    preferences
) {

    let container =
        document.getElementById(
            "results"
        );


    if (!container) {

        container =
            document.querySelector(
                ".results"
            );

    }


    if (!container) {

        console.error(
            "❌ Results container not found"
        );

        return;

    }


    const currencySymbol =
        currencySymbols[
            preferences.currency
        ] ||
        preferences.currency ||
        "₹";


    let html = `

        <div class="recommendations-header">

            <h2>
                🎯 Your OPITECH Matches
            </h2>

            <p>
                Based on your
                ${escapeHTML(
                    preferences.productType
                )}
                requirements
            </p>

        </div>

        <div class="recommendations-grid">

    `;


    recommendations.forEach(
        (product, index) => {

            html +=
                createProductCard(
                    product,
                    index,
                    currencySymbol
                );

        }
    );


    html += `

        </div>

    `;


    container.innerHTML =
        html;


    container.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });


    console.log(
        "🎉 Results displayed"
    );

}


/* =========================================================
   CREATE PRODUCT CARD
========================================================= */

function createProductCard(
    product,
    index,
    currencySymbol
) {

    const rank =
        Number(product.rank) ||
        index + 1;


    const name =
        product.name ||
        "Unknown Product";


    let price =
        product.price ||
        "Price unavailable";


    /*
       If backend returns a numeric price,
       format it with currency.
    */

    if (
        typeof price === "number"
    ) {

        price =
            currencySymbol +
            price.toLocaleString(
                "en-IN"
            );

    }


    const priceSource =
        product.priceSource ||
        "Web search";


    const matchScore =
        Number(
            product.matchScore
        ) || 0;


    const why =
        product.why ||
        "Matches your requirements.";


    const strengths =
        Array.isArray(
            product.strengths
        )
            ? product.strengths
            : [];


    const tradeoffs =
        Array.isArray(
            product.tradeoffs
        )
            ? product.tradeoffs
            : [];


    let strengthsHTML = "";


    strengths
        .slice(0, 3)
        .forEach(strength => {

            strengthsHTML += `

                <li>
                    <span>✓</span>
                    ${escapeHTML(
                        strength
                    )}
                </li>

            `;

        });


    let tradeoffsHTML = "";


    tradeoffs
        .slice(0, 2)
        .forEach(tradeoff => {

            tradeoffsHTML += `

                <li>
                    <span>•</span>
                    ${escapeHTML(
                        tradeoff
                    )}
                </li>

            `;

        });


    return `

        <article
            class="product-card"
            data-rank="${rank}"
        >

            <div class="product-card-top">

                <div class="rank-badge">
                    #${rank}
                </div>

                <div class="match-score">
                    ${matchScore}%
                    Match
                </div>

            </div>


            <h3 class="product-name">
                ${escapeHTML(name)}
            </h3>


            <div class="product-price">
                ${escapeHTML(
                    String(price)
                )}
            </div>


            <div class="price-source">
                Price source:
                ${escapeHTML(
                    String(priceSource)
                )}
            </div>


            <div class="product-why">

                <h4>
                    Why OPITECH picked it
                </h4>

                <p>
                    ${escapeHTML(why)}
                </p>

            </div>


            ${
                strengths.length
                    ? `

                    <div class="product-strengths">

                        <h4>
                            Strengths
                        </h4>

                        <ul>
                            ${strengthsHTML}
                        </ul>

                    </div>

                    `
                    : ""
            }


            ${
                tradeoffs.length
                    ? `

                    <div class="product-tradeoffs">

                        <h4>
                            Trade-offs
                        </h4>

                        <ul>
                            ${tradeoffsHTML}
                        </ul>

                    </div>

                    `
                    : ""
            }


        </article>

    `;

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   BACKEND CONNECTION TEST
========================================================= */

async function checkOPITECHBackend() {

    try {

        console.log(
            "🔎 Checking OPITECH backend..."
        );


        const response =
            await fetch(
                BACKEND_URL
            );


        const data =
            await response.json();


        console.log(
            "✅ OPITECH backend:",
            data
        );


        return true;


    } catch (error) {

        console.error(
            "❌ Backend unavailable:",
            error
        );


        return false;

    }

}


/* =========================================================
   OPTIONAL BACKEND TEST
========================================================= */

window.checkOPITECHBackend =
    checkOPITECHBackend;


/* =========================================================
   MAKE MAIN FUNCTION AVAILABLE TO HTML
========================================================= */

window.testOPITECHAI =
    testOPITECHAI;


/* =========================================================
   INITIAL BACKEND CHECK
========================================================= */

setTimeout(() => {

    checkOPITECHBackend();

}, 1000);
