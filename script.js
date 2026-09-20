/*
OPITECH V1
Simple recommendation engine
Runs entirely in the browser.
*/

// --------------------------------------------------
// PRODUCT DATABASE
// --------------------------------------------------

const products = [

// PHONES
{
    name: "Samsung Galaxy S24 FE",
    type: "phone",
    price: 39999,
    brand: "samsung",
    features: [
        "gaming",
        "camera",
        "performance",
        "display"
    ],
    score: {
        gaming: 86,
        camera: 88,
        performance: 87,
        battery: 82,
        display: 90,
        editing: 84,
        programming: 65,
        portability: 90,
        value: 82
    }
},

{
    name: "OnePlus 13R",
    type: "phone",
    price: 42999,
    brand: "oneplus",
    features: [
        "gaming",
        "performance",
        "battery",
        "display"
    ],
    score: {
        gaming: 94,
        camera: 82,
        performance: 95,
        battery: 94,
        display: 92,
        editing: 86,
        programming: 65,
        portability: 88,
        value: 90
    }
},

{
    name: "Xiaomi 14 CIVI",
    type: "phone",
    price: 39999,
    brand: "xiaomi",
    features: [
        "camera",
        "performance",
        "display",
        "battery"
    ],
    score: {
        gaming: 84,
        camera: 91,
        performance: 88,
        battery: 82,
        display: 90,
        editing: 84,
        programming: 60,
        portability: 89,
        value: 87
    }
},

{
    name: "realme GT 6",
    type: "phone",
    price: 39999,
    brand: "realme",
    features: [
        "gaming",
        "performance",
        "battery",
        "display"
    ],
    score: {
        gaming: 93,
        camera: 79,
        performance: 94,
        battery: 92,
        display: 94,
        editing: 84,
        programming: 60,
        portability: 87,
        value: 92
    }
},

{
    name: "iPhone 15",
    type: "phone",
    price: 49999,
    brand: "apple",
    features: [
        "camera",
        "performance",
        "editing",
        "portability"
    ],
    score: {
        gaming: 89,
        camera: 94,
        performance: 92,
        battery: 80,
        display: 85,
        editing: 94,
        programming: 65,
        portability: 94,
        value: 78
    }
},


// LAPTOPS
{
    name: "ASUS Vivobook 16",
    type: "laptop",
    price: 54990,
    brand: "asus",
    features: [
        "programming",
        "editing",
        "display",
        "portability"
    ],
    score: {
        gaming: 72,
        camera: 65,
        performance: 82,
        battery: 80,
        display: 85,
        editing: 82,
        programming: 91,
        portability: 82,
        value: 88
    }
},

{
    name: "Lenovo LOQ",
    type: "laptop",
    price: 64990,
    brand: "lenovo",
    features: [
        "gaming",
        "editing",
        "performance",
        "programming"
    ],
    score: {
        gaming: 95,
        camera: 65,
        performance: 94,
        battery: 70,
        display: 88,
        editing: 91,
        programming: 93,
        portability: 68,
        value: 94
    }
},

{
    name: "Acer Aspire 7",
    type: "laptop",
    price: 49990,
    brand: "acer",
    features: [
        "gaming",
        "programming",
        "editing"
    ],
    score: {
        gaming: 84,
        camera: 60,
        performance: 86,
        battery: 72,
        display: 76,
        editing: 82,
        programming: 88,
        portability: 72,
        value: 91
    }
},

{
    name: "HP Victus",
    type: "laptop",
    price: 62990,
    brand: "hp",
    features: [
        "gaming",
        "editing",
        "performance",
        "programming"
    ],
    score: {
        gaming: 91,
        camera: 62,
        performance: 91,
        battery: 70,
        display: 84,
        editing: 89,
        programming: 90,
        portability: 68,
        value: 89
    }
},


// GAMING PCS
{
    name: "OPITECH Starter Gaming PC",
    type: "pc",
    price: 45000,
    brand: "custom",
    features: [
        "gaming",
        "editing",
        "performance"
    ],
    score: {
        gaming: 86,
        camera: 0,
        performance: 87,
        battery: 0,
        display: 60,
        editing: 85,
        programming: 90,
        portability: 20,
        value: 91
    }
},

{
    name: "OPITECH Performance Gaming PC",
    type: "pc",
    price: 65000,
    brand: "custom",
    features: [
        "gaming",
        "editing",
        "performance",
        "programming"
    ],
    score: {
        gaming: 95,
        camera: 0,
        performance: 96,
        battery: 0,
        display: 70,
        editing: 94,
        programming: 95,
        portability: 15,
        value: 92
    }
},


// AUDIO
{
    name: "OnePlus Buds Pro",
    type: "audio",
    price: 7999,
    brand: "oneplus",
    features: [
        "battery",
        "display"
    ],
    score: {
        gaming: 82,
        camera: 0,
        performance: 80,
        battery: 90,
        display: 0,
        editing: 75,
        programming: 50,
        portability: 96,
        value: 88
    }
},

{
    name: "Samsung Galaxy Buds",
    type: "audio",
    price: 9999,
    brand: "samsung",
    features: [
        "battery",
        "portability"
    ],
    score: {
        gaming: 84,
        camera: 0,
        performance: 82,
        battery: 88,
        display: 0,
        editing: 80,
        programming: 50,
        portability: 95,
        value: 82
    }
},


// TV
{
    name: "Samsung Crystal 4K TV",
    type: "tv",
    price: 32999,
    brand: "samsung",
    features: [
        "display",
        "gaming"
    ],
    score: {
        gaming: 82,
        camera: 0,
        performance: 75,
        battery: 0,
        display: 92,
        editing: 0,
        programming: 0,
        portability: 20,
        value: 89
    }
},


// ACCESSORIES
{
    name: "ASUS Gaming Keyboard",
    type: "accessories",
    price: 3999,
    brand: "asus",
    features: [
        "gaming",
        "performance"
    ],
    score: {
        gaming: 90,
        camera: 0,
        performance: 88,
        battery: 0,
        display: 0,
        editing: 60,
        programming: 85,
        portability: 70,
        value: 90
    }
}

];

