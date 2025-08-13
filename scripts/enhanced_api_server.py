from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
from advanced_sign_detector import AdvancedSignLanguageDetector
import threading
import time
from collections import deque
import json

app = Flask(__name__)
CORS(app)

# Initialize the enhanced detector
detector = AdvancedSignLanguageDetector()

# Global state for continuous detection
detection_active = False
recent_detections = deque(maxlen=50)
detection_thread = None

class DetectionManager:
    def __init__(self):
        self.active = False
        self.current_sign = None
        self.confidence = 0
        self.detection_count = {}
        self.last_detection_time = 0
        
    def add_detection(self, sign, confidence):
        """Add a new detection with confidence scoring"""
        current_time = time.time()
        
        # Update detection count
        if sign not in self.detection_count:
            self.detection_count[sign] = 0
        self.detection_count[sign] += 1
        
        # Update current sign if confidence is high enough
        if confidence > 0.7 and (current_time - self.last_detection_time) > 1.0:
            self.current_sign = sign
            self.confidence = confidence
            self.last_detection_time = current_time
            
            # Add to recent detections
            recent_detections.append({
                'sign': sign,
                'confidence': confidence,
                'timestamp': current_time,
                'description': detector.get_sign_description(sign)
            })
            
            return True
        return False
    
    def get_stats(self):
        """Get detection statistics"""
        return {
            'total_detections': sum(self.detection_count.values()),
            'unique_signs': len(self.detection_count),
            'most_detected': max(self.detection_count.items(), key=lambda x: x[1]) if self.detection_count else None,
            'current_sign': self.current_sign,
            'confidence': self.confidence
        }

detection_manager = DetectionManager()

@app.route('/api/detect', methods=['POST'])
def detect_sign():
    """Enhanced sign detection endpoint"""
    try:
        data = request.json
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
        
        # Decode base64 image
        image_data = data['image'].split(',')[1]
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid image data'}), 400
        
        # Process frame with enhanced detector
        result = detector.process_frame(frame)
        
        if result:
            # Add to detection manager
            is_new = detection_manager.add_detection(
                result['detected_sign'], 
                result['confidence']
            )
            
            return jsonify({
                'success': True,
                'detected_sign': result['detected_sign'],
                'confidence': float(result['confidence']),
                'description': detector.get_sign_description(result['detected_sign']),
                'is_new_detection': is_new,
                'timestamp': result['timestamp']
            })
        else:
            return jsonify({
                'success': True,
                'detected_sign': None,
                'confidence': 0,
                'description': 'No sign detected'
            })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/recent-detections', methods=['GET'])
def get_recent_detections():
    """Get recent sign detections"""
    return jsonify({
        'detections': list(recent_detections),
        'count': len(recent_detections)
    })

@app.route('/api/stats', methods=['GET'])
def get_detection_stats():
    """Get detection statistics"""
    stats = detection_manager.get_stats()
    return jsonify(stats)

@app.route('/api/clear-history', methods=['POST'])
def clear_detection_history():
    """Clear detection history"""
    recent_detections.clear()
    detection_manager.detection_count.clear()
    detection_manager.current_sign = None
    detection_manager.confidence = 0
    
    return jsonify({'success': True, 'message': 'Detection history cleared'})

@app.route('/api/supported-signs', methods=['GET'])
def get_supported_signs():
    """Get list of supported signs"""
    signs = []
    for sign, data in detector.gesture_database.items():
        signs.append({
            'sign': sign,
            'description': detector.get_sign_description(sign),
            'movement_type': data.get('movement', 'static')
        })
    
    return jsonify({
        'signs': signs,
        'total_count': len(signs)
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """Enhanced health check"""
    return jsonify({
        'status': 'healthy',
        'detector_ready': detector is not None,
        'model_loaded': detector.classifier is not None,
        'supported_signs': len(detector.gesture_database),
        'recent_detections': len(recent_detections),
        'uptime': time.time()
    })

if __name__ == '__main__':
    print("Starting Enhanced Sign Language Detection API...")
    print(f"Supporting {len(detector.gesture_database)} different signs")
    print("API endpoints available:")
    print("  POST /api/detect - Detect signs in image")
    print("  GET /api/recent-detections - Get recent detections")
    print("  GET /api/stats - Get detection statistics")
    print("  GET /api/supported-signs - Get supported signs list")
    print("  GET /api/health - Health check")
    
    app.run(host='0.0.0.0', port=5001, debug=True)
