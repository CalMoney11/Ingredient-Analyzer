"""
Image and prompt analyzer for ingredient analysis.
Handles image processing and prompt-based ingredient detection using Gemini API.
"""

from typing import Optional
import google.generativeai as genai
from config import GEMINI_API_KEY, GEMINI_MODEL
import json
import mimetypes
import traceback


class IngredientAnalyzer:
    """Analyzes ingredients from images and prompts using Google Gemini API."""

    def __init__(self):
        """Initialize the IngredientAnalyzer with Gemini API."""
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY environment variable not set. Please configure it in .env file.")
        
        genai.configure(api_key=GEMINI_API_KEY)
        self.model = genai.GenerativeModel(GEMINI_MODEL)
        self.vision_model = genai.GenerativeModel(GEMINI_MODEL)
        self.ingredients_list = []  # Store the last analyzed ingredients

    def analyze_image(self, image_path: str) -> list:
        """
        Analyze an image to detect ingredients.

        Args:
            image_path: Path to the image file

        Returns:
            List of ingredient names as strings
        """
        try:
            # Validate image file exists and detect mime type
            if not image_path or not isinstance(image_path, str):
                return []

            mime_type, _ = mimetypes.guess_type(image_path)
            if not mime_type or not mime_type.startswith("image/"):
                # Fallback: assume jpeg if unknown
                mime_type = "image/jpeg"

            # Upload image file explicitly in binary mode to avoid text decoding issues
            try:
                with open(image_path, "rb") as f:
                    image_file = genai.upload_file(f, mime_type=mime_type)
            except UnicodeDecodeError as ude:
                print(f"UnicodeDecodeError while reading image as binary: {ude}")
                return []
            except Exception as upl_err:
                print(f"Image upload error: {upl_err}")
                traceback.print_exc()
                return []
            
            # Create prompt for ingredient analysis - request JSON array
            prompt = (
                "Identify every visible ingredient or food item in the photo. "
                "Return STRICTLY a JSON array of ingredient name strings. Example:\n"
                "[\"tomato\", \"basil\", \"olive oil\"]\n"
                "No extra keys, no explanations, no markdown, no code fences — ONLY the JSON array."
            )
            
            # Generate response
            response = self.vision_model.generate_content([prompt, image_file])
            
            # Parse JSON response
            try:
                ingredients_list = json.loads(response.text.strip())
                return ingredients_list if isinstance(ingredients_list, list) else []
            except json.JSONDecodeError:
                print(f"Warning: Could not parse JSON from image analysis. Raw response: {getattr(response, 'text', '')}")
                return []
        except UnicodeDecodeError as e:
            print(f"Unicode decode error during image analysis: {e}")
            traceback.print_exc()
            return []
        except Exception as e:
            print(f"Error analyzing image: {e}")
            traceback.print_exc()
            return []

    def analyze_prompt(self, prompt: str) -> list:
        """
        Analyze a text prompt to extract ingredient information.

        Args:
            prompt: Text prompt containing ingredient information

        Returns:
            List of ingredient names as strings
        """
        try:
            # Create system instruction for ingredient parsing - request JSON array
            system_prompt = """You are an ingredient parser. Extract all ingredients from the user's input.
            Return ONLY a JSON array of ingredient names, like this:
            ["ingredient1", "ingredient2", "ingredient3"]
            
            Do not include quantities, units, explanations, or any other text. Just the ingredient names in a JSON array."""
            
            # Generate response
            response = self.model.generate_content(system_prompt + "\n\nUser input: " + prompt)
            
            # Parse JSON response
            try:
                ingredients_list = json.loads(response.text.strip())
                return ingredients_list if isinstance(ingredients_list, list) else []
            except json.JSONDecodeError:
                # Fallback: return empty list if parsing fails
                print(f"Warning: Could not parse JSON from prompt analysis. Raw response: {response.text}")
                return []
        except Exception as e:
            print(f"Error analyzing prompt: {str(e)}")
            return []

    def analyze(self, image_path: Optional[str] = None, prompt: Optional[str] = None) -> list:
        """Analyze ingredients. Primary path: image; fallback: prompt if provided and no image."""
        if image_path:
            ingredients = self.analyze_image(image_path)
        elif prompt:
            ingredients = self.analyze_prompt(prompt)
        else:
            ingredients = []

        # Deduplicate preserving order
        seen = set()
        ordered = []
        for ing in ingredients:
            k = ing.strip().lower()
            if k and k not in seen:
                seen.add(k)
                ordered.append(ing.strip())
        self.ingredients_list = ordered
        return ordered
    
    def get_stored_ingredients(self) -> list:
        """
        Get the last analyzed ingredients list.
        
        Returns:
            List of ingredients from the last analysis
        """
        return self.ingredients_list
    
    def filter_top_recipes(self, ingredients: list, recipes: list, top_n: int = 5) -> list:
        """
        Use Gemini to rank and filter recipes based on ingredients.
        
        Args:
            ingredients: List of available ingredients
            recipes: List of recipe dictionaries with 'title' and 'ingredients' keys
            top_n: Number of top recipes to return (default 5)
            
        Returns:
            List of top N recipes ranked by Gemini
        """
        try:
            # Limit recipes to first 20 to avoid token limits
            recipes_subset = recipes[:20] if len(recipes) > 20 else recipes
            
            # Format recipes for prompt
            recipe_list = []
            for i, recipe in enumerate(recipes_subset):
                title = recipe.get('title', 'Untitled')
                recipe_ingredients = recipe.get('ingredients', [])
                ingredients_str = ', '.join(recipe_ingredients[:10])  # Limit to 10 ingredients shown
                recipe_list.append(f"{i}. {title}\n   Ingredients: {ingredients_str}")
            
            recipes_formatted = '\n\n'.join(recipe_list)
            
            # Create prompt for Gemini
            prompt = f"""Given these available ingredients: {', '.join(ingredients)}

And these recipe options:
{recipes_formatted}

Analyze each recipe and return ONLY a JSON array of the indices (0-based) of the top {top_n} recipes that:
1. Use the most available ingredients
2. Are most practical and appealing
3. Have good variety

Return ONLY the JSON array of indices, no other text. Example: [0, 3, 5, 7, 9]"""

            response = self.model.generate_content(prompt)
            
            # Parse the indices
            top_indices = json.loads(response.text.strip())
            
            # Return the filtered recipes
            filtered = []
            for i in top_indices:
                if i < len(recipes_subset):
                    filtered.append(recipes_subset[i])
                if len(filtered) >= top_n:
                    break
            
            return filtered
            
        except Exception as e:
            # Fallback: return first top_n recipes if filtering fails
            print(f"Recipe filtering error: {e}. Returning first {top_n} recipes.")
            return recipes[:top_n]

    def generate_recipes(self, ingredients: list, count: int = 5) -> list:
        """Generate recipes using Gemini given the detected ingredients.

        Returns a list of recipe dicts: { name: str, ingredients: [str], steps: [str] }.
        """
        if not ingredients:
            return []
        try:
            base_prompt = (
                "You are a recipe generator. Using SOME OR ALL of these ingredients: "
                f"{', '.join(ingredients)}. Create {count} distinct recipes. "
                "RETURN STRICT JSON ONLY: an array of objects, each with keys: name (string), ingredients (array of ingredient strings), steps (array of short imperative step strings). Example: \n"
                "[ {\"name\": \"Tomato Basil Pasta\", \"ingredients\": [\"tomato\", \"basil\", \"olive oil\"], \"steps\": [\"Boil pasta\", \"Saute tomatoes\"] } ] \n"
                "NO markdown, NO commentary, NO code fences, NO numbering outside JSON."
            )

            attempt_raw_texts = []
            for attempt in range(2):
                prompt = base_prompt if attempt == 0 else (
                    base_prompt + "\nRETRY STRICTLY: Output ONLY valid JSON array as previously defined." )
                response = self.model.generate_content(prompt)
                raw = getattr(response, 'text', '')
                raw = raw.strip()
                attempt_raw_texts.append(raw[:400])
                try:
                    data = json.loads(raw)
                    if isinstance(data, list):
                        cleaned = []
                        for r in data[:count]:
                            if not isinstance(r, dict):
                                continue
                            name = str(r.get('name', 'Untitled Recipe')).strip()
                            ing_list = [str(i).strip() for i in r.get('ingredients', []) if str(i).strip()]
                            steps_list = [str(s).strip() for s in r.get('steps', []) if str(s).strip()]
                            if not name or (not ing_list and not steps_list):
                                continue
                            cleaned.append({
                                'name': name,
                                'ingredients': ing_list,
                                'steps': steps_list
                            })
                        if cleaned:
                            return cleaned
                except json.JSONDecodeError:
                    print(f"Recipe JSON parse failed attempt {attempt+1}. Raw snippet: {raw[:300]}")
                    continue

            # Fallback synthetic recipes if model responses unusable
            print("Falling back to synthetic recipes.")
            fallback = []
            base_ing = ingredients[:10]  # limit for readability
            for i in range(count):
                subset = base_ing[i::count] or base_ing  # simple distribution
                fallback.append({
                    'name': f'Simple Dish {i+1}',
                    'ingredients': subset,
                    'steps': [
                        'Combine available ingredients',
                        'Season to taste',
                        'Cook appropriately (bake/saute/boil)',
                        'Plate and serve'
                    ]
                })
            return fallback
        except Exception as e:
            print(f"Gemini recipe generation error: {e}")
            return []

    def run(self):
        """Run the analyzer with interactive mode or default behavior."""
        print("Ingredient Analyzer initialized and ready to analyze!")
        print(f"Using Gemini model: {GEMINI_MODEL}")
        
        # TODO: Implement interactive CLI or API mode
        # Example usage:
        # 1. Image analysis: analyzer.analyze_image("path/to/image.jpg")
        # 2. Prompt analysis: analyzer.analyze_prompt("I have 2 cups of flour and 3 eggs")
        # 3. Combined: analyzer.analyze(image_path="...", prompt="...")


if __name__ == "__main__":
    analyzer = IngredientAnalyzer()
    analyzer.run()
