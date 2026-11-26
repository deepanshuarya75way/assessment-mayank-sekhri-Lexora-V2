import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load your .env file so it gets your GOOGLE_API_KEY
load_dotenv()

# Configure the SDK (it will automatically look for GOOGLE_API_KEY in the environment)
genai.configure(api_key=os.getenv("AIzaSyCS0d3xZ7zI8c9_HRAH1hOM_W-cxHDghic"))

print("Fetching available embedding models for your key...\n")

try:
    for m in genai.list_models():
        if 'embedContent' in m.supported_generation_methods:
            print(f"✅ Supported Model: {m.name}")
            print(f"   Description: {m.description}")
            print("-" * 40)
except Exception as e:
    print(f"Error fetching models: {e}")