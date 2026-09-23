import base64
import json
import os
import platform
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

from analysis import analyze
from extraction import extract
from evaluate_multilingual import evaluate as evaluate_multilingual
from intent import map_intent, IntentModel
from vision.pipeline import VisionPipeline

app = FastAPI(title='NEXUS intelligence', docs_url=None, redoc_url=None)
vision_pipeline = VisionPipeline()


class ExtractRequest(BaseModel):
    text: str = Field(max_length=10000)
    recordId: str = Field(default='', max_length=100)


class VisionEnrollRequest(BaseModel):
    image_base64: str


class VisionSearchRequest(BaseModel):
    image_base64: str
    selected_face_index: Optional[int] = None
    conf_threshold: float = 0.45


class VisionCompareGalleryItem(BaseModel):
    id: str
    embedding: List[float]


class VisionCompareRequest(BaseModel):
    query_embedding: List[float]
    gallery: List[VisionCompareGalleryItem]
    threshold: float = 0.65


class IntentRequest(BaseModel):
    query: str = Field(max_length=500)
    useLlm: bool = Field(default=False)


@app.get('/health')
def health():
    return {'status': 'ok', 'version': '0.1.0', 'versions': {'python': platform.python_version(), 'intelligence': '0.1.0'}}


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

    eval_path = path.parent / 'eval' / 'evaluation_results.json'
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
    res['multilingualSynthetic'] = evaluate_multilingual()
    return res


@app.get('/vision/status')
def vision_status():
    return vision_pipeline.get_status()


def _decode_b64_image(b64_str: str) -> bytes:
    if ',' in b64_str:
        b64_str = b64_str.split(',', 1)[1]
    try:
        return base64.b64decode(b64_str)
    except Exception as e:
        raise HTTPException(400, f'Invalid base64 image data: {e}')


@app.post('/vision/enroll')
def vision_enroll_json(request: VisionEnrollRequest):
    img_bytes = _decode_b64_image(request.image_base64)
    try:
        return vision_pipeline.process_for_enrollment(img_bytes)
    except ValueError as e:
        err = str(e)
        code = 400
        if 'NO_FACE_DETECTED' in err or 'MULTIPLE_FACES' in err or 'LOW_QUALITY' in err:
            code = 422
        raise HTTPException(code, err)


@app.post('/vision/enroll/file')
async def vision_enroll_file(image: UploadFile = File(...)):
    img_bytes = await image.read()
    try:
        return vision_pipeline.process_for_enrollment(img_bytes)
    except ValueError as e:
        err = str(e)
        code = 400
        if 'NO_FACE_DETECTED' in err or 'MULTIPLE_FACES' in err or 'LOW_QUALITY' in err:
            code = 422
        raise HTTPException(code, err)


@app.post('/vision/search')
def vision_search_json(request: VisionSearchRequest):
    img_bytes = _decode_b64_image(request.image_base64)
    try:
        return vision_pipeline.process_for_search(
            img_bytes,
            selected_face_index=request.selected_face_index,
            conf_threshold=request.conf_threshold,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post('/vision/search/file')
async def vision_search_file(
    image: UploadFile = File(...),
    selected_face_index: Optional[int] = Form(None),
    conf_threshold: float = Form(0.45),
):
    img_bytes = await image.read()
    try:
        return vision_pipeline.process_for_search(
            img_bytes,
            selected_face_index=selected_face_index,
            conf_threshold=conf_threshold,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post('/vision/compare')
def vision_compare(request: VisionCompareRequest):
    matches = []
    for item in request.gallery:
        sim = vision_pipeline.recognizer.cosine_similarity(request.query_embedding, item.embedding)
        if sim >= request.threshold:
            matches.append({'id': item.id, 'similarity': round(sim, 4)})
    matches.sort(key=lambda x: x['similarity'], reverse=True)
    return {'matches': matches, 'count': len(matches), 'threshold': request.threshold}
