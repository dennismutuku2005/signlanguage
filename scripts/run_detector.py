#!/usr/bin/env python3
"""
Script to run the Sign Language Detection API
"""

import subprocess
import sys
import os

def install_requirements():
    """Install required Python packages"""
    print("Installing required packages...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ All packages installed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error installing packages: {e}")
        return False
    return True

def run_detector():
    """Run the sign language detector API"""
    print("🚀 Starting Sign Language Detection API...")
    print("📹 Make sure your camera is connected and working")
    print("🌐 API will be available at: http://localhost:5000")
    print("📋 Available endpoints:")
    print("   - POST /detect - Process video frame")
    print("   - GET /get_text - Get detected text")
    print("   - GET /health - Health check")
    print("\n" + "="*50)
    
    try:
        # Run the Flask app
        subprocess.run([sys.executable, "sign_language_detector.py"])
    except KeyboardInterrupt:
        print("\n🛑 Shutting down Sign Language Detection API...")
    except Exception as e:
        print(f"❌ Error running detector: {e}")

if __name__ == "__main__":
    print("🤖 Sign Language Detection System")
    print("="*40)
    
    # Check if we're in the scripts directory
    if not os.path.exists("sign_language_detector.py"):
        print("❌ Please run this script from the scripts directory")
        sys.exit(1)
    
    # Install requirements first
    if install_requirements():
        print("\n" + "="*40)
        run_detector()
    else:
        print("❌ Failed to install requirements. Please check your Python environment.")
        sys.exit(1)
