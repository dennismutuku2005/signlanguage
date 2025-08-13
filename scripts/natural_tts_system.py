import pyttsx3
import threading
import queue
import time
import json
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import tempfile
import base64
import wave
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, filtfilt
import io

class NaturalTTSSystem:
    def __init__(self):
        self.engine = pyttsx3.init()
        self.speech_queue = queue.Queue()
        self.is_speaking = False
        self.speech_thread = None
        self.setup_natural_voice()
        
        # Voice customization settings
        self.voice_settings = {
            'rate': 180,        # Words per minute (slower for more natural)
            'volume': 0.9,      # Volume level
            'pitch': 0,         # Pitch adjustment
            'pause_duration': 0.3  # Pause between sentences
        }
        
        # Emotional context for different signs
        self.emotional_contexts = {
            'hello': {'rate': 200, 'volume': 0.95, 'tone': 'friendly'},
            'thank_you': {'rate': 160, 'volume': 0.85, 'tone': 'grateful'},
            'sorry': {'rate': 140, 'volume': 0.8, 'tone': 'apologetic'},
            'help': {'rate': 180, 'volume': 0.9, 'tone': 'urgent'},
            'please': {'rate': 160, 'volume': 0.85, 'tone': 'polite'},
            'love': {'rate': 150, 'volume': 0.9, 'tone': 'warm'},
            'good': {'rate': 190, 'volume': 0.9, 'tone': 'positive'},
            'bad': {'rate': 170, 'volume': 0.85, 'tone': 'concerned'}
        }
        
        self.start_speech_worker()
    
    def setup_natural_voice(self):
        """Configure the TTS engine for more natural speech"""
        voices = self.engine.getProperty('voices')
        
        # Try to find a more natural-sounding voice
        preferred_voices = ['zira', 'david', 'mark', 'hazel']
        selected_voice = None
        
        for voice in voices:
            voice_name = voice.name.lower()
            for preferred in preferred_voices:
                if preferred in voice_name:
                    selected_voice = voice.id
                    break
            if selected_voice:
                break
        
        if selected_voice:
            self.engine.setProperty('voice', selected_voice)
        
        # Set initial properties for natural speech
        self.engine.setProperty('rate', self.voice_settings['rate'])
        self.engine.setProperty('volume', self.voice_settings['volume'])
    
    def enhance_text_for_speech(self, text, sign_type=None):
        """Enhance text to sound more natural when spoken"""
        
        # Add context-appropriate expressions
        enhanced_text = text
        
        if sign_type:
            context = self.emotional_contexts.get(sign_type, {})
            tone = context.get('tone', 'neutral')
            
            # Add natural expressions based on tone
            if tone == 'friendly':
                enhanced_text = f"Hello there! {enhanced_text}"
            elif tone == 'grateful':
                enhanced_text = f"{enhanced_text}. I really appreciate it."
            elif tone == 'apologetic':
                enhanced_text = f"I'm {enhanced_text}. Please forgive me."
            elif tone == 'urgent':
                enhanced_text = f"I need {enhanced_text}. Can you assist me?"
            elif tone == 'polite':
                enhanced_text = f"{enhanced_text}. Would that be possible?"
            elif tone == 'warm':
                enhanced_text = f"I {enhanced_text} you so much."
            elif tone == 'positive':
                enhanced_text = f"That's {enhanced_text}! Great job!"
            elif tone == 'concerned':
                enhanced_text = f"That's {enhanced_text}. I'm worried about this."
        
        # Add natural pauses and emphasis
        enhanced_text = enhanced_text.replace('.', '... ')
        enhanced_text = enhanced_text.replace('!', '! ')
        enhanced_text = enhanced_text.replace('?', '? ')
        
        return enhanced_text
    
    def apply_voice_context(self, sign_type):
        """Apply voice settings based on the type of sign detected"""
        if sign_type in self.emotional_contexts:
            context = self.emotional_contexts[sign_type]
            self.engine.setProperty('rate', context.get('rate', self.voice_settings['rate']))
            self.engine.setProperty('volume', context.get('volume', self.voice_settings['volume']))
        else:
            # Reset to default settings
            self.engine.setProperty('rate', self.voice_settings['rate'])
            self.engine.setProperty('volume', self.voice_settings['volume'])
    
    def speak_text(self, text, sign_type=None, priority='normal'):
        """Add text to speech queue with priority and context"""
        enhanced_text = self.enhance_text_for_speech(text, sign_type)
        
        speech_item = {
            'text': enhanced_text,
            'sign_type': sign_type,
            'priority': priority,
            'timestamp': time.time()
        }
        
        # Handle priority - urgent messages go to front
        if priority == 'urgent':
            # Clear queue and add urgent message
            while not self.speech_queue.empty():
                try:
                    self.speech_queue.get_nowait()
                except queue.Empty:
                    break
        
        self.speech_queue.put(speech_item)
    
    def start_speech_worker(self):
        """Start the background speech worker thread"""
        if self.speech_thread is None or not self.speech_thread.is_alive():
            self.speech_thread = threading.Thread(target=self._speech_worker, daemon=True)
            self.speech_thread.start()
    
    def _speech_worker(self):
        """Background worker to process speech queue"""
        while True:
            try:
                if not self.speech_queue.empty():
                    speech_item = self.speech_queue.get(timeout=1)
                    
                    if not self.is_speaking:
                        self.is_speaking = True
                        
                        # Apply voice context
                        self.apply_voice_context(speech_item['sign_type'])
                        
                        # Speak the text
                        self.engine.say(speech_item['text'])
                        self.engine.runAndWait()
                        
                        # Add natural pause between speeches
                        time.sleep(self.voice_settings['pause_duration'])
                        
                        self.is_speaking = False
                
                time.sleep(0.1)  # Small delay to prevent busy waiting
                
            except queue.Empty:
                continue
            except Exception as e:
                print(f"Speech worker error: {e}")
                self.is_speaking = False
    
    def generate_audio_file(self, text, sign_type=None):
        """Generate audio file for the given text"""
        try:
            enhanced_text = self.enhance_text_for_speech(text, sign_type)
            
            # Apply voice context
            self.apply_voice_context(sign_type)
            
            # Create temporary file
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_filename = temp_file.name
            
            # Save to file
            self.engine.save_to_file(enhanced_text, temp_filename)
            self.engine.runAndWait()
            
            # Read the file and encode as base64
            with open(temp_filename, 'rb') as audio_file:
                audio_data = audio_file.read()
                audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            
            # Clean up temporary file
            os.unlink(temp_filename)
            
            return audio_base64
            
        except Exception as e:
            print(f"Error generating audio file: {e}")
            return None
    
    def get_voice_info(self):
        """Get information about available voices"""
        voices = self.engine.getProperty('voices')
        voice_info = []
        
        for voice in voices:
            voice_info.append({
                'id': voice.id,
                'name': voice.name,
                'languages': getattr(voice, 'languages', []),
                'gender': getattr(voice, 'gender', 'unknown'),
                'age': getattr(voice, 'age', 'unknown')
            })
        
        return voice_info
    
    def set_voice_settings(self, rate=None, volume=None, voice_id=None):
        """Update voice settings"""
        if rate is not None:
            self.voice_settings['rate'] = rate
            self.engine.setProperty('rate', rate)
        
        if volume is not None:
            self.voice_settings['volume'] = volume
            self.engine.setProperty('volume', volume)
        
        if voice_id is not None:
            self.engine.setProperty('voice', voice_id)
        
        return self.voice_settings

