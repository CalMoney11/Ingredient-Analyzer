"""
Flask API for Ingredient Analyzer.
Handles image uploads and prompt submissions from the frontend and calls the
`IngredientAnalyzer` in `analyzer.py` to perform analysis.
"""
import os
from uuid import uuid4
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from analyzer import IngredientAnalyzer
from i_to_rec3 import load_recipes_from_kaggle, find_valid_recipes


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Configure Flask to serve static files from the project root
app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
# Allow all origins during development; tighten for production as needed.
CORS(app, resources={r"/*": {"origins": "*"}})

analyzer = IngredientAnalyzer()


@app.route("/", methods=["GET"])
def index():
    """Serve the existing `index.html` from the project root."""
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    """Analyze an uploaded image (or optional text) and return ingredient list."""
    try:
        image = request.files.get("image")  # Image is primary
        prompt = request.form.get("prompt", "").strip()  # Optional fallback

        print(f"📥 Received analyze request - Image: {image.filename if image else 'None'}, Prompt: {prompt}")

        image_path = None
        if image and image.filename:
            filename = secure_filename(image.filename)
            unique_name = f"{uuid4().hex}_{filename}"
            image_path = os.path.join(UPLOAD_DIR, unique_name)
            image.save(image_path)
            print(f"💾 Saved image to: {image_path}")

        ingredients_list = analyzer.analyze(image_path=image_path, prompt=prompt if not image_path else None)
        print(f"✅ Analysis complete. Found {len(ingredients_list)} ingredients: {ingredients_list}")

        # Cleanup temp file
        if image_path and os.path.exists(image_path):
            try:
                os.remove(image_path)
                print(f"🗑️ Cleaned up temp file: {image_path}")
            except Exception as e:
                print(f"⚠️ Failed to cleanup temp file: {e}")

        if not ingredients_list:
            return jsonify({
                "success": False,
                "error": "No ingredients detected. Try a clearer image or check the console logs."
            }), 400

        return jsonify({
            "success": True,
            "count": len(ingredients_list),
            "ingredients": ingredients_list
        })
    except Exception as e:
        print(f"❌ Analysis error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": f"Analysis failed: {e}"}), 500


# Note: Serving uploaded files publicly is disabled in production for security.
# If you need to debug uploaded files locally, temporarily re-enable an endpoint
# or check the `uploads/` directory directly on the server.


@app.route('/get_recipes', methods=['POST'])
def get_recipes():
    """
    Get recipes based on stored ingredients list.
    Calls the recipe generation function from i-to-rec3.py
    """
    try:
        ingredients = analyzer.get_stored_ingredients()
        if not ingredients:
            return jsonify({"success": False, "error": "No ingredients found. Please analyze ingredients first."}), 400

        print("Loading recipes from Kaggle...")
        try:
            df = load_recipes_from_kaggle()
        except UnicodeDecodeError as ude:
            # Provide clearer guidance for encoding issues
            msg = (
                "Recipe dataset encoding error. This usually means the CSV contains non UTF-8 characters. "
                "We attempted fallback encodings (utf-8, utf-8-sig, latin-1) and all failed. "
                f"Detail: {ude}"
            )
            return jsonify({"success": False, "error": msg}), 500
        except Exception as load_err:
            return jsonify({"success": False, "error": f"Failed to load recipes: {load_err}"}), 500

        print(f"Finding recipes matching {len(ingredients)} ingredients...")
        valid_recipes = find_valid_recipes(df, ingredients)

        if not valid_recipes:
            return jsonify({
                "success": True,
                "ingredients": ingredients,
                "recipes": [],
                "total_found": 0,
                "message": "No recipes found matching your ingredients."
            })

        print(f"Found {len(valid_recipes)} matching recipes. Filtering to top 5...")
        top_recipes = analyzer.filter_top_recipes(ingredients, valid_recipes, top_n=5)

        return jsonify({
            "success": True,
            "ingredients": ingredients,
            "recipes": top_recipes,
            "total_found": len(valid_recipes)
        })
    except Exception as e:
        print(f"Unhandled error in get_recipes: {e}")
        return jsonify({"success": False, "error": f"Unexpected server error: {e}"}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

# --- Compatibility API prefix routes (for existing frontend expecting /api/*) ---
@app.route('/api/health', methods=['GET'])
def api_health():
    return health()

@app.route('/api/analyze', methods=['POST'])
def api_analyze():
    return analyze()

@app.route('/api/get_recipes', methods=['POST'])
def api_get_recipes():
    return get_recipes()

@app.route('/generate_recipes', methods=['POST'])
@app.route('/api/generate_recipes', methods=['POST'])
def generate_recipes():
    """Generate AI recipes based on stored ingredients using Gemini."""
    try:
        ingredients = analyzer.get_stored_ingredients()
        if not ingredients:
            return jsonify({"success": False, "error": "No ingredients available. Analyze an image or prompt first."}), 400
        
        # Get optional user preferences from request body
        user_preferences = ""
        if request.is_json:
            data = request.get_json()
            user_preferences = data.get('preferences', '')
        elif request.form:
            user_preferences = request.form.get('preferences', '')
        
        print(f"🍳 Generating recipes with preferences: {user_preferences[:100] if user_preferences else 'None'}")
        recipes = analyzer.generate_recipes(ingredients, count=5, user_preferences=user_preferences)
        if not recipes:
            return jsonify({
                "success": False,
                "error": "Recipe generation failed after retries.",
                "error_type": "generation_failed"
            }), 500
        return jsonify({
            "success": True,
            "ingredients": ingredients,
            "recipes": recipes,
            "count": len(recipes)
        })
    except Exception as e:
        return jsonify({"success": False, "error": f"Unexpected error generating recipes: {e}", "error_type": "exception"}), 500


if __name__ == "__main__":
    # Run dev server: use the venv python and run `python app.py`.
    app.run()
