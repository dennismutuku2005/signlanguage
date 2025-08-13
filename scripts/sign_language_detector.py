import cv2
import mediapipe as mp
import numpy as np
import json
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
import time

app = Flask(__name__)
CORS(app)

class SignLanguageDetector:
    def __init__(self):
        # Initialize MediaPipe
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        self.mp_drawing = mp.solutions.drawing_utils
        
        # Sign language gesture mappings (simplified for demo)
        self.gesture_mappings = {
            'hello': self.detect_hello,
            'thank_you': self.detect_thank_you,
            'please': self.detect_please,
            'yes': self.detect_yes,
            'no': self.detect_no,
            'good': self.detect_good,
            'bad': self.detect_bad,
            'help': self.detect_help,
            'water': self.detect_water,
            'food': self.detect_food
        }
        
        self.current_gesture = ""
        self.gesture_confidence = 0.0
        self.gesture_history = []
        
    def calculate_distance(self, point1, point2):
        """Calculate Euclidean distance between two points"""
        return np.sqrt((point1.x - point2.x)**2 + (point1.y - point2.y)**2)
    
    def calculate_angle(self, point1, point2, point3):
        """Calculate angle between three points"""
        v1 = np.array([point1.x - point2.x, point1.y - point2.y])
        v2 = np.array([point3.x - point2.x, point3.y - point2.y])
        
        cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
        cos_angle = np.clip(cos_angle, -1.0, 1.0)
        angle = np.arccos(cos_angle)
        return np.degrees(angle)
    
    def detect_hello(self, landmarks):
        """Detect 'Hello' gesture - open palm facing forward"""
        if not landmarks:
            return 0.0
            
        # Check if fingers are extended
        finger_tips = [4, 8, 12, 16, 20]  # Thumb, Index, Middle, Ring, Pinky tips
        finger_pips = [3, 6, 10, 14, 18]  # Finger joints
        
        extended_fingers = 0
        for tip, pip in zip(finger_tips, finger_pips):
            if landmarks[tip].y < landmarks[pip].y:  # Finger extended upward
                extended_fingers += 1
                
        # Hello gesture: 4-5 fingers extended
        if extended_fingers >= 4:
            return 0.8
        return 0.0
    
    def detect_thank_you(self, landmarks):
        """Detect 'Thank you' gesture - hand moving from chin outward"""
        if not landmarks:
            return 0.0
            
        # Simplified: check if hand is near face area
        wrist = landmarks[0]
        middle_finger_tip = landmarks[12]
        
        # Check if hand is in upper area (near face)
        if middle_finger_tip.y < 0.3 and wrist.y < 0.4:
            return 0.7
        return 0.0
    
    def detect_please(self, landmarks):
        """Detect 'Please' gesture - circular motion on chest"""
        if not landmarks:
            return 0.0
            
        # Simplified: flat hand in center area
        wrist = landmarks[0]
        middle_finger = landmarks[12]
        
        if 0.3 < wrist.y < 0.7 and 0.2 < wrist.x < 0.8:
            return 0.6
        return 0.0
    
    def detect_yes(self, landmarks):
        """Detect 'Yes' gesture - nodding motion or fist"""
        if not landmarks:
            return 0.0
            
        # Check for closed fist (fingers curled)
        finger_tips = [8, 12, 16, 20]  # Index, Middle, Ring, Pinky tips
        finger_mcp = [5, 9, 13, 17]   # Knuckles
        
        curled_fingers = 0
        for tip, mcp in zip(finger_tips, finger_mcp):
            if landmarks[tip].y > landmarks[mcp].y:  # Finger curled down
                curled_fingers += 1
                
        if curled_fingers >= 3:
            return 0.7
        return 0.0
    
    def detect_no(self, landmarks):
        """Detect 'No' gesture - index finger pointing or waving"""
        if not landmarks:
            return 0.0
            
        # Check if only index finger is extended
        index_tip = landmarks[8]
        index_pip = landmarks[6]
        middle_tip = landmarks[12]
        middle_pip = landmarks[10]
        
        index_extended = index_tip.y < index_pip.y
        middle_curled = middle_tip.y > middle_pip.y
        
        if index_extended and middle_curled:
            return 0.8
        return 0.0
    
    def detect_good(self, landmarks):
        """Detect 'Good' gesture - thumbs up"""
        if not landmarks:
            return 0.0
            
        thumb_tip = landmarks[4]
        thumb_mcp = landmarks[2]
        index_tip = landmarks[8]
        index_pip = landmarks[6]
        
        # Thumb extended upward, other fingers curled
        thumb_up = thumb_tip.y < thumb_mcp.y
        index_curled = index_tip.y > index_pip.y
        
        if thumb_up and index_curled:
            return 0.9
        return 0.0
    
    def detect_bad(self, landmarks):
        """Detect 'Bad' gesture - thumbs down"""
        if not landmarks:
            return 0.0
            
        thumb_tip = landmarks[4]
        thumb_mcp = landmarks[2]
        
        # Thumb extended downward
        thumb_down = thumb_tip.y > thumb_mcp.y
        
        if thumb_down:
            return 0.8
        return 0.0
    
    def detect_help(self, landmarks):
        """Detect 'Help' gesture - one hand on top of the other"""
        if not landmarks:
            return 0.0
            
        # Simplified: open palm in center
        wrist = landmarks[0]
        if 0.4 < wrist.x < 0.6 and 0.4 < wrist.y < 0.6:
            return 0.5
        return 0.0
    
    def detect_water(self, landmarks):
        """Detect 'Water' gesture - W shape with fingers"""
        if not landmarks:
            return 0.0
            
        # Check if index, middle, ring fingers are extended
        index_tip = landmarks[8]
        middle_tip = landmarks[12]
        ring_tip = landmarks[16]
        index_pip = landmarks[6]
        middle_pip = landmarks[10]
        ring_pip = landmarks[14]
        
        fingers_up = (index_tip.y < index_pip.y and 
                     middle_tip.y < middle_pip.y and 
                     ring_tip.y < ring_pip.y)
        
        if fingers_up:
            return 0.7
        return 0.0
    
    def detect_food(self, landmarks):
        """Detect 'Food' gesture - hand to mouth motion"""
        if not landmarks:
            return 0.0
            
        # Check if hand is near mouth area
        wrist = landmarks[0]
        if wrist.y < 0.2 and 0.3 < wrist.x < 0.7:
            return 0.6
        return 0.0
    
    def process_frame(self, frame_data):
        """Process a single frame for sign language detection"""
        try:
            # Decode base64 image
            image_data = base64.b64decode(frame_data.split(',')[1])
            nparr = np.frombuffer(image_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Process with MediaPipe
            results = self.hands.process(rgb_frame)
            
            detected_gestures = []
            
            if results.multi_hand_landmarks:
                for hand_landmarks in results.multi_hand_landmarks:
                    # Test each gesture
                    for gesture_name, detector_func in self.gesture_mappings.items():
                        confidence = detector_func(hand_landmarks.landmark)
                        if confidence > 0.5:  # Threshold for detection
                            detected_gestures.append({
                                'gesture': gesture_name,
                                'confidence': confidence
                            })
            
            # Select best gesture
            if detected_gestures:
                best_gesture = max(detected_gestures, key=lambda x: x['confidence'])
                self.current_gesture = best_gesture['gesture']
                self.gesture_confidence = best_gesture['confidence']
                
                # Add to history for stability
                self.gesture_history.append(self.current_gesture)
                if len(self.gesture_history) > 10:
                    self.gesture_history.pop(0)
            
            return {
                'detected_gesture': self.current_gesture,
                'confidence': self.gesture_confidence,
                'all_gestures': detected_gestures,
                'hands_detected': len(results.multi_hand_landmarks) if results.multi_hand_landmarks else 0
            }
            
        except Exception as e:
            print(f"Error processing frame: {e}")
            return {'error': str(e)}
    
    def get_stable_gesture(self):
        """Get the most stable gesture from recent history"""
        if not self.gesture_history:
            return None
            
        # Count occurrences of each gesture in recent history
        gesture_counts = {}
        recent_history = self.gesture_history[-5:]  # Last 5 detections
        
        for gesture in recent_history:
            gesture_counts[gesture] = gesture_counts.get(gesture, 0) + 1
        
        # Return most frequent gesture if it appears at least 3 times
        if gesture_counts:
            most_frequent = max(gesture_counts.items(), key=lambda x: x[1])
            if most_frequent[1] >= 3:
                return most_frequent[0]
        
        return None

# Initialize detector
detector = SignLanguageDetector()

@app.route('/detect', methods=['POST'])
def detect_sign():
    """API endpoint for sign language detection"""
    try:
        data = request.json
        frame_data = data.get('frame')
        
        if not frame_data:
            return jsonify({'error': 'No frame data provided'}), 400
        
        result = detector.process_frame(frame_data)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_text', methods=['GET'])
def get_detected_text():
    """Get stable detected gesture as text"""
    try:
        stable_gesture = detector.get_stable_gesture()
        
        # Convert gesture to readable text
        gesture_text_map = {
            'hello': 'Hello',
            'thank_you': 'Thank you',
            'please': 'Please',
            'yes': 'Yes',
            'no': 'No',
            'good': 'Good',
            'bad': 'Bad',
            'help': 'Help',
            'water': 'Water',
            'food': 'Food'
        }
        
        if stable_gesture and stable_gesture in gesture_text_map:
            return jsonify({
                'text': gesture_text_map[stable_gesture],
                'gesture': stable_gesture,
                'confidence': detector.gesture_confidence
            })
        else:
            return jsonify({
                'text': '',
                'gesture': None,
                'confidence': 0.0
            })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'sign_language_detector'})

if __name__ == '__main__':
    print("Starting Sign Language Detection API...")
    print("Available gestures:", list(detector.gesture_mappings.keys()))
    app.run(host='0.0.0.0', port=5000, debug=True)
