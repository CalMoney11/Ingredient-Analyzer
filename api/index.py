"""
Vercel serverless API for Ingredient Analyzer.
Frontend is hosted separately on GitHub Pages.
"""
import os
import sys
from uuid import uuid4
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from analyzer import IngredientAnalyzer

app = Flask(__name__)

# Enable CORS for your GitHub Pages domain
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "https://calmoney11.github.io/Ingredient-Analyzer/",  # Replace with your actual GitHub Pages URL
            "http://localhost:*",  # For local testing
            "http://127.0.0.1:*"
        ]
    }
})

UPLOAD_DIR = "/tmp/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

analyzer = IngredientAnalyzer()

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "Ingredient Analyzer API is running"})

@app.route("/api/analyze", methods=["POST"])
def analyze():
    """
    Accepts multipart form-data with optional image and prompt.
    """
    try:
        image = request.files.get("image")
        prompt = request.form.get("prompt", "")

        image_path = None
        if image and image.filename:
            filename = secure_filename(image.filename)
            unique_name = f"{uuid4().hex}_{filename}"
            image_path = os.path.join(UPLOAD_DIR, unique_name)
            image.save(image_path)

        result = analyzer.analyze(image_path=image_path, prompt=prompt)

        # Cleanup
        if image_path and os.path.exists(image_path):
            try:
                os.remove(image_path)
            except Exception:
                pass

        return jsonify({"success": True, "data": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# Export for Vercel (no app.run())