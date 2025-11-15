"""
Image and prompt analyzer for ingredient analysis.
Handles image processing and prompt-based ingredient detection using Gemini API.
"""

from typing import Optional
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

    def analyze_image(self, image_path: str) -> dict:
        """
        Analyze an image to detect ingredients.

        Args:
            image_path: Path to the image file

        Returns:
            Dictionary containing detected ingredients and metadata
        """
        try:
            # Upload image file
            image_file = genai.upload_file(image_path)
            
            # Create prompt for ingredient analysis
            prompt = """Analyze this image and identify all visible ingredients or food items. 
            For each ingredient found, provide:
            1. Ingredient name
            2. Estimated quantity (if visible)
            3. Condition/freshness assessment
            
            Format the response as a structured list."""
            
            # Generate response
            response = self.vision_model.generate_content([prompt, image_file])
            
            return {
                "status": "success",
                "image_path": image_path,
                "analysis": response.text
            }
        except Exception as e:
            return {
                "status": "error",
                "image_path": image_path,
                "error": str(e)
            }

    def analyze_prompt(self, prompt: str) -> dict:
        """
        Analyze a text prompt to extract ingredient information.

        Args:
            prompt: Text prompt containing ingredient information

        Returns:
            Dictionary containing parsed ingredients
        """
        try:
            # Create system instruction for ingredient parsing
            system_prompt = """You are an ingredient analysis expert. Parse the user's input and extract all mentioned ingredients.
            For each ingredient, identify:
            1. Ingredient name
            2. Quantity
            3. Unit of measurement
            4. Any special properties or conditions
            
            Format the response as a structured list."""
            
            # Generate response
            response = self.model.generate_content(system_prompt + "\n\nUser input: " + prompt)
            
            return {
                "status": "success",
                "prompt": prompt,
                "analysis": response.text
            }
        except Exception as e:
            return {
                "status": "error",
                "prompt": prompt,
                "error": str(e)
            }

    def analyze(self, image_path: Optional[str] = None, prompt: Optional[str] = None) -> dict:
        """
        Analyze ingredients from either an image or prompt.

        Args:
            image_path: Optional path to an image file
            prompt: Optional text prompt

        Returns:
            Dictionary containing analysis results
        """
        results = {}

        if image_path:
            results["image_analysis"] = self.analyze_image(image_path)

        if prompt:
            results["prompt_analysis"] = self.analyze_prompt(prompt)

        return results

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
