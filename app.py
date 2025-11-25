import os
import base64
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize Gemini Client
# The API key is automatically retrieved from the environment variable 'API_KEY'
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/translate', methods=['POST'])
def translate():
    try:
        data = request.get_json()
        text = data.get('text')
        source_lang = data.get('source_lang', 'Auto')
        target_lang = data.get('target_lang', 'English')

        if not text:
            return jsonify({"error": "No text provided"}), 400

        # Construct prompt for translation
        prompt = f"Translate the following text from {source_lang} to {target_lang}. Only provide the translated text, no explanations:\n\n{text}"

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        
        return jsonify({"text": response.text})

    except Exception as e:
        print(f"Translation error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/ocr', methods=['POST'])
def ocr():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        # Read file bytes and get mime type
        image_bytes = file.read()
        mime_type = file.content_type or "image/jpeg"

        # Create image part for Gemini
        image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

        prompt = "Extract all the text found in this image. Return only the text. Do not add markdown formatting."

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[image_part, prompt]
        )

        return jsonify({"text": response.text})

    except Exception as e:
        print(f"OCR error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/tts', methods=['POST'])
def tts():
    try:
        data = request.get_json()
        text = data.get('text')
        
        if not text:
            return jsonify({"error": "No text provided"}), 400

        # Call Gemini for Text-to-Speech
        response = client.models.generate_content(
            model='gemini-2.5-flash-preview-tts',
            contents=text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name="Puck" 
                        )
                    )
                )
            )
        )
        
        # Extract audio bytes and convert to base64 for the frontend
        for part in response.candidates[0].content.parts:
            if part.inline_data:
                audio_bytes = part.inline_data.data
                audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
                return jsonify({"audio": audio_b64})
        
        return jsonify({"error": "No audio generated"}), 500

    except Exception as e:
        print(f"TTS error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host="0.0.0.0", debug=True, port=os.environ.get("BACKEND_PORT") or 5000)