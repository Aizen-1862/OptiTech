
"use strict";

const BACKEND_URL = "https://opitech-backend.onrender.com";

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

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("recommendationForm");
  const currency = document.getElementById("currency");
  const currencySymbol = document.getElementById("currencySymbol");
  const findButton = document.getElementById("findButton");
  const statusPanel = document.getElementById("statusPanel");
  const resultsList = document.getElementById("recommendationsList");

  document.getElementById("year").textContent = new Date().getFullYear();

  function updateCurrencySymbol() {
    currencySymbol.textContent = currencySymbols[currency.value] || currency.value;
  }

  currency.addEventListener("change", updateCurrencySymbol);
  updateCurrencySymbol();

  document.querySelectorAll(".option").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".option").forEach((option) => {
        option.classList.remove("active");
        option.setAttribute("aria-pressed", "false");
      });

      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
      selectedType = button.dataset.type || "Phone";
    });
  });

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatPrice(price, currencyCode) {
    if (price === null || price === undefined || price === "") {
      return "Price unavailable";
    }

    const number = Number(price);
    if (!Number.isFinite(number) || number < 0) {
      return "Price unavailable";
    }

    const symbol = currencySymbols[currencyCode] || currencyCode || "₹";
    return symbol + number.toLocaleString("en-IN", {
      maximumFractionDigits: 2
    });
  }

  function showStatus(title, message, isError = false) {
    statusPanel.classList.toggle("error", isError);
    statusPanel.innerHTML = `
      <div class="status-icon">${isError ? "!" : "✦"}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
    `;
    statusPanel.hidden = false;
  }

  function renderList(items, className, heading) {
    if (!Array.isArray(items) || items.length === 0) {
      return "";
    }

    const safeItems = items
      .slice(0, 4)
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");

    return `
      <div class="result-list ${className}">
        <h4>${escapeHtml(heading)}</h4>
        <ul>${safeItems}</ul>
      </div>
    `;
  }

  function renderRecommendation(item, index) {
    const rank = Number(item.rank) || index + 1;
    const score = Number(item.matchScore);
    const hasScore = item.matchScore !== null &&
      item.matchScore !== undefined &&
      item.matchScore !== "" &&
      Number.isFinite(score);

    const safeScore = hasScore
      ? Math.max(0, Math.min(100, Math.round(score)))
      : null;

    const price = formatPrice(item.price, currency.value);
    const brand = item.brand
      ? `<span class="brand-tag">${escapeHtml(item.brand)}</span>`
      : "";

    const matchScore = safeScore === null
      ? ""
      : `<div class="match-score"><span>Match</span><strong>${safeScore}%</strong></div>`;

    const source = item.priceSource
      ? `<p class="price-source">Search source: ${escapeHtml(item.priceSource)}</p>`
      : "";

    const topClass = rank === 1 || index === 0 ? "top-recommendation" : "";

    return `
      <article class="recommendation-card ${topClass}">
        <div class="card-top">
          <div class="product-title">
            <span class="rank-label">RECOMMENDATION #${rank}</span>
            <h3>${escapeHtml(item.name || "Product name unavailable")}</h3>
            ${brand}
          </div>
          ${matchScore}
        </div>

        <div class="product-price">${escapeHtml(price)}</div>
        ${source}

        <div class="why-card">
          <h4>Why this match?</h4>
          <p>${escapeHtml(item.why || "Review this product's specifications against your needs before choosing.")}</p>
        </div>

        <div class="result-details">
          ${renderList(item.strengths, "strengths", "Potential strengths")}
          ${renderList(item.tradeoffs, "tradeoffs", "Things to consider")}
        </div>
      </article>
    `;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const budget = Number(document.getElementById("budget").value);

    if (!Number.isFinite(budget) || budget <= 0) {
      showStatus("Check your budget", "Enter a valid budget greater than zero.", true);
      document.getElementById("budget").focus();
      return;
    }

    const uses = Array.from(
      document.querySelectorAll('.checkbox-grid input[name="uses"]:checked')
    ).map((checkbox) => checkbox.value);

    const payload = {
      productType: selectedType,
      country: document.getElementById("country").value,
      currency: currency.value,
      budget,
      uses,
      priority: document.getElementById("priority").value,
      brand: document.getElementById("brand").value
    };

    findButton.disabled = true;
    findButton.querySelector(".button-label").textContent = "Searching marketplaces...";
    resultsList.innerHTML = "";
    showStatus("Finding your matches", "Searching available marketplace information. This may take a little while.");

    document.getElementById("results").scrollIntoView({ behavior: "smooth", block: "start" });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);

      let response;
      try {
        response = await fetch(`${BACKEND_URL}/recommendations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      const rawText = await response.text();
      let data;

      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error("The backend returned an unreadable response. Check the Render service.");
      }

      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status}).`);
      }

      const recommendations = Array.isArray(data)
        ? data
        : data.recommendations;

      if (!Array.isArray(recommendations) || recommendations.length === 0) {
        throw new Error(data.error || "No recommendations were returned. Try a different budget or category.");
      }

      resultsList.innerHTML = recommendations
        .slice(0, 3)
        .map(renderRecommendation)
        .join("");

      showStatus(
        "Your shortlist is ready",
        "Review the reasons and trade-offs. Confirm the latest price and product configuration before buying."
      );
    } catch (error) {
      let message = error.message || "Something went wrong.";

      if (error.name === "AbortError") {
        message = "The search took too long. Please try again in a moment.";
      } else if (message.includes("Failed to fetch")) {
        message = "Could not reach the backend. Check that the Render service is online and its URL is correct.";
      }

      showStatus("Couldn't get recommendations", message, true);
    } finally {
      findButton.disabled = false;
      findButton.querySelector(".button-label").textContent = "✦ Find My Best Matches";
    }
  });
});
