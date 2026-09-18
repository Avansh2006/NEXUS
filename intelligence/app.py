import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from analysis import analyze
from extraction import extract

app = FastAPI(title='NEXUS intelligence', docs_url=None, redoc_url=None)


class ExtractRequest(BaseModel):
    text: str = Field(max_length=10000)
    recordId: str = Field(default='', max_length=100)


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/extract')
def extract_route(request: ExtractRequest):
    return {'entities': extract(request.text, request.recordId)}


@app.post('/analyze')
def analyze_route(payload: dict):
    if len(payload.get('nodes', [])) > 1500 or len(payload.get('edges', [])) > 10000:
        raise HTTPException(413, 'Graph exceeds prototype limits')
    return analyze(payload)


@app.get('/quality')
def quality():
    path = Path(os.getenv('DEMO_DIR', str(Path(__file__).resolve().parents[1] / 'data' / 'demo')))
    gold = json.loads((path / 'gold.json').read_text(encoding='utf-8'))
    tp = fp = fn = 0
    for sample in gold:
        expected = {(e['type'], e['start'], e['end']) for e in sample['entities']}
        actual = {(e['type'], e['start'], e['end']) for e in extract(sample['text'])}
        tp += len(expected & actual)
        fp += len(actual - expected)
        fn += len(expected - actual)
    return dict(precision=tp/(tp+fp) if tp+fp else 0, recall=tp/(tp+fn) if tp+fn else 0,
                truePositives=tp, falsePositives=fp, falseNegatives=fn, samples=len(gold),
                scope='Synthetic template gold set; not a real-world accuracy claim')
