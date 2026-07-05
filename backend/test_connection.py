"""
Test script to verify Flask backend is running and ML model is connected
"""
import requests
import json

BASE_URL = "http://127.0.0.1:5000"

def test_server_running():
    """Check if Flask server is running"""
    try:
        response = requests.get(f"{BASE_URL}/")
        print("✓ Flask server is RUNNING")
        print(f"  Response: {response.json()}")
        return True
    except requests.exceptions.ConnectionError:
        print("✗ Flask server is NOT RUNNING")
        print("  Please start the server: py -3.12 app.py")
        return False

def test_health_check():
    """Check if model is loaded"""
    try:
        response = requests.get(f"{BASE_URL}/health")
        data = response.json()
        print(f"\n✓ Health check passed")
        print(f"  Flask: {data['flask']}")
        print(f"  Model: {data['model']}")
        return data['model'] == 'loaded'
    except Exception as e:
        print(f"✗ Health check failed: {e}")
        return False

def test_prediction():
    """Test the ML model prediction"""
    test_data = {
        "age": 50,
        "gender": "Male",
        "cholesterol": 200,
        "blood_pressure": 120,
        "diabetes": 0,
        "smoking_status": "Never Smoked"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/predict",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n✓ ML Model is working correctly!")
            print(f"  Input: {json.dumps(test_data, indent=2)}")
            print(f"  Prediction: {data['disease']}")
            print(f"  Risk Level: {data['risk_percentage']:.1f}%")
            print(f"  Confidence: {data['confidence']:.1f}%")
            print(f"  Recommendations:")
            for rec in data['recommendations']:
                print(f"    - {rec}")
            return True
        else:
            print(f"✗ Prediction failed: {response.json()}")
            return False
    except Exception as e:
        print(f"✗ Prediction error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("Testing Flask Backend & ML Model Connection")
    print("=" * 50)
    
    # Test 1: Server running
    server_ok = test_server_running()
    
    if not server_ok:
        exit(1)
    
    # Test 2: Health check
    model_ok = test_health_check()
    
    if not model_ok:
        print("\n✗ Model is NOT loaded!")
        exit(1)
    
    # Test 3: Make prediction
    pred_ok = test_prediction()
    
    print("\n" + "=" * 50)
    if server_ok and model_ok and pred_ok:
        print("✓ ALL TESTS PASSED - Backend is working!")
    else:
        print("✗ Some tests failed")
    print("=" * 50)
