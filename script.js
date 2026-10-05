const BACKEND_URL =
    "https://opitech-backend.onrender.com";

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

let selectedType = "Phone";


// ==============================
// HELPERS
// ==============================

function getValue(id, fallback = "") {

    const element =
        document.getElementById(id);

    if (!element) {
        return fallback;
    }

    return element.value ?? fallback;
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function safeUrl(url) {

    if (!url) {
        return "";
    }

    try {

        const parsed =
            new URL(url);

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


function formatPrice(
    price,
    currency = "INR"
) {

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
        currency;

    return (
        symbol +
        " " +
        Number(price).toLocaleString(
            "en-IN"
        )
    );
}


// ==============================
// NAVIGATION
// ==============================

function start() {

    const finder =
        document.getElementById(
            "finder"
        );

    if (finder) {

        finder.scrollIntoView({
            behavior: "smooth"
        });
    }
}

window.start = start;


function selectCategory(type) {

    selectedType = type;

    const category =
        document.getElementById(
            "category"
        );

    if (category) {
        category.value = type;
    }

    start();
}

window.selectCategory =
    selectCategory;


// ==============================
// MARKETPLACE CARD
// ==============================

function marketplaceCard(
    marketplaceName,
    marketplace,
    currency
) {

    if (!marketplace) {
        return "";
    }

    const url =
        safeUrl(
            marketplace.url
        );

    const price =
        formatPrice(
            marketplace.price,
            currency
        );

    return `

        <div class="marketplace">

            <div class="marketplace-info">

                <strong>
                    ${escapeHtml(
                        marketplaceName
                    )}
                </strong>

                <span>
                    ${escapeHtml(price)}
                </span>

            </div>

            ${
                url
                    ? `
                        <a
                            class="buy-button"
                            href="${escapeHtml(url)}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            View Product ↗
                        </a>
                    `
                    : ""
            }

        </div>

    `;
}


// ==============================
// RENDER RESULTS
// ==============================

function renderRecommendations(data) {

    const container =
        document.getElementById(
            "result"
        );

    if (!container) {
        return;
    }

    container.classList.remove(
        "hidden"
    );


    const recommendations =
        Array.isArray(
            data.recommendations
        )
            ? data.recommendations
            : [];


    if (
        recommendations.length === 0
    ) {

        container.innerHTML = `

            <div class="error-message">

                <h3>
                    No suitable products found 😕
                </h3>

                <p>
                    Try increasing your budget
                    or changing your preferences.
                </p>

            </div>

        `;

        return;
    }


    const currency =
        data.currency ||
        "INR";


    container.innerHTML = `

        <div class="results-header">

            <h2>
                Your Best Matches
            </h2>

            <p>
                OPITECH found these products
                for your requirements.
            </p>

        </div>


        ${recommendations
            .map(
                (product, index) => {

                    const rank =
                        product.rank ||
                        index + 1;

                    const image =
                        safeUrl(
                            product.imageUrl
                        );

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


                    return `

                        <article
                            class="recommendation-card"
                        >

                            <div class="rank">

                                #${rank}

                            </div>


                            ${
                                image
                                    ? `

                                        <div
                                            class="product-image-container"
                                        >

                                            <img
                                                class="product-image"
                                                src="${escapeHtml(
                                                    image
                                                )}"
                                                alt="${escapeHtml(
                                                    product.name ||
                                                    "Recommended product"
                                                )}"
                                                loading="lazy"
                                                onerror="this.parentElement.style.display='none'"
                                            >

                                        </div>

                                    `
                                    : ""
                            }


                            <div
                                class="product-content"
                            >

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

                                                ${escapeHtml(
                                                    product.brand
                                                )}

                                            </div>

                                        `
                                        : ""
                                }


                                <div
                                    class="main-price"
                                >

                                    ${escapeHtml(
                                        formatPrice(
                                            product.price,
                                            currency
                                        )
                                    )}

                                </div>


                                ${
                                    product.priceSource
                                        ? `

                                            <div
                                                class="price-source"
                                            >

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

                                            <div
                                                class="match-score"
                                            >

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


                                <div
                                    class="marketplaces"
                                >

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

                                            <div
                                                class="why"
                                            >

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

                                            <div
                                                class="strengths"
                                            >

                                                <h4>
                                                    👍 Strengths
                                                </h4>

                                                <ul>

                                                    ${strengths
                                                        .map(
                                                            item =>
                                                                `
                                                                <li>
                                                                    ${escapeHtml(
                                                                        item
                                                                    )}
                                                                </li>
                                                                `
                                                        )
                                                        .join("")
                                                    }

                                                </ul>

                                            </div>

                                        `
                                        : ""
                                }


                                ${
                                    tradeoffs.length
                                        ? `

                                            <div
                                                class="tradeoffs"
                                            >

                                                <h4>
                                                    ⚠️ Trade-offs
                                                </h4>

                                                <ul>

                                                    ${tradeoffs
                                                        .map(
                                                            item =>
                                                                `
                                                                <li>
                                                                    ${escapeHtml(
                                                                        item
                                                                    )}
                                                                </li>
                                                                `
                                                        )
                                                        .join("")
                                                    }

                                                </ul>

                                            </div>

                                        `
                                        : ""
                                }

                            </div>

                        </article>

                    `;

                }
            )
            .join("")
        }


        <div
            class="price-disclaimer"
        >

            ⚠️ Prices and availability
            can change.

        </div>

    `;
}


// ==============================
// MAIN OPITECH AI FUNCTION
// ==============================

async function testOPITECHAI() {

    const button =
        document.querySelector(
            '#finderForm button[type="submit"]'
        );

    const container =
        document.getElementById(
            "result"
        );


    if (button) {

        button.disabled = true;

        button.textContent =
            "⏳ Checking...";
    }


    if (container) {

        container.classList.remove(
            "hidden"
        );

        container.innerHTML = `

            <div class="loading">

                <h3>
                    🔎 OPITECH is searching...
                </h3>

                <p>
                    Finding recommendations
                    based on your requirements.
                </p>

                <p>
                    This may take a few seconds.
                </p>

            </div>

        `;
    }


    const uses =
        getValue(
            "uses"
        )
        .split(",")
        .map(
            item =>
                item.trim()
        )
        .filter(Boolean);


    const payload = {

        productType:
            getValue(
                "category",
                "Phone"
            ),

        country:
            "India",

        currency:
            "INR",

        budget:
            getValue(
                "budget"
            ),

        uses:
            uses,

        priority:
            getValue(
                "priorities",
                "balanced"
            ),

        brand:
            getValue(
                "preferences",
                "any"
            )
    };


    console.log(
        "Sending OPITECH preferences:",
        payload
    );


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
                            payload
                        )

                }
            );


        const rawText =
            await response.text();


        let data;


        try {

            data =
                JSON.parse(
                    rawText
                );

        } catch {

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


        renderRecommendations(
            data
        );


    } catch (error) {

        console.error(
            "OPITECH error:",
            error
        );


        if (container) {

            container.innerHTML = `

                <div
                    class="error-message"
                >

                    <h3>
                        ❌ OPITECH couldn't get recommendations
                    </h3>

                    <p>

                        ${escapeHtml(
                            error.message ||
                            "Something went wrong."
                        )}

                    </p>

                    <p>
                        Please try again in a few seconds.
                    </p>

                </div>

            `;
        }

    } finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                "Generate My OPITECH Profile →";
        }
    }
}

window.testOPITECHAI =
    testOPITECHAI;


// ==============================
// FORM SETUP
// ==============================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const category =
            document.getElementById(
                "category"
            );


        if (category) {

            selectedType =
                category.value;

            category.addEventListener(
                "change",
                () => {

                    selectedType =
                        category.value;

                }
            );
        }


        const form =
            document.getElementById(
                "finderForm"
            );


        if (form) {

            form.addEventListener(
                "submit",
                event => {

                    event.preventDefault();

                    testOPITECHAI();
