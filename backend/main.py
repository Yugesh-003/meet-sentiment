from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

analyzer = SentimentIntensityAnalyzer()

class SentimentRequest(BaseModel):
    text: str

@app.post("/analyze")
async def analyze_sentiment(request: SentimentRequest):
    scores = analyzer.polarity_scores(request.text)
    return {"sentiment": scores}

@app.get("/")
async def root():
    return {"message": "Meet Sentiment API"}