# Flask API for TTS system
app = Flask(__name__)
CORS(app)

# Initialize TTS system
tts_system = NaturalTTSSystem()

@app.route('/api/speak', methods=['POST'])
def speak_text():
    """Speak text with natural voice"""
    try:
        data = request.json
        text = data.get('text', '')
        sign_type = data.get('sign_type')
        priority = data.get('priority', 'normal')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        tts_system.speak_text(text, sign_type, priority)
        
        return jsonify({
            'success': True,
            'message': 'Text added to speech queue',
            'enhanced_text': tts_system.enhance_text_for_speech(text, sign_type)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-audio', methods=['POST'])
def generate_audio():
    """Generate audio file for text"""
    try:
        data = request.json
        text = data.get('text', '')
        sign_type = data.get('sign_type')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        audio_base64 = tts_system.generate_audio_file(text, sign_type)
        
        if audio_base64:
            return jsonify({
                'success': True,
                'audio_data': audio_base64,
                'format': 'wav'
            })
        else:
            return jsonify({'error': 'Failed to generate audio'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/voice-settings', methods=['GET', 'POST'])
def voice_settings():
    """Get or update voice settings"""
    if request.method == 'GET':
        return jsonify({
            'current_settings': tts_system.voice_settings,
            'available_voices': tts_system.get_voice_info(),
            'emotional_contexts': tts_system.emotional_contexts
        })
    
    elif request.method == 'POST':
        try:
            data = request.json
            updated_settings = tts_system.set_voice_settings(
                rate=data.get('rate'),
                volume=data.get('volume'),
                voice_id=data.get('voice_id')
            )
            
            return jsonify({
                'success': True,
                'updated_settings': updated_settings
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/api/tts-status', methods=['GET'])
def tts_status():
    """Get TTS system status"""
    return jsonify({
        'is_speaking': tts_system.is_speaking,
        'queue_size': tts_system.speech_queue.qsize(),
        'voice_settings': tts_system.voice_settings,
        'available_contexts': list(tts_system.emotional_contexts.keys())
    })

@app.route('/api/clear-speech-queue', methods=['POST'])
def clear_speech_queue():
    """Clear the speech queue"""
    while not tts_system.speech_queue.empty():
        try:
            tts_system.speech_queue.get_nowait()
        except queue.Empty:
            break
    
    return jsonify({'success': True, 'message': 'Speech queue cleared'})

if __name__ == '__main__':
    print("Starting Natural Text-to-Speech System...")
    print("Available endpoints:")
    print("  POST /api/speak - Speak text with natural voice")
    print("  POST /api/generate-audio - Generate audio file")
    print("  GET/POST /api/voice-settings - Manage voice settings")
    print("  GET /api/tts-status - Get system status")
    print("  POST /api/clear-speech-queue - Clear speech queue")
    
    app.run(host='0.0.0.0', port=5002, debug=True)
