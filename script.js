// --- Configuration ---
const API_URL = 'YOUR_BACKEND_URL_HERE/analyze'; // Change this to your actual backend

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
        fileNameDisplay.textContent = file.name;
        imageStatus.textContent = `File selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
    } else {
        fileNameDisplay.textContent = 'Upload/Capture Photo';
        imageStatus.textContent = 'No image selected.';
    }
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

    try {
        // Prepare form data
        const formData = new FormData();
        if (imageFile) formData.append('image', imageFile);
        if (prompt) formData.append('prompt', prompt);

        // Make API call
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        // Extract analysis text
        const analysis = result.data?.prompt_analysis?.analysis 
                      || result.data?.image_analysis?.analysis
                      || 'No analysis returned';

        // Display results
        outputDiv.innerHTML = `<div class="prose max-w-none">${simpleMarkdownToHtml(analysis)}</div>`;

    } catch (error) {
        console.error('Analysis error:', error);
        outputDiv.innerHTML = `
            <div class="text-red-600">
                <p class="font-medium">❌ Error: ${error.message}</p>
                <p class="text-sm mt-2">Make sure your backend is running and the API_URL is correct.</p>
            </div>
        `;
    } finally {
        // Reset button
        button.disabled = false;
        buttonText.textContent = 'Get Recipes';
    }
}