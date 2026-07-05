import os
import sys

PROJECT_DIR = "/home/iamshahd03/CardioPredict"

if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

os.environ.setdefault(
    "FIREBASE_DATABASE_URL",
    "https://heart-7d7ce-default-rtdb.asia-southeast1.firebasedatabase.app/"
)

# Set these in the PythonAnywhere WSGI editor before importing the app:
# os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = '{"type":"service_account",...}'
os.environ["CORS_ORIGINS"] = "https://teal-kashata-3d7745.netlify.app"

from backend.app import app as application
