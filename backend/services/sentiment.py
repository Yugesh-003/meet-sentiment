from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

analyzer = SentimentIntensityAnalyzer()


def analyze(text: str) -> dict:
    """Analyze the sentiment of the given text using VADER.
    Returns a dict with keys: pos, neg, neu, compound.
    """
    return analyzer.polarity_scores(text)


def classify(scores: dict) -> str:
    """Classify sentiment into POSITIVE, NEGATIVE, or NEUTRAL."""
    compound = scores.get("compound", 0)
    if compound >= 0.05:
        return "POSITIVE"
    elif compound <= -0.05:
        return "NEGATIVE"
    else:
        return "NEUTRAL"
