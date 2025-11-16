// --- API & Utility Functions ---

/**
 * Converts a File object (image) to a Base64 string for API transmission.
 * @param {File} file - The image file object.
 * @returns {Promise<string>} - Base64 encoded string.
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]); // Only data part
        reader.onerror = error => reject(error);
    });
}

/**
 * Simple exponential backoff for API retries.
 * @param {function} fn - The function to execute.
 * @param {number} maxRetries - Maximum number of retries.
 * @returns {Promise<any>}
 */
async function withExponentialBackoff(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}


// --- UI Logic ---

/**
 * Displays the name of the selected file or a status message.
 */
function displayFileName(input) {
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const file = input.files[0];
    if (file) {
        fileNameDisplay.textContent = file.name;
        document.getElementById('imageStatus').textContent = `File selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB). This will be sent to the AI.`;
    } else {
        fileNameDisplay.textContent = 'Upload/Capture Photo';
        document.getElementById('imageStatus').textContent = 'No image selected.';
    }
}

/**
 * Main function to trigger recipe generation via the Flask backend.
 */
async function getRecipes() {
    const prompt = document.getElementById('foodPrompt').value.trim();
    const imageInput = document.getElementById('imageInput');
    const imageFile = imageInput.files[0];
    const outputDiv = document.getElementById('recipeContent');
    const button = document.getElementById('recipeButton');
    const buttonText = document.getElementById('buttonText');

    if (!prompt && !imageFile) {
        outputDiv.innerHTML = '<p class="text-red-600 font-medium">Please enter a food prompt or upload an image of ingredients first.</p>';
        return;
    }

    // 1. Set Loading State
    button.disabled = true;
    buttonText.innerHTML = 'Analyzing <span class="loading-dot"></span><span class="loading-dot"></span><span class="loading-dot"></span>';
    outputDiv.innerHTML = '<div class="text-center py-8 text-blue-600"><p class="text-lg font-medium">Analyzing ingredients with AI...</p></div>';

    // 2. Prepare FormData for the Flask backend
    const formData = new FormData();
    if (imageFile) {
        formData.append('image', imageFile);
    }
    if (prompt) {
        formData.append('prompt', prompt);
    }

    // 3. Determine the API endpoint (local for dev, deployed URL for production)
    // For LOCAL TESTING: use http://localhost:5000/analyze
    // For PRODUCTION: change to your deployed URL (e.g., https://your-app.onrender.com/analyze)
    const apiUrl = 'http://localhost:5000/analyze';

    try {
        // --- Fetch from Flask Backend ---
        const response = await withExponentialBackoff(() =>
            fetch(apiUrl, {
                method: 'POST',
                body: formData
            })
        );

        if (!response.ok) {
            throw new Error(`Backend call failed: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success && result.ingredients) {
            const ingredientsList = result.ingredients;
            
            if (ingredientsList.length === 0) {
                outputDiv.innerHTML = '<p class="text-yellow-600">No ingredients detected. Try a different image or prompt.</p>';
                return;
            }
            
            // Show detected ingredients
            const ingredientsHTML = ingredientsList.map(ingredient => 
                `<li class="py-2 px-3 bg-gray-50 rounded">${ingredient}</li>`
            ).join('');
            
            outputDiv.innerHTML = `
                <div class="space-y-4">
                    <h3 class="text-xl font-semibold text-gray-800">Detected Ingredients (${ingredientsList.length}):</h3>
                    <ul class="space-y-2">
                        ${ingredientsHTML}
                    </ul>
                    <p class="text-blue-600 font-medium">Finding recipes...</p>
                </div>
            `;
            
            // Now get recipes using those ingredients
            buttonText.innerHTML = 'Finding Recipes <span class="loading-dot"></span><span class="loading-dot"></span><span class="loading-dot"></span>';
            
            const recipesUrl = 'http://localhost:5000/get_recipes';
            const recipesResponse = await withExponentialBackoff(() =>
                fetch(recipesUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                })
            );
            
            if (!recipesResponse.ok) {
                throw new Error(`Recipe fetch failed: ${recipesResponse.statusText}`);
            }
            
            const recipesResult = await recipesResponse.json();
            
            if (recipesResult.success && recipesResult.recipes) {
                const recipes = recipesResult.recipes;
                
                if (recipes.length === 0) {
                    outputDiv.innerHTML = `
                        <div class="space-y-4">
                            <h3 class="text-xl font-semibold text-gray-800">Detected Ingredients (${ingredientsList.length}):</h3>
                            <ul class="space-y-2">
                                ${ingredientsHTML}
                            </ul>
                            <p class="text-yellow-600 font-medium mt-4">No recipes found matching your ingredients. Try adding more common ingredients!</p>
                        </div>
                    `;
                } else {
                    // Display recipes
                    const recipesHTML = recipes.map((recipe, idx) => {
                        const recipeIngredients = recipe.ingredients || [];
                        const ingredientsListHTML = recipeIngredients.slice(0, 8).map(ing => 
                            `<li class="text-sm text-gray-600">• ${ing}</li>`
                        ).join('');
                        const moreCount = recipeIngredients.length > 8 ? recipeIngredients.length - 8 : 0;
                        
                        return `
                            <div class="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                                <h4 class="text-lg font-semibold text-blue-700 mb-2">${idx + 1}. ${recipe.title}</h4>
                                <ul class="space-y-1">
                                    ${ingredientsListHTML}
                                    ${moreCount > 0 ? `<li class="text-sm text-gray-500 italic">+ ${moreCount} more ingredients</li>` : ''}
                                </ul>
                            </div>
                        `;
                    }).join('');
                    
                    outputDiv.innerHTML = `
                        <div class="space-y-4">
                            <h3 class="text-xl font-semibold text-gray-800">Your Ingredients (${ingredientsList.length}):</h3>
                            <ul class="space-y-2 mb-4">
                                ${ingredientsHTML}
                            </ul>
                            <h3 class="text-xl font-semibold text-green-700">Top 5 Recipes (from ${recipesResult.total_found} matches):</h3>
                            <div class="space-y-3">
                                ${recipesHTML}
                            </div>
                        </div>
                    `;
                }
            } else {
                throw new Error(recipesResult.error || 'Failed to get recipes');
            }
        } else {
            throw new Error(result.error || 'Unknown error from backend');
        }

    } catch (error) {
        console.error("Analysis failed:", error);
        outputDiv.innerHTML = `<p class="text-red-600 font-medium">Sorry, an error occurred: ${error.message}. Please try again.</p>`;
    } finally {
        // 5. Reset Loading State
        button.disabled = false;
        buttonText.textContent = 'Get Recipes';
    }
}

/**
 * Generates mock recipes for the static HTML demonstration/fallback.
 */
function generateMockRecipes(prompt) {
    const baseIngredients = prompt || "Ingredients from the photo (e.g., chicken, rice, broccoli)";
    return `
## Recipe 1: Quick Stir-Fry with Pantry Staples

### Ingredients
* ${baseIngredients.split(',')[0].trim() || 'Protein (Chicken/Tofu)'}
* 1 cup Cooked Rice
* 1 head of Broccoli florets
* 1/4 cup Soy Sauce
* 2 cloves garlic, minced

### Instructions
1.  Cook the protein in a wok or large pan.
2.  Add broccoli and cook until slightly tender.
3.  Stir in garlic, soy sauce, and the cooked rice.
4.  Toss everything together until heated through.

---

## Recipe 2: Speedy Tomato Pasta

### Ingredients
* 8 oz dry Pasta (Spaghetti/Penne)
* 1 can (14.5 oz) Diced Tomatoes
* 1/4 cup Olive Oil
* 1 teaspoon Italian Herbs
* Salt and pepper

### Instructions
1.  Boil pasta until al dente. Save some pasta water.
2.  In a saucepan, heat olive oil and add tomatoes and herbs. Simmer for 10 minutes.
3.  Combine drained pasta with the sauce, adding a splash of pasta water for consistency.

---

## Recipe 3: Roasted Veggie Mix

### Ingredients
* 2 large Potatoes, chopped
* 1 Zucchini, diced
* 1 Bell Pepper, sliced
* 2 tablespoons Olive Oil
* 1 teaspoon Paprika

### Instructions
1.  Preheat oven to 400°F (200°C).
2.  Toss all vegetables on a baking sheet with olive oil, paprika, salt, and pepper.
3.  Roast for 25-30 minutes, turning halfway, until crispy and tender.
`;
}

/**
 * Converts basic markdown (headings, lists) to HTML.
 * Note: A full markdown parser is complex, this is simplified for the demo.
 */
function markdownToHtml(markdown) {
    // Convert headings
    let html = markdown.replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-6 mb-3 text-blue-800">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-extrabold mt-8 mb-4 text-gray-900">$1</h1>');
    
    // Convert lists
    html = html.replace(/^\* (.*$)/gim, '<li class="list-disc ml-6">$1</li>');
    // Wrap list items in <ul> tags
    html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
    // Clean up ul tags that might have nested or adjacent lists (simple cleanup)
    html = html.replace(/<\/ul>\n*<ul>/g, ''); 
    
    // Convert horizontal rules
    html = html.replace(/^---/gim, '<hr class="border-t-2 border-gray-200 my-8"/>');
    
    // Convert bold and italics
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convert newlines to paragraphs (basic block handling)
    html = html.trim().split('\n').map(line => {
        // If line contains block-level element (h, ul, hr), return as is
        if (line.match(/<\/?(h[1-3]|ul|hr|div|p)>/i)) {
            return line;
        }
        // Otherwise, wrap in a paragraph tag if it's not empty
        return line.trim() ? `<p>${line.trim()}</p>` : '';
    }).join('\n');

    return html;
}

/**
 * Displays the source citations if grounding was used.
 */
function displaySources(sources) {
    const outputDiv = document.getElementById('recipesOutput');
    const sourceHtml = sources.map(source => `
        <a href="${source.uri}" target="_blank" rel="noopener noreferrer" class="text-xs text-blue-500 hover:text-blue-700 underline block">
            ${source.title}
        </a>
    `).join('');

    outputDiv.insertAdjacentHTML('beforeend', `
        <div class="mt-6 pt-4 border-t border-gray-200">
            <p class="text-sm font-semibold text-gray-700 mb-2">Sources Referenced:</p>
            ${sourceHtml}
        </div>
    `);
}