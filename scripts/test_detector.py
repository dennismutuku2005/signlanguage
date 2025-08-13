#!/usr/bin/env python3
"""
Test script for the Sign Language Detection API
"""

import requests
import json
import time
import base64
import cv2

def test_health_endpoint():
    """Test the health check endpoint"""
    try:
        response = requests.get('http://localhost:5000/health')
        if response.status_code == 200:
            print("✅ Health check passed:", response.json())
            return True
        else:
            print("❌ Health check failed:", response.status_code)
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to API. Make sure the detector is running.")
        return False

def test_detection_with_camera():
    """Test detection using camera feed"""
    print("📹 Testing with camera feed...")
    
    # Initialize camera
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("❌ Cannot open camera")
        return False
    
    print("🎥 Camera opened. Press 'q' to quit, 's' to send frame for detection")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("❌ Cannot read frame")
            break
        
        # Display frame
        cv2.imshow('Sign Language Test', frame)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('s'):
            # Convert frame to base64
            _, buffer = cv2.imencode('.jpg', frame)
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            frame_data = f"data:image/jpeg;base64,{frame_base64}"
            
            # Send to API
            try:
                response = requests.post('http://localhost:5000/detect', 
                                       json={'frame': frame_data})
                if response.status_code == 200:
                    result = response.json()
                    print("🔍 Detection result:", result)
                else:
                    print("❌ Detection failed:", response.status_code)
            except Exception as e:
                print(f"❌ Error sending frame: {e}")
    
    cap.release()
    cv2.destroyAllWindows()
    return True

def test_get_text_endpoint():
    """Test the get text endpoint"""
    try:
        response = requests.get('http://localhost:5000/get_text')
        if response.status_code == 200:
            result = response.json()
            print("📝 Current detected text:", result)
            return True
        else:
            print("❌ Get text failed:", response.status_code)
            return False
    except Exception as e:
        print(f"❌ Error getting text: {e}")
        return False

def main():
    print("🧪 Sign Language Detection API Test Suite")
    print("="*50)
    
    # Test health endpoint
    print("\n1. Testing health endpoint...")
    if not test_health_endpoint():
        print("❌ API is not running. Please start the detector first.")
        return
    
    # Test get text endpoint
    print("\n2. Testing get text endpoint...")
    test_get_text_endpoint()
    
    # Test detection with camera
    print("\n3. Testing detection with camera...")
    print("   Make sure your camera is connected!")
    input("   Press Enter to continue or Ctrl+C to skip...")
    
    try:
        test_detection_with_camera()
    except KeyboardInterrupt:
        print("\n🛑 Camera test skipped")
    
    print("\n✅ Test suite completed!")

if __name__ == "__main__":
    main()
