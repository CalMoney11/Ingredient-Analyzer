// --- Configuration ---
// Switch automatically: if served from localhost assume local Flask backend.
const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
const API_URL = isLocal ? 'http://localhost:5000/api/analyze' : 'https://recipe-backend-theta.vercel.app/api/analyze';
// Recipes disabled in current mode but keep constant for potential future use.
const RECIPES_URL = isLocal ? 'http://localhost:5000/api/get_recipes' : 'https://recipe-backend-theta.vercel.app/api/get_recipes';

// --- Helper Functions ---

async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
    });
}

function displayFileName(input) {
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const imageStatus = document.getElementById('imageStatus');
    const file = input.files[0];
    
    if (file) {
        // Validate file type
        const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
        
        if (!validImageTypes.includes(file.type)) {
            imageStatus.textContent = '❌ Please select a valid image file (JPG, PNG, GIF, WebP, HEIC)';
            imageStatus.style.color = 'red';
            input.value = ''; // Clear invalid file
            clearImagePreview();
            return;
        }
        
        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            imageStatus.textContent = `❌ File too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Max size: 10MB`;
            imageStatus.style.color = 'red';
            input.value = '';
            clearImagePreview();
            return;
        }
        
        fileNameDisplay.textContent = file.name;
        imageStatus.textContent = `✅ File selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
        imageStatus.style.color = 'var(--text-color)';
        
        // Hide the file input wrapper once image is selected
        const wrapper = document.querySelector('.file-input-wrapper');
        wrapper.style.display = 'none';
        
        // Add image preview
        const reader = new FileReader();
        reader.onload = function(e) {
            // Remove existing preview if any
            const existingPreview = document.getElementById('imagePreview');
            if (existingPreview) existingPreview.remove();
            
            // Create preview element - now the main focus
            const previewDiv = document.createElement('div');
            previewDiv.id = 'imagePreview';
            previewDiv.className = 'mt-4 text-center';
            previewDiv.innerHTML = `
                <div class="preview-container">
                    <img src="${e.target.result}" alt="Uploaded Image" class="preview-image-large mx-auto rounded-lg shadow-lg">
                    <div class="preview-actions">
                        <button onclick="clearImage()" class="change-image-btn">
                            📷 Change Image
                        </button>
                        <p class="preview-filename">${file.name}</p>
                    </div>
                </div>
            `;
            
            // Insert after the file input wrapper
            wrapper.parentNode.insertBefore(previewDiv, wrapper.nextSibling);
        };
        
        reader.onerror = function() {
            imageStatus.textContent = '❌ Error reading file. Please try another image.';
            imageStatus.style.color = 'red';
            const wrapper = document.querySelector('.file-input-wrapper');
            wrapper.style.display = 'block'; // Show input again on error
        };
        
        reader.readAsDataURL(file);
    } else {
        fileNameDisplay.textContent = 'Upload/Capture Photo';
        imageStatus.textContent = 'No image selected.';
        imageStatus.style.color = 'var(--text-color)';
        clearImagePreview();
        // Show the file input wrapper again
        const wrapper = document.querySelector('.file-input-wrapper');
        if (wrapper) wrapper.style.display = 'block';
    }
}

function clearImage() {
    const input = document.getElementById('imageInput');
    input.value = '';
    clearImagePreview();
    // Show the file input wrapper again
    const wrapper = document.querySelector('.file-input-wrapper');
    if (wrapper) wrapper.style.display = 'block';
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const imageStatus = document.getElementById('imageStatus');
    fileNameDisplay.textContent = 'Upload/Capture Photo';
    imageStatus.textContent = 'No image selected.';
    imageStatus.style.color = 'var(--text-color)';
}

function clearImagePreview() {
    const preview = document.getElementById('imagePreview');
    if (preview) preview.remove();
}

function simpleMarkdownToHtml(text) {
    return text
        // Headings
        .replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold mt-4 mb-2">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-6 mb-3 text-blue-800">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-extrabold mt-8 mb-4">$1</h1>')
        // Lists
        .replace(/^\* (.+)$/gm, '<li class="ml-6">$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/gs, '<ul class="list-disc my-2">$&</ul>')
        // Horizontal rules
        .replace(/^---$/gm, '<hr class="border-t-2 border-gray-200 my-6"/>')
        // Bold and italic
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Paragraphs (lines that aren't already wrapped)
        .split('\n')
        .map(line => line.trim() && !line.startsWith('<') ? `<p class="mb-2">${line}</p>` : line)
        .join('\n');
}

// Exponential backoff helper (optional, for rate limiting)
async function withExponentialBackoff(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            const delay = Math.pow(2, i) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// --- Main Function ---

async function getRecipes() {
    const prompt = document.getElementById('foodPrompt').value.trim();
    const imageInput = document.getElementById('imageInput');
    const imageFile = imageInput.files[0];
    const outputDiv = document.getElementById('recipeContent');
    const button = document.getElementById('recipeButton');
    const buttonText = document.getElementById('buttonText');

    // Validation
    if (!prompt && !imageFile) {
        outputDiv.innerHTML = '<p class="text-red-600 font-medium">⚠️ Please enter a prompt or upload an image.</p>';
        return;
    }

    // Set loading state
    button.disabled = true;
    buttonText.innerHTML = 'Analyzing<span class="loading-dot">.</span><span class="loading-dot">.</span><span class="loading-dot">.</span>';
    outputDiv.innerHTML = '<div class="text-center py-8"><p class="text-lg text-blue-600">🔍 Analyzing ingredients...</p></div>';

    // Prepare FormData for the backend
    const formData = new FormData();
    if (imageFile) {
        formData.append('image', imageFile);
    }
    if (prompt) {
        formData.append('prompt', prompt);
    }

    try {
        // Fetch from Vercel backend
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
            // Note: Don't set Content-Type header - browser will set it automatically with boundary
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success && Array.isArray(result.ingredients)) {
            const ingredientsList = result.ingredients;
            if (ingredientsList.length === 0) {
                outputDiv.innerHTML = '<p class="text-yellow-600">No ingredients detected. Try a clearer image.</p>';
                return;
            }
            const ingredientsHTML = ingredientsList.map(ing => `<li class="py-2 px-3 bg-gray-50 rounded">${ing}</li>`).join('');
            outputDiv.innerHTML = `
                <div class="space-y-4">
                    <h3 class="text-xl font-semibold text-gray-800">Detected Ingredients (${ingredientsList.length}):</h3>
                    <ul class="space-y-2">${ingredientsHTML}</ul>
                    <button id="genRecipesButton" class="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">Generate AI Recipes</button>
                    <p class="text-xs text-gray-400">Image analyzed by Gemini. Click to generate 5 recipe ideas.</p>
                </div>
            `;

            // Attach handler for generating recipes
            const genBtn = document.getElementById('genRecipesButton');
            if (genBtn) {
                genBtn.onclick = () => generateAiRecipes();
            }
        } else {
            throw new Error(result.error || 'Backend returned invalid format');
        }

    } catch (error) {
        console.error('Analysis error:', error);
        outputDiv.innerHTML = `
            <div class="text-red-600 p-4 bg-red-50 rounded-lg">
                <p class="font-medium mb-2">❌ Error: ${error.message}</p>
                <p class="text-sm">Troubleshooting tips:</p>
                <ul class="text-sm list-disc ml-4 mt-1">
                    <li>Make sure your Vercel backend is deployed</li>
                    <li>Check that API_URL points to the correct endpoint</li>
                    <li>Verify CORS is configured correctly in your backend</li>
                    <li>Check browser console for detailed error messages</li>
                </ul>
            </div>
        `;
    } finally {
        // Reset button
        button.disabled = false;
        buttonText.textContent = 'Analyze Image / Prompt';
    }
}

// Optional: Test API connection on page load
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const healthUrl = API_URL.replace('/analyze', '/health');
        const response = await fetch(healthUrl);
        if (response.ok) {
            console.log('✅ Backend API is reachable');
        }
    } catch (error) {
        console.warn('⚠️ Could not reach backend API:', error.message);
    }
});

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

// ===============================
// Dark / Light Mode Toggle
// ===============================
document.addEventListener("DOMContentLoaded", () => {
    const root = document.documentElement;
    const toggleBtn = document.getElementById("theme-toggle");
    const themeIcon = document.getElementById("theme-icon"); // <img>
    const themeLabel = document.getElementById("theme-label");
  
    // Safety check in case elements are missing
    if (!toggleBtn || !themeIcon || !themeLabel) return;
  
    // Read theme from localStorage or system preference
    const userStoredTheme = localStorage.getItem("theme");
    const systemPrefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
  
    let currentTheme = userStoredTheme || (systemPrefersDark ? "dark" : "light");
  
    function applyTheme(theme) {
      root.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);
      currentTheme = theme;
  
      if (theme === "dark") {
        // User is currently in DARK mode, so show sun to indicate switch to light
        themeIcon.src = "images/sun.png"; // <-- update path if needed
        themeIcon.alt = "Switch to light mode";
        themeLabel.textContent = "Light mode";
      } else {
        // User is currently in LIGHT mode, so show moon to indicate switch to dark
        themeIcon.src = "images/moon.png"; // <-- update path if needed
        themeIcon.alt = "Switch to dark mode";
        themeLabel.textContent = "Dark mode";
      }
    }
  
    // Apply theme on load
    applyTheme(currentTheme);
  
    // Toggle theme on button click
    toggleBtn.addEventListener("click", () => {
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(newTheme);
    });
  });

// --- AI Recipe Generation ---
async function generateAiRecipes() {
    const outputDiv = document.getElementById('recipeContent');
    outputDiv.insertAdjacentHTML('beforeend', '<p id="recipeLoading" class="text-blue-600 mt-2">Generating recipes...</p>');
    try {
        const resp = await fetch(`${API_URL.replace('/analyze','')}/generate_recipes`, { method: 'POST' });
        if (!resp.ok) {
            const errData = await resp.json().catch(()=>({}));
            const msg = errData.error || `HTTP ${resp.status}`;
            const type = errData.error_type || 'unknown';
            throw new Error(`${msg} (${type})`);
        }
        const data = await resp.json();
        if (!data.success || !Array.isArray(data.recipes)) {
            throw new Error(data.error || 'Bad recipe response');
        }
        const recipesHTML = data.recipes.map(r => {
            const ing = (r.ingredients||[]).map(i=>`<li class='text-sm'>${i}</li>`).join('');
            const steps = (r.steps||[]).map(s=>`<li class='text-sm'>${s}</li>`).join('');
            return `
                <div class='border border-gray-200 rounded-lg p-4 bg-white shadow-sm'>
                    <h4 class='text-lg font-semibold text-green-700 mb-2'>${r.name}</h4>
                    <h5 class='font-medium text-gray-700'>Ingredients:</h5>
                    <ul class='list-disc ml-5 mb-3 space-y-1'>${ing}</ul>
                    <h5 class='font-medium text-gray-700'>Steps:</h5>
                    <ol class='list-decimal ml-5 space-y-1'>${steps}</ol>
                </div>
            `;
        }).join('');
        const existing = document.getElementById('aiRecipesBlock');
        if (existing) existing.remove();
        outputDiv.insertAdjacentHTML('beforeend', `
            <div id='aiRecipesBlock' class='mt-6 space-y-4'>
                <h3 class='text-xl font-semibold text-gray-800'>AI Generated Recipes (${data.recipes.length}):</h3>
                ${recipesHTML}
            </div>
        `);
    } catch (err) {
        outputDiv.insertAdjacentHTML('beforeend', `<p class='text-red-600 mt-2'>Recipe generation error: ${err.message}</p>`);
    } finally {
        const loadEl = document.getElementById('recipeLoading');
        if (loadEl) loadEl.remove();
    }
}
