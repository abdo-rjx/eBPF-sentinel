from dataclasses import dataclass

import joblib

from ..features.vector import FeatureVector


@dataclass
class AnomalyResult:
    anomaly_score: float
    is_anomalous: bool


class AnomalyScorer:
    def __init__(self, model_path: str):
        self.model = joblib.load(model_path)

    def score(self, vector: FeatureVector) -> AnomalyResult:
        X = [vector.to_array()]
        raw_score = float(self.model.decision_function(X)[0])
        prediction = int(self.model.predict(X)[0])
        return AnomalyResult(
            anomaly_score=raw_score,
            is_anomalous=(prediction == -1),
        )
