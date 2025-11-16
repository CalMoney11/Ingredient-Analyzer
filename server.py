from flask import Flask, request, jsonify, send_from_directory
import os
import tempfile
from analyzer import IngredientAnalyzer

app = Flask(__name__)

# Initialize analyzer (will raise if config missing)
analyzer = IngredientAnalyzer()


@app.route('/upload', methods=['POST'])
def upload():
    if 'photo' not in request.files:
        return jsonify({'error': 'No photo file provided'}), 400

    photo = request.files['photo']
    if photo.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    # Save to a temporary file
    try:
        suffix = os.path.splitext(photo.filename)[1] or '.jpg'
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            photo.save(tmp.name)
            tmp_path = tmp.name

        # Call analyzer to process the saved image
        result = analyzer.analyze_image(tmp_path)

        # Clean up temp file
        try:
            os.remove(tmp_path)
        except Exception:
            pass

        return jsonify({'status': 'ok', 'message': 'Image analyzed', 'result': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


    @app.route('/')
    def index():
        # Serve the local index.html so frontend and backend share same origin
        root = os.path.dirname(os.path.abspath(__file__))
        return send_from_directory(root, 'index.html')


    if __name__ == '__main__':
        # For local development only. Use a proper WSGI server for production.
        app.run(port=5000, debug=True)
