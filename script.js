// ======================================================
// ===================== CONFIG =========================
// ======================================================

// PRODUCTION backend
const BASE_CLOUD_RUN_URL = "https://ai-recipe-analyzer-backend-916947363444.us-central1.run.app";

const API_URL = `${BASE_CLOUD_RUN_URL}/analyze`;
const RECIPES_URL = `${BASE_CLOUD_RUN_URL}/get_recipes`;

// LOCAL TESTING
// const API_URL = "http://localhost:5000/analyze";


// ======================================================
// ==================== HELPERS =========================
// ======================================================

async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
    });
}

function displayFileName(input) {
    const fileNameDisplay = document.getElementById("fileNameDisplay");
    const imageStatus = document.getElementById("imageStatus");
    const file = input.files[0];

    if (file) {
        fileNameDisplay.textContent = file.name;
        imageStatus.textContent = `File selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
    } else {
        fileNameDisplay.textContent = "Upload/Capture Photo";
        imageStatus.textContent = "No image selected.";
    }
}

async function withExponentialBackoff(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
        }
    }
}


// ======================================================
// ================= MAIN RECIPE LOGIC ==================
// ======================================================

async function getRecipes() {
    const prompt = document.getElementById("foodPrompt").value.trim();
    const imageInput = document.getElementById("imageInput");
    const imageFile = imageInput.files[0];
    const outputDiv = document.getElementById("recipeContent");
    const button = document.getElementById("recipeButton");
    const buttonText = document.getElementById("buttonText");

    // Validation
    if (!prompt && !imageFile) {
        outputDiv.innerHTML = `<p class="text-red-600 font-medium">Please enter a prompt or upload an image.</p>`;
        return;
    }

    // Loading UI state
    button.disabled = true;
    buttonText.innerHTML = `Analyzing & Generating<span class="loading-dot">.</span><span class="loading-dot">.</span><span class="loading-dot">.</span>`;
    outputDiv.innerHTML = `<div class="text-center py-8"><p class="text-lg text-blue-600">Analyzing ingredients and generating recipes...</p></div>`;

    // Build form data
    const formData = new FormData();
    if (imageFile) formData.append("image", imageFile);
    if (prompt) formData.append("prompt", prompt);

    try {
        // -------- STEP 1: Ingredient Analysis ----------
        const response = await fetch(API_URL, { method: "POST", body: formData });
        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const result = await response.json();
        if (!result.success || !result.ingredients) {
            throw new Error(result.error || "Ingredient detection failed.");
        }

        const ingredientsList = result.ingredients;

        if (ingredientsList.length === 0) {
            outputDiv.innerHTML = `<p class="text-yellow-600 font-medium">No ingredients detected.</p>`;
            return;
        }

        // -------- STEP 2: Fetch Recipes ----------
        // 👇 MODIFY THIS SECTION (starts around line 88)
        buttonText.innerHTML = `Finding Recipes<span class="loading-dot">.</span><span class="loading-dot">.</span><span class="loading-dot">.</span>`;

        const recipesResponse = await withExponentialBackoff(() =>
            fetch(RECIPES_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ingredients: ingredientsList })  // ✅ CHANGE THIS LINE
            })
        );

        if (!recipesResponse.ok) throw new Error("Failed to fetch recipes.");

        const recipesResult = await recipesResponse.json();
        if (!recipesResult.success) {
            throw new Error(recipesResult.error || "Recipe generation failed.");
        }

        const recipes = recipesResult.recipes;

        // Build fallback ingredients list
        const ingredientsHTML = ingredientsList
            .map(ing => `<li class="py-2 px-3 bg-gray-50 rounded">${ing}</li>`)
            .join("");

        // -------- NO RECIPES FOUND ----------
        if (recipes.length === 0) {
            outputDiv.innerHTML = `
                <div class="space-y-4">
                    <h3 class="text-xl font-semibold">Ingredients Detected (${ingredientsList.length}):</h3>
                    <ul class="space-y-2">${ingredientsHTML}</ul>
                    <p class="text-yellow-600 font-medium mt-4">No recipes found. Try adding more common ingredients.</p>
                </div>
            `;
            return;
        }

        // -------- BUILD RECIPE HTML ----------
        const recipesHTML = recipes
            .map((recipe, index) => {
                const ingredients = recipe.ingredients || [];
                const instructions = recipe.instructions || [];

                return `
                    <div class="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                        <h4 class="text-lg font-semibold text-blue-700 mb-3">${index + 1}. ${recipe.title}</h4>

                        <h5 class="font-medium text-gray-800 mb-1">Ingredients:</h5>
                        <ul class="space-y-1 mb-3">
                            ${ingredients.map(i => `<li class="text-sm text-gray-600">• ${i}</li>`).join("")}
                        </ul>

                        <h5 class="font-medium text-gray-800 mb-1">Instructions:</h5>
                        <ol class="space-y-2 pl-4 list-decimal">
                            ${instructions.map((step, i) => `<li class="text-sm">${i + 1}. ${step}</li>`).join("")}
                        </ol>
                    </div>
                `;
            })
            .join("");

        // -------- FINAL RECIPE OUTPUT ----------
        outputDiv.innerHTML = `
            <div class="space-y-4">
                <h3 class="text-xl font-semibold text-green-700">Top Recipes Generated by AI:</h3>
                <div class="space-y-3">${recipesHTML}</div>
            </div>
        `;

    } catch (error) {
        outputDiv.innerHTML = `
            <div class="text-red-600 p-4 bg-red-50 rounded">
                <p class="font-medium">Error: ${error.message}</p>
            </div>
        `;
    } finally {
        button.disabled = false;
        buttonText.textContent = "Get Recipes";
    }
}


// ======================================================
// ==================== THEME TOGGLE ====================
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
    const root = document.documentElement;
    const toggleBtn = document.getElementById("theme-toggle");
    const themeIcon = document.getElementById("theme-icon");
    const themeLabel = document.getElementById("theme-label");

    if (!toggleBtn || !themeIcon || !themeLabel) return;

    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    let currentTheme = stored || (prefersDark ? "dark" : "light");

    function applyTheme(t) {
        root.setAttribute("data-theme", t);
        localStorage.setItem("theme", t);
        currentTheme = t;

        if (t === "dark") {
            themeIcon.src = "images/sun.png";
            themeLabel.textContent = "Light mode";
        } else {
            themeIcon.src = "images/moon.png";
            themeLabel.textContent = "Dark mode";
        }
    }

    applyTheme(currentTheme);

    toggleBtn.addEventListener("click", () => {
        applyTheme(currentTheme === "dark" ? "light" : "dark");
    });
});
