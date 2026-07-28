"""Offline training entrypoint. Run as: python -m sentinel_backend.ml.train baseline.csv"""
import sys
import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest
from ..features.vector import FEATURE_COLUMNS

def train(csv_path: str, output_path: str, contamination: float = 0.02):
    df = pd.read_csv(csv_path)
    missing = set(FEATURE_COLUMNS) - set(df.columns)
    if missing:
        raise ValueError(f"Baseline CSV is missing required columns: {missing}")

    X = df[FEATURE_COLUMNS].values
    model = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X)
    joblib.dump(model, output_path)
    print(f"Trained on {len(df)} windows, saved to {output_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m sentinel_backend.ml.train <baseline.csv> [output.joblib]")
        sys.exit(1)
    csv_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "sentinel_backend/ml/model_store/isolation_forest.joblib"
    train(csv_path, output_path)
