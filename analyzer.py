"""
Image and prompt analyzer for ingredient analysis.
Handles image processing and prompt-based ingredient detection using Gemini API.
"""

from typing import Optional
import json
import google.generativeai as genai
from config import GEMINI_API_KEY, GEMINI_MODEL


class IngredientAnalyzer:
    """Analyzes ingredients from images and prompts using Google Gemini API."""

    def __init__(self):
        """Initialize the IngredientAnalyzer with Gemini API."""
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY environment variable not set. Please configure it in .env file.")
        
        genai.configure(api_key=GEMINI_API_KEY)
        self.model = genai.GenerativeModel(GEMINI_MODEL)
        self.vision_model = genai.GenerativeModel(GEMINI_MODEL)

    def analyze_image(self, image_path: str) -> str:
        """
        Analyze an image to detect ingredients with quality info.

        Args:
            image_path: Path to the image file

        Returns:
            String containing ingredient list with quantities and quality
        """
        try:
            # Upload image file
            image_file = genai.upload_file(image_path)
            
            # Create prompt for detailed ingredient analysis
            prompt = """Analyze this image and identify all visible ingredients or food items.
            
For each ingredient, list:
- Name
- Quantity (estimate if visible)
- Quality/freshness/condition

Format as a clear, structured text list that includes all this information.
Example:
- Tomatoes (3 medium, ripe and fresh)
- Onion (1 large, good condition)
- Garlic (4 cloves, fresh)"""
            
            # Generate response
            response = self.vision_model.generate_content([prompt, image_file])
            return response.text
        except Exception as e:
            return f"Error analyzing image: {str(e)}"

    def analyze_prompt(self, prompt: str) -> str:
        """
        Analyze a text prompt to extract ingredient information.

        Args:
            prompt: Text prompt containing ingredient information

        Returns:
            String containing structured ingredient list
        """
        try:
            # Create system instruction for ingredient parsing
            system_prompt = """Parse the user's input and extract all mentioned ingredients.
            
For each ingredient, list:
- Name
- Quantity (with units)
- Any quality or condition notes

Format as a clear, structured text list.
Example:
- Flour (2 cups, all-purpose)
- Eggs (3 large, fresh)
- Milk (1 cup, whole)"""
            
            # Generate response
            response = self.model.generate_content(system_prompt + "\n\nUser input: " + prompt)
            return response.text
        except Exception as e:
            return f"Error analyzing prompt: {str(e)}"

    def analyze(self, image_path: Optional[str] = None, prompt: Optional[str] = None) -> str:
        """
        Analyze ingredients from either an image or prompt.

        Args:
            image_path: Optional path to an image file
            prompt: Optional text prompt

        Returns:
            String containing combined ingredient analysis
        """
        parts = []

        if image_path:
            image_result = self.analyze_image(image_path)
            parts.append(f"From Image:\n{image_result}")

        if prompt:
            prompt_result = self.analyze_prompt(prompt)
            parts.append(f"From Text:\n{prompt_result}")

        return "\n\n".join(parts) if parts else "No ingredients detected."

    def generate_recipes(self, ingredient_analysis: str) -> list:
        """
        Generate 5 recipe ideas from ingredient analysis.

        Args:
            ingredient_analysis: String containing ingredient info with quantities/quality

        Returns:
            List of recipe dicts with 'title', 'ingredients', and 'steps'
        """
        try:
            prompt = f"""Based on these available ingredients:

{ingredient_analysis}

Generate 5 diverse, practical recipe ideas. Each recipe should:
- Use SOME or ALL of the listed ingredients (don't need to use everything)
- Consider the quantities and quality mentioned
- Include common pantry staples if needed
- Be distinct from other recipes
- Include clear cooking steps

Return ONLY a JSON array with exactly 5 recipes:
[
  {{
    "title": "Recipe Name 1",
    "ingredients": ["ingredient1", "ingredient2"],
    "steps": ["Step 1 instruction", "Step 2 instruction", "Step 3 instruction"]
  }},
  {{
    "title": "Recipe Name 2",
    "ingredients": ["ingredient3", "ingredient4"],
    "steps": ["Step 1", "Step 2"]
  }}
]

Each recipe must have 3-6 steps. No explanations, just the JSON array."""

            response = self.model.generate_content(prompt)
            response_text = response.text.strip()
            
            # Try to extract JSON from response (handle markdown code blocks)
            if "```json" in response_text:
                start = response_text.find("```json") + 7
                end = response_text.find("```", start)
                response_text = response_text[start:end].strip()
            elif "```" in response_text:
                start = response_text.find("```") + 3
                end = response_text.find("```", start)
                response_text = response_text[start:end].strip()
            
            # Try to find JSON array
            if not response_text.startswith("["):
                start = response_text.find("[")
                end = response_text.rfind("]")
                if start != -1 and end != -1:
                    response_text = response_text[start:end+1]
            
            try:
                recipes = json.loads(response_text)
                if isinstance(recipes, list) and len(recipes) > 0:
                    return recipes[:5]
            except json.JSONDecodeError as e:
                print(f"JSON parse error: {e}")
                print(f"Raw response: {response.text[:500]}")
            
            # Fallback
            return [{"title": "Recipe suggestions available", "ingredients": ["See analysis for details"], "steps": ["Unable to generate steps"]}]
        except Exception as e:
            return [{"title": f"Error: {str(e)}", "ingredients": [], "steps": []}]
    
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
