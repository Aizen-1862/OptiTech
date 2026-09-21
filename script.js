const BACKEND_URL = "https://opitech-backend.onrender.com";

async function testOPITECHAI() {
    const resultsContainer = document.getElementById("resultsContainer");

    resultsContainer.innerHTML = `
        <div class="result-card">
            <h2>🤖 OPITECH AI is thinking...</h2>
            <p>Analyzing your preferences...</p>
        </div>
    `;

    const preferences = {
        productType: selectedType || "Phone",
        budget: document.getElementById("budget")?.value || "",
        uses: getSelectedUses(),
        priority: document.getElementById("priority")?.value || "",
        brand: document.getElementById("brand")?.value || ""
    };

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
        console.error(error);

        resultsContainer.innerHTML = `
            <div class="result-card">
                <h2>❌ AI connection failed</h2>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function formatAIResponse(text) {
    return text
        .replace(/\n/g, "<br>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}
