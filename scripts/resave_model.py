"""Resave (re-pickle) trained model and scaler to the project's backend folder.

Usage:
  python scripts/resave_model.py --model trained_model.pkl --scaler trained_scaler.pkl

The script will print the local scikit-learn version and write the provided
model/scaler files into `backend/heart_disease_model.pkl` and
`backend/scaler.pkl` using pickle. This ensures the pickled files match the
environment's scikit-learn version.
"""
import argparse
import pickle
import os
import sys

def main():
    parser = argparse.ArgumentParser(description="Re-pickle model+scaler for backend")
    parser.add_argument("--model", required=True, help="Path to the trained model pickle file")
    parser.add_argument("--scaler", required=True, help="Path to the trained scaler pickle file")
    parser.add_argument("--out-model", default="backend/heart_disease_model.pkl", help="Output path for repickled model")
    parser.add_argument("--out-scaler", default="backend/scaler.pkl", help="Output path for repickled scaler")
    args = parser.parse_args()

    try:
        import sklearn
        print(f"Local scikit-learn version: {sklearn.__version__}")
    except Exception:
        print("Warning: scikit-learn not found in this environment.")

    if not os.path.exists(args.model):
        print(f"Model file not found: {args.model}")
        sys.exit(2)
    if not os.path.exists(args.scaler):
        print(f"Scaler file not found: {args.scaler}")
        sys.exit(2)

    os.makedirs(os.path.dirname(args.out_model), exist_ok=True)

    # Load then re-dump using current environment pickling rules
    with open(args.model, 'rb') as f_in:
        model = pickle.load(f_in)
    with open(args.scaler, 'rb') as f_in:
        scaler = pickle.load(f_in)

    with open(args.out_model, 'wb') as f_out:
        pickle.dump(model, f_out)
    with open(args.out_scaler, 'wb') as f_out:
        pickle.dump(scaler, f_out)

    print(f"Wrote model -> {args.out_model}")
    print(f"Wrote scaler -> {args.out_scaler}")

if __name__ == '__main__':
    main()
