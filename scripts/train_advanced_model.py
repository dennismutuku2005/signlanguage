import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix
import pickle
import json

def create_comprehensive_training_data():
    """Create comprehensive training data for sign language recognition"""
    
    # Enhanced gesture database with more detailed features
    gesture_patterns = {
        'hello': {
            'hand_shape': [1, 0, 0, 0, 0],  # Open hand
            'movement': [1, 0, 0, 0, 0],    # Wave
            'position': [0.5, 0.3],         # Center-high
            'orientation': [0, 1, 0],       # Palm out
            'fingers': [1, 1, 1, 1, 1]      # All extended
        },
        'thank_you': {
            'hand_shape': [1, 0, 0, 0, 0],
            'movement': [0, 1, 0, 0, 0],    # Forward
            'position': [0.5, 0.4],
            'orientation': [0, 1, 0],
            'fingers': [1, 1, 1, 1, 1]
        },
        'please': {
            'hand_shape': [1, 0, 0, 0, 0],
            'movement': [0, 0, 1, 0, 0],    # Circular
            'position': [0.5, 0.4],
            'orientation': [0, 0, 1],       # Palm down
            'fingers': [1, 1, 1, 1, 1]
        },
        'yes': {
            'hand_shape': [0, 1, 0, 0, 0],  # Fist
            'movement': [0, 0, 0, 1, 0],    # Nod
            'position': [0.5, 0.3],
            'orientation': [1, 0, 0],       # Palm side
            'fingers': [0, 0, 0, 0, 0]
        },
        'no': {
            'hand_shape': [0, 0, 1, 0, 0],  # Point
            'movement': [0, 0, 0, 0, 1],    # Shake
            'position': [0.5, 0.3],
            'orientation': [1, 0, 0],
            'fingers': [0, 1, 0, 0, 0]
        },
        'sorry': {
            'hand_shape': [0, 1, 0, 0, 0],
            'movement': [0, 0, 1, 0, 0],
            'position': [0.5, 0.4],
            'orientation': [0, 0, 1],
            'fingers': [0, 0, 0, 0, 0]
        },
        'help': {
            'hand_shape': [1, 0, 0, 0, 0],
            'movement': [0, 0, 0, 0, 0],    # Static
            'position': [0.4, 0.4],
            'orientation': [0, 1, 0],
            'fingers': [1, 1, 1, 1, 1]
        },
        'good': {
            'hand_shape': [0, 0, 0, 1, 0],  # Thumbs up
            'movement': [0, 0, 0, 0, 0],
            'position': [0.5, 0.3],
            'orientation': [0, 1, 0],
            'fingers': [1, 0, 0, 0, 0]
        },
        'bad': {
            'hand_shape': [0, 0, 0, 0, 1],  # Thumbs down
            'movement': [0, 0, 0, 0, 0],
            'position': [0.5, 0.3],
            'orientation': [0, 1, 0],
            'fingers': [1, 0, 0, 0, 0]
        },
        'love': {
            'hand_shape': [0, 0, 1, 0, 0],
            'movement': [0, 0, 0, 0, 0],
            'position': [0.5, 0.4],
            'orientation': [0, 1, 0],
            'fingers': [1, 0, 1, 0, 1]      # I love you sign
        }
    }
    
    X = []
    y = []
    
    # Generate multiple samples for each gesture with variations
    for gesture, pattern in gesture_patterns.items():
        for _ in range(200):  # 200 samples per gesture
            features = []
            
            # Add hand shape features with noise
            hand_shape = pattern['hand_shape'].copy()
            for i in range(len(hand_shape)):
                hand_shape[i] += np.random.normal(0, 0.1)
            features.extend(hand_shape)
            
            # Add movement features with noise
            movement = pattern['movement'].copy()
            for i in range(len(movement)):
                movement[i] += np.random.normal(0, 0.1)
            features.extend(movement)
            
            # Add position features with noise
            position = pattern['position'].copy()
            position[0] += np.random.normal(0, 0.05)
            position[1] += np.random.normal(0, 0.05)
            features.extend(position)
            
            # Add orientation features with noise
            orientation = pattern['orientation'].copy()
            for i in range(len(orientation)):
                orientation[i] += np.random.normal(0, 0.1)
            features.extend(orientation)
            
            # Add finger features with noise
            fingers = pattern['fingers'].copy()
            for i in range(len(fingers)):
                fingers[i] += np.random.normal(0, 0.1)
            features.extend(fingers)
            
            X.append(features)
            y.append(gesture)
    
    return np.array(X), np.array(y)

def train_multiple_models():
    """Train and compare multiple machine learning models"""
    
    print("Generating comprehensive training data...")
    X, y = create_comprehensive_training_data()
    
    print(f"Training data shape: {X.shape}")
    print(f"Number of classes: {len(np.unique(y))}")
    print(f"Classes: {np.unique(y)}")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Define models to test
    models = {
        'Random Forest': RandomForestClassifier(
            n_estimators=200,
            max_depth=15,
            random_state=42,
            min_samples_split=5,
            min_samples_leaf=2
        ),
        'Gradient Boosting': GradientBoostingClassifier(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=6,
            random_state=42
        ),
        'SVM': SVC(
            kernel='rbf',
            C=1.0,
            gamma='scale',
            probability=True,
            random_state=42
        ),
        'Neural Network': MLPClassifier(
            hidden_layer_sizes=(100, 50),
            activation='relu',
            solver='adam',
            alpha=0.001,
            max_iter=1000,
            random_state=42
        )
    }
    
    best_model = None
    best_score = 0
    best_name = ""
    
    print("\nTraining and evaluating models...")
    
    for name, model in models.items():
        print(f"\nTraining {name}...")
        
        # Train model
        model.fit(X_train_scaled, y_train)
        
        # Cross-validation score
        cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5)
        mean_cv_score = cv_scores.mean()
        
        # Test score
        test_score = model.score(X_test_scaled, y_test)
        
        print(f"{name} - CV Score: {mean_cv_score:.4f} (+/- {cv_scores.std() * 2:.4f})")
        print(f"{name} - Test Score: {test_score:.4f}")
        
        # Predictions for detailed analysis
        y_pred = model.predict(X_test_scaled)
        
        print(f"\nClassification Report for {name}:")
        print(classification_report(y_test, y_pred))
        
        if test_score > best_score:
            best_score = test_score
            best_model = model
            best_name = name
    
    print(f"\nBest model: {best_name} with test score: {best_score:.4f}")
    
    # Save the best model and scaler
    with open('scripts/best_gesture_model.pkl', 'wb') as f:
        pickle.dump(best_model, f)
    
    with open('scripts/best_gesture_scaler.pkl', 'wb') as f:
        pickle.dump(scaler, f)
    
    # Save model metadata
    metadata = {
        'model_name': best_name,
        'test_score': best_score,
        'feature_count': X.shape[1],
        'classes': list(np.unique(y)),
        'training_samples': len(X_train),
        'test_samples': len(X_test)
    }
    
    with open('scripts/model_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"\nBest model saved as 'best_gesture_model.pkl'")
    print(f"Scaler saved as 'best_gesture_scaler.pkl'")
    print(f"Metadata saved as 'model_metadata.json'")
    
    return best_model, scaler, metadata

if __name__ == "__main__":
    model, scaler, metadata = train_multiple_models()
    print("\nTraining completed successfully!")
    print(f"Final model accuracy: {metadata['test_score']:.4f}")
