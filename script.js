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
    // Change this to your deployed URL when going to production (e.g., https://your-app.onrender.com/analyze)
    const apiUrl = 'https://calmoney11.github.io/Ingredient-Analyzer/';

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

        if (result.success && result.data) {
            // Extract the analysis from the backend response
            let responseText = "";
            
            // Check what data the analyzer returned
            if (result.data.prompt_analysis && result.data.prompt_analysis.analysis) {
                responseText = result.data.prompt_analysis.analysis;
            } else if (result.data.image_analysis && result.data.image_analysis.analysis) {
                responseText = result.data.image_analysis.analysis;
            } else {
                // Fallback: show all returned data as formatted text
                responseText = `<pre>${JSON.stringify(result.data, null, 2)}</pre>`;
            }

            // 4. Display Results
            outputDiv.innerHTML = `
                <div class="prose max-w-none">
                    ${markdownToHtml(responseText)}
                </div>
            `;
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