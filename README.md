# Ingredient Analyzer

AI-powered ingredient detection and recipe generator using Google Gemini API.

**Live Demo:** https://calmoney11.github.io/Ingredient-Analyzer/

## Features

- 📷 **Image Analysis**: Upload food photos to automatically detect ingredients
- 🤖 **AI Recipe Generation**: Generate 5 custom recipes using detected ingredients
- 🍽️ **Recipe Selection**: Pick a recipe and generate additional recipes using leftover ingredients
- 📊 **Nutrition Information**: View calories, protein, fat, carbs, and sugar for each recipe
- 🌙 **Dark Mode**: Toggle between light and dark themes
- 🔄 **User Preferences**: Add dietary restrictions, cuisine preferences, or cooking requirements

## Setup and Installation

### Prerequisites

- Python 3.12 or higher
- Google Gemini API key ([Get one here](https://ai.google.dev/))

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/CalMoney11/Ingredient-Analyzer.git
   cd Ingredient-Analyzer
   ```

2. **Create a virtual environment**
   
   **Windows (PowerShell):**
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
   
   **Windows (Command Prompt):**
   ```cmd
   python -m venv venv
   venv\Scripts\activate.bat
   ```
   
   **macOS/Linux:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   
   Create a `.env` file in the project root:
   ```env
   GEMINI_API_KEY=your_api_key_here
   GEMINI_MODEL=gemini-2.0-flash-exp
   ```

5. **Run the application**
   ```bash
   python app.py
   ```
   
   The app will start at `http://127.0.0.1:5000`

6. **Deactivate virtual environment** (when done)
   ```bash
   deactivate
   ```

## Usage

1. **Upload an Image**: Click the camera icon or drag-and-drop a food photo
2. **Analyze Ingredients**: Click "Analyze Image / Prompt" to detect ingredients
3. **Generate Recipes**: Click "Generate AI Recipes" to get 5 recipe suggestions
4. **Pick a Recipe**: Click "Pick Recipe" on your favorite to see leftover ingredient options
5. **Leftover Recipes**: Click "Generate Leftover Recipes" for additional meals using remaining ingredients

## Project Structure

```
Ingredient-Analyzer/
├── app.py                 # Flask backend API
├── analyzer.py            # Gemini API integration and recipe generation
├── config.py             # Environment configuration
├── index.html            # Frontend HTML
├── script.js             # Frontend JavaScript logic
├── styles.css            # Styling and themes
├── requirements.txt      # Python dependencies
├── .env                  # Environment variables (create this)
├── venv/                 # Virtual environment (created during setup)
└── uploads/              # Temporary image storage
```

## Technologies Used

- **Backend**: Flask, Python 3.12
- **AI**: Google Gemini 2.0 Flash
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Deployment**: Vercel (backend), GitHub Pages (frontend)

## API Endpoints

- `POST /api/analyze` - Analyze image and detect ingredients
- `POST /api/generate_recipes` - Generate recipes from detected ingredients
- `POST /api/generate_leftover_recipes` - Generate recipes using leftover ingredients
- `GET /api/health` - Health check endpoint

## Troubleshooting

**Virtual environment not activating?**
- Windows: Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` in PowerShell as Administrator

**Module not found errors?**
- Ensure virtual environment is activated (you should see `(venv)` in your terminal prompt)
- Run `pip install -r requirements.txt` again

**Gemini API errors?**
- Verify your API key in `.env` is correct
- Check you have API quota available at [Google AI Studio](https://aistudio.google.com/)

**Port already in use?**
- Change the port in `app.py`: `app.run(port=5001)`

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT License - see LICENSE file for details
