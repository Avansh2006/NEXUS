import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from analysis import analyze
from extraction import extract
from intent import map_intent, IntentModel

app = FastAPI(title='NEXUS intelligence', docs_url=None, redoc_url=None)


class ExtractRequest(BaseModel):
    text: str = Field(max_length=10000)
    recordId: str = Field(default='', max_length=100)


class IntentRequest(BaseModel):
    query: str = Field(max_length=500)
    useLlm: bool = Field(default=False)


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/copilot/intent')
def copilot_intent(request: IntentRequest):
    result = map_intent(request.query, use_llm=request.useLlm)
    return result.model_dump()


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
    res = dict(precision=tp/(tp+fp) if tp+fp else 0, recall=tp/(tp+fn) if tp+fn else 0,
               truePositives=tp, falsePositives=fp, falseNegatives=fn, samples=len(gold),
               scope='Synthetic template gold set; not a real-world accuracy claim')

    eval_path = Path(__file__).resolve().parents[1] / 'data' / 'eval' / 'evaluation_results.json'
    if eval_path.exists():
        try:
            eval_data = json.loads(eval_path.read_text(encoding='utf-8'))
            test_info = eval_data.get('test', {})
            dev_info = eval_data.get('dev', {})
            res['heldoutTest'] = {
                'samples': test_info.get('samples', 22),
                'strictPrecision': test_info.get('strict', {}).get('precision', 0),
                'strictRecall': test_info.get('strict', {}).get('recall', 0),
                'strictF1': test_info.get('strict', {}).get('f1', 0),
                'lenientPrecision': test_info.get('lenient', {}).get('precision', 0),
                'lenientRecall': test_info.get('lenient', {}).get('recall', 0),
                'lenientF1': test_info.get('lenient', {}).get('f1', 0)
            }
            res['heldoutDev'] = {
                'samples': dev_info.get('samples', 22),
                'strictPrecision': dev_info.get('strict', {}).get('precision', 0),
                'strictRecall': dev_info.get('strict', {}).get('recall', 0),
                'strictF1': dev_info.get('strict', {}).get('f1', 0),
                'lenientPrecision': dev_info.get('lenient', {}).get('precision', 0),
                'lenientRecall': dev_info.get('lenient', {}).get('recall', 0),
                'lenientF1': dev_info.get('lenient', {}).get('f1', 0)
            }
        except Exception:
            pass
    return res
