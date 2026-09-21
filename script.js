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

const currencySelect = document.getElementById("currency");
const currencySymbol = document.getElementById("currencySymbol");

currencySelect.addEventListener("change", () => {
    currencySymbol.textContent =
        currencySymbols[currencySelect.value] || "";
});

// Product type selection
document.querySelectorAll(".option").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".option").forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        selectedType = button.dataset.type;
    });
});

// Get selected uses
function getSelectedUses() {
    const checkboxes = document.querySelectorAll(
        '.checkbox-grid input[type="checkbox"]:checked'
    );

    return Array.from(checkboxes).map(checkbox => checkbox.value);
}

// Main OPITECH AI function
async function testOPITECHAI() {
    const resultsContainer =
        document.getElementById("resultsContainer");

    resultsContainer.innerHTML = `
        <div class="result-card">
            <h2>🤖 OPITECH AI is thinking...</h2>
            <p>Analyzing your preferences...</p>
        </div>
    `;

    const preferences = {
    productType: selectedType,

    country: document.getElementById("country")?.value || "India",

    currency: document.getElementById("currency")?.value || "INR",

    budget: document.getElementById("budget")?.value || "",

    uses: getSelectedUses(),

    priority: document.getElementById("priority")?.value || "balanced",

    brand: document.getElementById("brand")?.value || "any"
};
    console.log("Sending preferences:", preferences);

    try {
        const response = await fetch(`${BACKEND_URL}/api/recommend`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                preferences: preferences
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "AI request failed");
        }

        resultsContainer.innerHTML = `
            <div class="result-card">
                <h2>🤖 OPITECH AI</h2>
                <div class="ai-result">
                    ${formatAIResponse(data.result)}
                </div>
            </div>
        `;

    } catch (error) {
        console.error("OPITECH AI Error:", error);

        resultsContainer.innerHTML = `
            <div class="result-card">
                <h2>❌ AI connection failed</h2>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Format AI response
function formatAIResponse(text) {
    if (!text) {
        return "No recommendation was returned.";
    }

    return text
        .replace(/\n/g, "<br>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}
