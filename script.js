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


// ===============================
// CURRENCY
// ===============================

const currencySelect = document.getElementById("currency");
const currencySymbol = document.getElementById("currencySymbol");

if (currencySelect) {
    currencySelect.addEventListener("change", function () {
        if (currencySymbol) {
            currencySymbol.textContent =
                currencySymbols[currencySelect.value] ||
                currencySelect.value;
        }
    });
}


// ===============================
// PRODUCT TYPE
// ===============================

document.querySelectorAll(".option").forEach(button => {

    button.addEventListener("click", function () {

        document.querySelectorAll(".option").forEach(item => {
            item.classList.remove("active");
        });

        button.classList.add("active");

        selectedType =
            button.dataset.type ||
            button.textContent.trim();

        console.log("Selected product:", selectedType);
    });

});


// ===============================
// HELPERS
// ===============================

function getValue(id, fallback = "") {

    const element = document.getElementById(id);

    if (!element) {
        return fallback;
    }

    return element.value || fallback;
}


function getSelectedUses() {

    return Array.from(
        document.querySelectorAll(
            '.checkbox-grid input[type="checkbox"]:checked'
        )
    ).map(input => input.value)
     .filter(Boolean);
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatPrice(price, currency) {

    if (
        price === null ||
        price === undefined ||
        price === "" ||
        !Number.isFinite(Number(price))
    ) {
        return "Price unavailable";
    }

    const symbol =
        currencySymbols[currency] ||
        currency ||
        "₹";

    return symbol + Number(price).toLocaleString("en-IN");
}


function safeUrl(url) {

    if (!url) {
        return "";
    }

    try {

        const parsed = new URL(url);

        if (
            parsed.protocol === "http:" ||
            parsed.protocol === "https:"
        ) {
            return parsed.href;
        }

    } catch (error) {
        return "";
    }

    return "";
}


// ===============================
// MARKETPLACE CARD
// ===============================

function marketplaceCard(
    marketplaceName,
    marketplace,
    currency
) {

    if (!marketplace) {
        return "";
    }

    const url = safeUrl(marketplace.url);

    const price = marketplace.price
        ? formatPrice(marketplace.price, currency)
        : "Price unavailable";

    if (!url) {

        return `
            <div class="marketplace">

                <strong>
                    ${escapeHtml(marketplaceName)}
                </strong>

                <span>
                    ${escapeHtml(price)}
                </span>

            </div>
        `;
    }

    return `
        <div class="marketplace">

            <div class="marketplace-info">

                <strong>
                    ${escapeHtml(marketplaceName)}
                </strong>

                <span>
                    ${escapeHtml(price)}
                </span>

            </div>

            <a
                href="${escapeHtml(url)}"
                target="_blank"
                rel="noopener noreferrer"
                class="buy-button"
            >
                View Product ↗
            </a>

        </div>
    `;
}


// ===============================
// SHOW RESULTS
// ===============================

function renderRecommendations(data) {

    const container =
        document.getElementById("resultsContainer");

    if (!container) {
        console.error("resultsContainer not found.");
        return;
    }

    const recommendations =
        Array.isArray(data.recommendations)
            ? data.recommendations
            : [];

    if (!recommendations.length) {

        container.innerHTML = `
            <div class="empty-results">

                <div class="empty-icon">
                    😕
                </div>

                <h3>
                    No suitable products found
                </h3>

                <p>
                    Try increasing your budget
                    or changing your preferences.
                </p>

            </div>
        `;

        return;
    }

    const currency = getValue("currency", "INR");

    container.innerHTML = `

        <div class="results-header">

            <h2>
                Your Best Matches
            </h2>

            <p>
                OPITECH found these products
                based on your requirements.
            </p>

        </div>

        ${recommendations.map((product, index) => {

            const rank =
                product.rank || index + 1;

            const image =
                safeUrl(product.imageUrl);

            const mainPrice =
                product.price !== null &&
                product.price !== undefined
                    ? formatPrice(
                        product.price,
                        currency
                    )
                    : "Price unavailable";

            const strengths =
                Array.isArray(product.strengths)
                    ? product.strengths
                    : [];

            const tradeoffs =
                Array.isArray(product.tradeoffs)
                    ? product.tradeoffs
                    : [];

            return `

                <article class="recommendation-card">

                    <div class="rank">
                        #${rank}
                    </div>

                    ${
                        image
                            ? `
                                <div class="product-image-container">

                                    <img
                                        src="${escapeHtml(image)}"
                                        alt="${escapeHtml(product.name)}"
                                        class="product-image"
                                        loading="lazy"
                                        onerror="this.parentElement.style.display='none'"
                                    >

                                </div>
                            `
                            : ""
                    }

                    <div class="product-content">

                        <h3>
                            ${escapeHtml(
                                product.name ||
                                "Recommended product"
                            )}
                        </h3>

                        ${
                            product.brand
                                ? `
                                    <div class="brand">
                                        ${escapeHtml(product.brand)}
                                    </div>
                                `
                                : ""
                        }

                        <div class="main-price">
                            ${escapeHtml(mainPrice)}
                        </div>

                        ${
                            product.priceSource
                                ? `
                                    <div class="price-source">
                                        Price checked from:
                                        <strong>
                                            ${escapeHtml(
                                                product.priceSource
                                            )}
                                        </strong>
                                    </div>
                                `
                                : ""
                        }

                        ${
                            product.matchScore
                                ? `
                                    <div class="match-score">
                                        Match:
                                        <strong>
                                            ${escapeHtml(
                                                product.matchScore
                                            )}%
                                        </strong>
                                    </div>
                                `
                                : ""
                        }

                        <div class="marketplaces">

                            ${marketplaceCard(
                                "Amazon India",
                                product.amazon,
                                currency
                            )}

                            ${marketplaceCard(
                                "Flipkart",
                                product.flipkart,
                                currency
                            )}

                        </div>

                        ${
                            product.why
                                ? `
                                    <div class="why">

                                        <h4>
                                            Why this pick?
                                        </h4>

                                        <p>
                                            ${escapeHtml(
                                                product.why
                                            )}
                                        </p>

                                    </div>
                                `
                                : ""
                        }

                        ${
                            strengths.length
                                ? `
                                    <div class="strengths">

                                        <h4>
                                            👍 Strengths
                                        </h4>

                                        <ul>
                                            ${strengths.map(item =>
                                                `<li>${escapeHtml(item)}</li>`
                                            ).join("")}
                                        </ul>

                                    </div>
                                `
                                : ""
                        }

                        ${
                            tradeoffs.length
                                ? `
                                    <div class="tradeoffs">

                                        <h4>
                                            ⚠️ Trade-offs
                                        </h4>

                                        <ul>
                                            ${tradeoffs.map(item =>
                                                `<li>${escapeHtml(item)}</li>`
                                            ).join("")}
                                        </ul>

                                    </div>
                                `
                                : ""
                        }

                    </div>

                </article>
            `;

        }).join("")}

        <div class="price-disclaimer">

            ⚠️ Prices and availability can change.
            OPITECH checks current web-search
            evidence from Amazon India and Flipkart.

        </div>
    `;
}


// ===============================
// MAIN FIND BUTTON
// ===============================

async function testOPITECHAI() {

    const button =
        document.getElementById("findButton");

    const container =
        document.getElementById("resultsContainer");


    if (!button || !container) {

        console.error(
            "OPITECH: Button or results container missing."
        );

        return;
    }


    // Button loading state

    button.disabled = true;

    button.textContent =
        "⏳ Checking Amazon & Flipkart...";


    // Loading screen

    container.innerHTML = `

        <div class="empty-results">

            <div class="empty-icon">
                🔎
            </div>

            <h3>
                OPITECH is searching...
            </h3>

            <p>
                Checking current Amazon India
                and Flipkart prices.
            </p>

            <p>
                This may take a few seconds.
            </p>

        </div>
    `;


    try {

        const budget =
            getValue("budget");


        if (!budget || Number(budget) <= 0) {

            throw new Error(
                "Please enter a valid budget."
            );

        }


        const payload = {

            productType:
                selectedType,

            country:
                getValue(
                    "country",
                    "India"
                ),

            currency:
                getValue(
                    "currency",
                    "INR"
                ),

            budget:
                budget,

            uses:
                getSelectedUses(),

            priority:
                getValue(
                    "priority",
                    "balanced"
                ),

            brand:
                getValue(
                    "brand",
                    "any"
                )

        };


        console.log(
            "Sending OPITECH preferences:",
            payload
        );


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
                        JSON.stringify(payload)
                }
            );


        const rawText =
            await response.text();


        let data;


        try {

            data =
                JSON.parse(rawText);

        } catch (error) {

            throw new Error(
                "Backend returned invalid data."
            );

        }


        if (!response.ok) {

            throw new Error(
                data.error ||
                data.details ||
                `Backend error ${response.status}`
            );

        }


        if (!data.success) {

            throw new Error(
                data.error ||
                "Recommendation request failed."
            );

        }


        console.log(
            "OPITECH result:",
            data
        );


        renderRecommendations(data);


        // Scroll to results

        document
            .getElementById("results")
            ?.scrollIntoView({
                behavior: "smooth"
            });


    } catch (error) {

        console.error(
            "OPITECH error:",
            error
        );


        container.innerHTML = `

            <div class="empty-results">

                <div class="empty-icon">
                    ❌
                </div>

                <h3>
                    OPITECH couldn't get recommendations
                </h3>

                <p>
                    ${escapeHtml(
                        error.message ||
                        "Something went wrong."
                    )}
                </p>

                <p>
                    Please try again.
                </p>

            </div>
        `;

    } finally {

        button.disabled = false;

        button.textContent =
            "🔍 Find My Best Matches";

    }
}


// ===============================
// BACKEND TEST
// ===============================

async function checkOPITECHBackend() {

    try {

        const response =
            await fetch(BACKEND_URL);

        const data =
            await response.json();

        console.log(
            "OPITECH backend:",
            data
        );

        return data;

    } catch (error) {

        console.error(
            "Backend check failed:",
            error
        );

        return null;
    }
}


// ===============================
// MAKE FUNCTIONS AVAILABLE
// ===============================

window.testOPITECHAI = testOPITECHAI;

window.checkOPITECHBackend = checkOPITECHBackend;
