# Flask Backend Setup Guide - Heart Disease Risk Prediction

## Required Flask Endpoint

Your React frontend expects the following Flask endpoint for ML predictions:

### POST `/predict`

**Request Body:**
```json
{
  "age": 50,
  "gender": "Male",
  "cholesterol": 200,
  "blood_pressure": 120,
  "diabetes": 1,
  "smoking_status": "Current Smoker"
}
```

**Response (Success - 200 OK):**
```json
{
  "risk_percentage": 85.0,
  "confidence": 92.5,
  "recommendations": [
    "Consult with a cardiologist immediately",
    "Consider lifestyle changes including diet and exercise",
    "Monitor blood pressure and cholesterol regularly",
    "Take prescribed medications as directed"
  ]
}
```

**Response (Error - 400 Bad Request):**
```json
{
  "message": "Invalid input data"
}
```

## Python Flask Implementation Example

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
# import your ML model here

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Load your trained ML model
# model = load_model('path_to_your_model')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['age', 'gender', 'cholesterol', 'blood_pressure', 'diabetes', 'smoking_status']
        if not all(field in data for field in required_fields):
            return jsonify({'message': 'Missing required fields'}), 400
        
        # Prepare features for your ML model
        features = np.array([[
            data['age'],
            1 if data['gender'] == 'Male' else 0,  # Encode gender
            data['cholesterol'],
            data['blood_pressure'],
            data['diabetes'],
            encode_smoking_status(data['smoking_status'])  # Encode smoking status
        ]])
        
        # Make prediction
        risk_score = model.predict(features)[0]  # Your model prediction
        risk_percentage = risk_score * 100  # Convert to percentage
        confidence = 92.5  # Your model's confidence
        
        # Prepare recommendations based on risk level
        recommendations = get_recommendations(risk_percentage, data)
        
        return jsonify({
            'risk_percentage': float(risk_percentage),
            'confidence': float(confidence),
            'recommendations': recommendations
        }), 200
        
    except Exception as e:
        return jsonify({'message': str(e)}), 500

def encode_smoking_status(status):
    """Encode smoking status to numeric value"""
    mapping = {
        'Never Smoked': 0,
        'Former Smoker': 1,
        'Current Smoker': 2
    }
    return mapping.get(status, 0)

def get_recommendations(risk_percentage, data):
    """Generate recommendations based on risk level and health data"""
    recommendations = []
    
    if risk_percentage > 70:
        recommendations.append("Consult with a cardiologist immediately")
    elif risk_percentage > 40:
        recommendations.append("Schedule a medical checkup with your doctor")
    
    recommendations.append("Consider lifestyle changes including diet and exercise")
    recommendations.append("Monitor blood pressure and cholesterol regularly")
    recommendations.append("Take prescribed medications as directed")
    
    # Additional recommendations based on individual factors
    if data['cholesterol'] > 240:
        recommendations.insert(1, "Your cholesterol level is high - focus on dietary changes")
    
    if int(data['blood_pressure']) > 140:
        recommendations.insert(1, "Your blood pressure is elevated - monitor closely")
    
    if data['diabetes'] == 1:
        recommendations.insert(1, "Manage your diabetes carefully as it increases heart disease risk")
    
    if data['smoking_status'] == 'Current Smoker':
        recommendations.insert(1, "Quitting smoking is critical to reducing your risk")
    
    return recommendations

if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

## Frontend Integration

The frontend will:
1. Send POST request to the Railway backend URL configured in `REACT_APP_API_URL`.
2. Display the risk percentage with color coding:
   - **RED** (HIGH RISK): > 70%
   - **ORANGE** (MEDIUM RISK): 40-70%
   - **GREEN** (LOW RISK): < 40%
3. Show recommendations and confidence score

## How to Test

1. Start your Flask server:
   ```bash
   python app.py
   ```

2. In the React app, navigate to Dashboard → "Start Assessment"

3. Fill in the health information:
   - Age: 50
   - Gender: Male
   - Cholesterol: 200
   - Blood Pressure: 120
   - Diabetes: No
   - Smoking Status: Never Smoked

4. Click "Get Risk Assessment"

5. You should see the prediction results page

## Troubleshooting

- **Connection refused**: Make sure Flask is running on port 5000
- **CORS error**: Ensure you have `flask-cors` installed (`pip install flask-cors`)
- **Invalid response**: Check that your endpoint returns the exact JSON structure above
- **Model prediction fails**: Verify your ML model input dimensions match the feature array

## Next Steps

1. Integrate your trained ML model
2. Store assessment history in database
3. Create history/medical records page
4. Add more detailed health parameters if needed
