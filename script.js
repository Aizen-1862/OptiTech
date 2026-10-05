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


// =====================================================
// INITIALIZE
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    const currency = document.getElementById("currency");
    const symbol = document.getElementById("currencySymbol");
    const findButton = document.getElementById("findButton");

    // Currency symbol
    if (currency && symbol) {

        symbol.textContent =
            currencySymbols[currency.value] || "₹";

        currency.addEventListener("change", () => {

            symbol.textContent =
                currencySymbols[currency.value] ||
                currency.value;

        });
    }


    // Product type buttons
    document.querySelectorAll(".option").forEach(button => {

        button.type = "button";

        button.addEventListener("click", () => {

            document
                .querySelectorAll(".option")
                .forEach(option => {
                    option.classList.remove("active");
                });

            button.classList.add("active");

            selectedType =
                button.dataset.type || "Phone";

        });

    });


    // Find button
    if (findButton) {

        findButton.type = "button";

        findButton.addEventListener(
            "click",
            testOPITECHAI
        );

    }

});


// =====================================================
// GET VALUE
// =====================================================

function getValue(id, fallback = "") {

    const element =
        document.getElementById(id);

    if (!element) {
        return fallback;
    }

    return element.value || fallback;
}


// =====================================================
// GET SELECTED USES
// =====================================================

function getSelectedUses() {

    return Array.from(
        document.querySelectorAll(
            '.checkbox-grid input[type="checkbox"]:checked'
        )
    )
    .map(input => input.value)
    .filter(Boolean);

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// =====================================================
// FORMAT PRICE
// =====================================================

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

    const symbol =
        currencySymbols[currency] ||
        currency ||
        "₹";

    return (
        symbol +
        number.toLocaleString("en-IN")
    );

}


// =====================================================
// CREATE MATCH SCORE
// =====================================================

function renderMatchScore(score) {

    if (
        score === null ||
        score === undefined ||
        score === ""
    ) {
        return "";
    }

    let number = Number(score);

    if (!Number.isFinite(number)) {
        return "";
    }

    number =
        Math.max(
            0,
            Math.min(100, Math.round(number))
        );

    return `

        <div class="match-score">

            <span>
                Match
            </span>

            <strong>
                ${number}%
            </strong>

        </div>

    `;

}


// =====================================================
// CREATE LIST
// =====================================================

function renderList(items, type) {

    if (!Array.isArray(items) || !items.length) {
        return "";
    }

    return `

        <div class="${type}">

            <h4>
                ${
                   