// --------------------------------------------------
// SELECT PRODUCT TYPE
// --------------------------------------------------

let selectedType = "phone";

const optionButtons = document.querySelectorAll(".option");

optionButtons.forEach(button => {

button.addEventListener("click", () => {

    optionButtons.forEach(btn => {
        btn.classList.remove("active");
    });

    button.classList.add("active");

    selectedType = button.dataset.type;

});

});

// --------------------------------------------------
// GET USER PREFERENCES
// --------------------------------------------------

function getSelectedUses() {

const checkboxes =
    document.querySelectorAll(
        '.check-option input:checked'
    );

return Array.from(checkboxes)
    .map(box => box.value);

}

// --------------------------------------------------
// CALCULATE PRODUCT MATCH
// --------------------------------------------------

function calculateMatch(product, budget, uses, priority, brand) {

let score = 0;

// Budget
if (product.price <= budget) {

    score += 25;

} else {

    const difference =
        product.price - budget;

    const penalty =
        Math.min(
            difference / budget * 25,
            25
        );

    score += 25 - penalty;
}


// Uses
if (uses.length > 0) {

    let useScore = 0;

    uses.forEach(use => {

        useScore +=
            product.score[use] || 0;

    });

    useScore =
        useScore / uses.length;

    score +=
        useScore * 0.35;
}

else {

    score += 17.5;

}


// Priority
if (priority !== "balanced") {

    score +=
        (product.score[priority] || 0)
        * 0.20;

}

else {

    score += 17;

}


// Brand preference
if (brand !== "any") {

    if (product.brand === brand) {

        score += 15;

    }

    else {

        score += 0;

    }

}

else {

    score += 7;

}


return Math.round(
    Math.min(score, 100)
);

}

// --------------------------------------------------
// FIND RECOMMENDATIONS
// --------------------------------------------------

function findRecommendations() {

const budgetInput =
    document.getElementById("budget");

const budget =
    Number(budgetInput.value);

const priority =
    document.getElementById("priority").value;

const brand =
    document.getElementById("brand").value;

const uses =
    getSelectedUses();


// Check budget
if (!budget || budget <= 0) {

    alert(
        "Please enter your budget first."
    );

    budgetInput.focus();

    return;
}


// Filter product type
let matchingProducts =
    products.filter(
        product =>
            product.type === selectedType
    );


// Calculate scores
matchingProducts =
    matchingProducts.map(product => {

        return {

            ...product,

            match:
                calculateMatch(
                    product,
                    budget,
                    uses,
                    priority,
                    brand
                )

        };

    });


// Sort highest match first
matchingProducts.sort(
    (a, b) =>
        b.match - a.match
);


displayResults(
    matchingProducts,
    budget
);

}

// --------------------------------------------------
// DISPLAY RESULTS
// --------------------------------------------------

function displayResults(productsFound, budget) {

const container =
    document.getElementById(
        "resultsContainer"
    );

const description =
    document.getElementById(
        "resultDescription"
    );


if (productsFound.length === 0) {

    container.innerHTML = `
        <div class="empty-results">
            <div class="empty-icon">😕</div>
            <h3>No matches found</h3>
            <p>
                Try another product category.
            </p>
        </div>
    `;

    return;
}


description.textContent =
    `${productsFound.length} products matched your preferences.`;


container.innerHTML = "";


productsFound
    .slice(0, 5)
    .forEach((product, index) => {

        const card =
            document.createElement("div");

        card.className =
            "product-card";


        let badge = "";

        if (index === 0) {

            badge =
                `<div class="best-badge">
                    ⭐ Best Match
                </div>`;

        }


        card.innerHTML = `

            ${badge}

            <div class="product-number">
                #${index + 1}
            </div>

            <div class="product-info">

                <h3>
                    ${product.name}
                </h3>

                <p class="product-brand">
                    ${product.brand.toUpperCase()}
                </p>

                <div class="product-price">
                    ₹${product.price.toLocaleString("en-IN")}
                </div>

                <div class="match-bar">

                    <div
                        class="match-fill"
                        style="width:${product.match}%">
                    </div>

                </div>

                <strong>
                    ${product.match}% Match
                </strong>

            </div>

            <div class="product-features">

                ${
                    product.features
                        .map(
                            feature =>
                            `<span>
                                ${formatFeature(feature)}
                            </span>`
                        )
                        .join("")
                }

            </div>

        `;


        container.appendChild(card);

    });


// Scroll to results
document
    .getElementById("results")
    .scrollIntoView({
        behavior: "smooth"
    });

}

// --------------------------------------------------
// FORMAT FEATURE NAMES
// --------------------------------------------------

function formatFeature(feature) {

const names = {

    gaming: "🎮 Gaming",

    camera: "📷 Camera",

    performance: "⚡ Performance",

    editing: "🎬 Editing",

    programming: "💻 Programming",

    battery: "🔋 Battery",

    display: "🖥️ Display",

    portability: "🎒 Portable"

};

return names[feature] || feature;

}

// --------------------------------------------------
// BUTTON
// --------------------------------------------------

document
.getElementById("findButton")
.addEventListener(
"click",
findRecommendations
);

// --------------------------------------------------
// ENTER KEY
// --------------------------------------------------

document
.getElementById("budget")
.addEventListener(
"keydown",
event => {

        if (event.key === "Enter") {

            findRecommendations();

        }

    }
);
