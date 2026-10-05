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

document.addEventListener("DOMContentLoaded", () => {

    const currency = document.getElementById("currency");
    const symbol = document.getElementById("currencySymbol");
    const findButton = document.getElementById("findButton");

    if (currency && symbol) {
        currency.addEventListener("change", () => {
            symbol.textContent =
                currencySymbols[currency.value] ||
                currency.value;
        });
    }

    document.querySelectorAll(".option").forEach(button => {

        button.type = "button";

        button.addEventListener("click", () => {

            document.querySelectorAll(".option")
                .forEach(x => x.classList.remove("active"));

            button.classList.add("active");

            selectedType =
                button.dataset.type || "Phone";
        });

    });

    if (findButton) {

        findButton.type = "button";

        findButton.addEventListener(
            "click",
            testOPITECHAI
        );

    }

});


function getValue(id, fallback = "") {

    const element =
        document.getElementById(id);

    return element
        ? element.value || fallback
        : fallback;
}


function getSelectedUses() {

    return Array.from(
        document.querySelectorAll(
            '.checkbox-grid input[type="checkbox"]:checked'
        )
    )
    .map(x => x.value)
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
        price === ""
    ) {
        return "Price unavailable";
    }

    const number = Number(price);

    if (!Number.isFinite(number)) {
        return "Price unavailable";
    }

    return (
        currencySymbols[currency] ||
        currency ||
        "₹"
    ) + number.toLocaleString("en-IN");

}


function safeUrl(url) {

    if (!url) return "";

    try {

        const parsed = new URL(url);

        if (
            parsed.protocol === "http:" ||
            parsed.protocol === "https:"
        ) {
            return parsed.href;
        }

    } catch {
        return "";
    }

    return "";
}


function marketplaceCard(
    name,
    item,
    currency
) {

    if (!item) return "";

    const price =
        formatPrice(
            item.price,
            currency
        );

    const url =
        safeUrl(item.url);

    return `
        <div class="marketplace">

            <div class="marketplace-info">

                <strong>
                    ${escapeHtml(name)}
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


function renderRecommendations(data) {

    const container =
        document.getElementById(
            "resultsContainer"
        );

    if (!container) return;

    const list =
        Array.isArray(data.recommendations)
            ? data.recommendations
            : [];

    if (!list.length) {

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

    const currency =
        getValue(
            "currency",
            "INR"
        );


    container.innerHTML = list.map(
        (product, index) => {

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
                        #${product.rank || index + 1}
                    </div>


                    ${
                        image
                            ? `
                                <div class="product-image-container">

                                    <img
                                        class="product-image"
                                        src="${escapeHtml(image)}"
                                        alt="${escapeHtml(
                                            product.name ||
                                            "Product"
                                        )}"
                                        loading="lazy"
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
                                        ${escapeHtml(
                                            product.brand
                                        )}
                                    </div>
                                `
                                : ""
                        }


                        <div class="main-price">

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

                                            ${strengths
                                                .map(
                                                    x =>
                                                        `<li>${escapeHtml(x)}</li>`
                                                )
                                                .join("")}

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

                                            ${tradeoffs
                                                .map(
                                                    x =>
                                                        `<li>${escapeHtml(x)}</li>`
                                                )
                                                .join("")}

                                        </ul>

                                    </div>
                                `
                                : ""
                        }

                    </div>

                </article>

            `;

        }
    ).join("");


    document
        .getElementById("results")
        ?.scrollIntoView({
            behavior: "smooth"
        });

}


async function testOPITECHAI() {

    const button =
        document.getElementById(
            "findButton"
        );

    const container =
        document.getElementById(
            "resultsContainer"
        );


    if (!button || !container) {

        alert(
            "OPITECH form could not be loaded. Please refresh the page."
        );

        return;
    }


    const budget =
        getValue("budget");


    if (
        !budget ||
        Number(budget) <= 0
    ) {

        alert(
            "Please enter your budget first."
        );

        return;
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


    button.disabled = true;

    button.textContent =
        "⏳ Checking Amazon & Flipkart...";


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

        </div>

    `;


    try {

        const response =
            await fetch(
                BACKEND_URL +
                "/api/recommend",
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


        const text =
            await response.text();


        let data;


        try {

            data =
                JSON.parse(text);

        } catch {

            throw new Error(
                "The backend returned an invalid response."
            );

        }


        if (!response.ok) {

            throw new Error(
                data.error ||
                data.details ||
                "Backend error " +
                response.status
            );

        }


        if (!data.success) {

            throw new Error(
                data.error ||
                "Recommendation request failed."
            );

        }


        renderRecommendations(data);


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

            </div>

        `;

    } finally {

        button.disabled = false;

        button.textContent =
            "🔍 Find My Best Matches";

    }

}


window.testOPITECHAI =
    testOPITECHAI;
