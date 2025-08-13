import cv2
import numpy as np
import mediapipe as mp
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import pickle
import os
from collections import deque
import json
import time

class AdvancedSignLanguageDetector:
    def __init__(self):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        
        # Enhanced gesture database with more signs
        self.gesture_database = {
            'hello': {'hand_positions': [(0.5, 0.3), (0.6, 0.4)], 'movement': 'wave'},
            'thank_you': {'hand_positions': [(0.5, 0.4)], 'movement': 'forward'},
            'please': {'hand_positions': [(0.5, 0.4)], 'movement': 'circular'},
            'yes': {'hand_positions': [(0.5, 0.3)], 'movement': 'nod'},
            'no': {'hand_positions': [(0.4, 0.3), (0.6, 0.3)], 'movement': 'shake'},
            'sorry': {'hand_positions': [(0.5, 0.4)], 'movement': 'circular_chest'},
            'help': {'hand_positions': [(0.4, 0.4), (0.6, 0.4)], 'movement': 'up'},
            'good': {'hand_positions': [(0.5, 0.3)], 'movement': 'thumbs_up'},
            'bad': {'hand_positions': [(0.5, 0.3)], 'movement': 'thumbs_down'},
            'love': {'hand_positions': [(0.5, 0.4)], 'movement': 'heart'},
            'water': {'hand_positions': [(0.5, 0.3)], 'movement': 'drink'},
            'eat': {'hand_positions': [(0.5, 0.3)], 'movement': 'to_mouth'},
            'more': {'hand_positions': [(0.4, 0.4), (0.6, 0.4)], 'movement': 'together'},
            'stop': {'hand_positions': [(0.5, 0.4)], 'movement': 'palm_out'},
            'go': {'hand_positions': [(0.5, 0.4)], 'movement': 'point_forward'}
        }
        
        # Movement tracking
        self.movement_history = deque(maxlen=30)
        self.gesture_history = deque(maxlen=10)
        
        # AI model for gesture classification
        self.classifier = None
        self.scaler = StandardScaler()
        self.load_or_train_model()
        
    def load_or_train_model(self):
        """Load existing model or train a new one"""
        model_path = 'gesture_model.pkl'
        scaler_path = 'gesture_scaler.pkl'
        
        if os.path.exists(model_path) and os.path.exists(scaler_path):
            with open(model_path, 'rb') as f:
                self.classifier = pickle.load(f)
            with open(scaler_path, 'rb') as f:
                self.scaler = pickle.load(f)
        else:
            self.train_gesture_model()
    
    def train_gesture_model(self):
        """Train a machine learning model for gesture recognition"""
        # Generate synthetic training data based on gesture database
        X, y = self.generate_training_data()
        
        self.classifier = RandomForestClassifier(
            n_estimators=100,
            random_state=42,
            max_depth=10
        )
        
        X_scaled = self.scaler.fit_transform(X)
        self.classifier.fit(X_scaled, y)
        
        # Save the trained model
        with open('gesture_model.pkl', 'wb') as f:
            pickle.dump(self.classifier, f)
        with open('gesture_scaler.pkl', 'wb') as f:
            pickle.dump(self.scaler, f)
    
    def generate_training_data(self):
        """Generate synthetic training data for gestures"""
        X = []
        y = []
        
        for gesture, data in self.gesture_database.items():
            for _ in range(50):  # Generate 50 samples per gesture
                features = self.create_synthetic_features(data)
                X.append(features)
                y.append(gesture)
        
        return np.array(X), np.array(y)
    
    def create_synthetic_features(self, gesture_data):
        """Create synthetic feature vector for a gesture"""
        features = []
        
        # Hand position features
        for pos in gesture_data['hand_positions']:
            features.extend([pos[0] + np.random.normal(0, 0.05), 
                           pos[1] + np.random.normal(0, 0.05)])
        
        # Pad to consistent length
        while len(features) < 10:
            features.extend([0, 0])
        
        # Movement features
        movement_encoding = {
            'wave': [1, 0, 0, 0, 0],
            'forward': [0, 1, 0, 0, 0],
            'circular': [0, 0, 1, 0, 0],
            'nod': [0, 0, 0, 1, 0],
            'shake': [0, 0, 0, 0, 1],
            'static': [0, 0, 0, 0, 0]
        }
        
        movement = gesture_data.get('movement', 'static')
        features.extend(movement_encoding.get(movement, [0, 0, 0, 0, 0]))
        
        return features[:15]  # Fixed feature length
    
    def extract_hand_features(self, landmarks):
        """Extract comprehensive features from hand landmarks"""
        if not landmarks:
            return np.zeros(63)  # 21 landmarks * 3 coordinates
        
        features = []
        for landmark in landmarks.landmark:
            features.extend([landmark.x, landmark.y, landmark.z])
        
        return np.array(features)
    
    def detect_movement_pattern(self, current_landmarks):
        """Detect movement patterns over time"""
        if not current_landmarks:
            return 'static'
        
        # Add current position to history
        wrist_pos = (current_landmarks.landmark[0].x, current_landmarks.landmark[0].y)
        self.movement_history.append(wrist_pos)
        
        if len(self.movement_history) < 10:
            return 'static'
        
        # Analyze movement pattern
        positions = list(self.movement_history)
        
        # Calculate movement metrics
        total_movement = sum(
            np.sqrt((positions[i][0] - positions[i-1][0])**2 + 
                   (positions[i][1] - positions[i-1][1])**2)
            for i in range(1, len(positions))
        )
        
        # Determine movement type
        if total_movement > 0.3:
            return 'wave'
        elif total_movement > 0.15:
            return 'circular'
        else:
            return 'static'
    
    def process_frame(self, frame):
        """Process a single frame for sign language detection"""
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Detect hands
        hand_results = self.hands.process(rgb_frame)
        
        # Detect pose
        pose_results = self.pose.process(rgb_frame)
        
        detected_signs = []
        confidence_scores = []
        
        if hand_results.multi_hand_landmarks:
            for hand_landmarks in hand_results.multi_hand_landmarks:
                # Extract features
                features = self.extract_hand_features(hand_landmarks)
                
                # Detect movement
                movement = self.detect_movement_pattern(hand_landmarks)
                
                # Create feature vector for classification
                classification_features = features[:10].tolist()  # First 10 features
                movement_encoding = {
                    'wave': [1, 0, 0, 0, 0],
                    'circular': [0, 1, 0, 0, 0],
                    'static': [0, 0, 1, 0, 0]
                }
                classification_features.extend(movement_encoding.get(movement, [0, 0, 0, 0, 0]))
                
                # Pad to correct length
                while len(classification_features) < 15:
                    classification_features.append(0)
                
                # Classify gesture
                if self.classifier:
                    features_scaled = self.scaler.transform([classification_features[:15]])
                    prediction = self.classifier.predict(features_scaled)[0]
                    confidence = max(self.classifier.predict_proba(features_scaled)[0])
                    
                    if confidence > 0.6:  # Confidence threshold
                        detected_signs.append(prediction)
                        confidence_scores.append(confidence)
        
        # Stabilize detection with history
        if detected_signs:
            most_confident = detected_signs[confidence_scores.index(max(confidence_scores))]
            self.gesture_history.append(most_confident)
            
            # Return most frequent gesture in recent history
            if len(self.gesture_history) >= 3:
                from collections import Counter
                most_common = Counter(list(self.gesture_history)[-5:]).most_common(1)
                if most_common and most_common[0][1] >= 2:  # Appeared at least twice
                    return {
                        'detected_sign': most_common[0][0],
                        'confidence': max(confidence_scores),
                        'timestamp': time.time()
                    }
        
        return None
    
    def get_sign_description(self, sign):
        """Get human-readable description of the sign"""
        descriptions = {
            'hello': 'Hello - A friendly greeting',
            'thank_you': 'Thank you - Expressing gratitude',
            'please': 'Please - Making a polite request',
            'yes': 'Yes - Affirmative response',
            'no': 'No - Negative response',
            'sorry': 'Sorry - Expressing apology',
            'help': 'Help - Requesting assistance',
            'good': 'Good - Positive evaluation',
            'bad': 'Bad - Negative evaluation',
            'love': 'Love - Expressing affection',
            'water': 'Water - Requesting water',
            'eat': 'Eat - Related to eating',
            'more': 'More - Requesting additional',
            'stop': 'Stop - Requesting to halt',
            'go': 'Go - Indicating movement'
        }
        return descriptions.get(sign, f'{sign.title()} - Sign language gesture')

# Enhanced API integration
if __name__ == "__main__":
    detector = AdvancedSignLanguageDetector()
    print("Advanced Sign Language Detector initialized successfully!")
    print(f"Trained to recognize {len(detector.gesture_database)} different signs")
