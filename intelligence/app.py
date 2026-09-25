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
from multimodal.pipeline import MultimodalPipeline
from cctv_search import CctvHuntEngine

app = FastAPI(title='NEXUS intelligence', docs_url=None, redoc_url=None)
vision_pipeline = VisionPipeline()
multimodal_pipeline = MultimodalPipeline()
cctv_engine = CctvHuntEngine()
cctv_analyses_cache: Dict[str, Any] = {}


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


# -------------------------------------------------------------
# MULTIMODAL EVIDENCE FUSION ROUTES
# -------------------------------------------------------------

class DocumentOcrRequest(BaseModel):
    file_base64: str
    filename: str = 'document.pdf'
    asset_id: str = ''


class AudioTranscribeRequest(BaseModel):
    audio_base64: str
    filename: str = 'audio.wav'
    asset_id: str = ''


class VisualEmbedRequest(BaseModel):
    file_base64: str
    filename: str = 'image.jpg'
    media_type: str = 'IMAGE'
    asset_id: str = ''
    case_id: str = ''


class VisualSearchRequest(BaseModel):
    query_embedding: List[float]
    gallery: List[Dict[str, Any]]
    threshold: float = 0.50
    top_k: int = 15


@app.get('/evidence/status')
def evidence_status():
    return multimodal_pipeline.get_status()


@app.post('/evidence/document/ocr')
def evidence_document_ocr(request: DocumentOcrRequest):
    file_bytes = _decode_b64_image(request.file_base64)
    try:
        return multimodal_pipeline.process_document(file_bytes, request.filename, request.asset_id)
    except Exception as e:
        raise HTTPException(400, f'Document OCR processing error: {e}')


@app.post('/evidence/document/ocr/file')
async def evidence_document_ocr_file(
    file: UploadFile = File(...),
    asset_id: str = Form(''),
):
    file_bytes = await file.read()
    try:
        return multimodal_pipeline.process_document(file_bytes, file.filename or 'document.pdf', asset_id)
    except Exception as e:
        raise HTTPException(400, f'Document OCR processing error: {e}')


@app.post('/evidence/audio/transcribe')
def evidence_audio_transcribe(request: AudioTranscribeRequest):
    audio_bytes = _decode_b64_image(request.audio_base64)
    try:
        return multimodal_pipeline.process_audio(audio_bytes, request.filename, request.asset_id)
    except Exception as e:
        raise HTTPException(400, f'Audio transcription error: {e}')


@app.post('/evidence/audio/transcribe/file')
async def evidence_audio_transcribe_file(
    file: UploadFile = File(...),
    asset_id: str = Form(''),
):
    audio_bytes = await file.read()
    try:
        return multimodal_pipeline.process_audio(audio_bytes, file.filename or 'audio.wav', asset_id)
    except Exception as e:
        raise HTTPException(400, f'Audio transcription error: {e}')


@app.post('/evidence/visual/embed')
def evidence_visual_embed(request: VisualEmbedRequest):
    file_bytes = _decode_b64_image(request.file_base64)
    try:
        return multimodal_pipeline.process_visual(
            file_bytes,
            request.filename,
            request.media_type,
            request.asset_id,
            request.case_id,
        )
    except Exception as e:
        raise HTTPException(400, f'Visual embedding error: {e}')


@app.post('/evidence/visual/embed/file')
async def evidence_visual_embed_file(
    file: UploadFile = File(...),
    media_type: str = Form('IMAGE'),
    asset_id: str = Form(''),
    case_id: str = Form(''),
):
    file_bytes = await file.read()
    try:
        return multimodal_pipeline.process_visual(
            file_bytes,
            file.filename or 'image.jpg',
            media_type,
            asset_id,
            case_id,
        )
    except Exception as e:
        raise HTTPException(400, f'Visual embedding error: {e}')


@app.post('/evidence/visual/search')
def evidence_visual_search(request: VisualSearchRequest):
    try:
        matches = multimodal_pipeline.search_visual(
            request.query_embedding,
            request.gallery,
            request.threshold,
            request.top_k,
        )
        return {
            'matches': matches,
            'count': len(matches),
            'threshold': request.threshold,
            'leadNotice': 'Visual similarity indicates investigative lead only. Not proof of identity.'
        }
    except Exception as e:
        raise HTTPException(400, f'Visual search error: {e}')


# -------------------------------------------------------------
# NATURAL-LANGUAGE CCTV HUNT ROUTES (Grounding DINO + SAM 2)
# -------------------------------------------------------------

class CctvSearchRequest(BaseModel):
    video_base64: Optional[str] = None
    video_path: Optional[str] = None
    filename: str = 'cctv.mp4'
    query: str
    asset_id: str = ''
    case_id: str = ''
    box_threshold: Optional[float] = None
    text_threshold: Optional[float] = None


@app.get('/vision/cctv/status')
def cctv_status():
    return cctv_engine.get_status()


@app.post('/vision/cctv/search')
def cctv_search(request: CctvSearchRequest):
    if not request.query or not request.query.strip():
        raise HTTPException(400, 'Query cannot be empty')

    if request.video_base64:
        video_bytes = _decode_b64_image(request.video_base64)
    elif request.video_path and os.path.exists(request.video_path):
        with open(request.video_path, 'rb') as f:
            video_bytes = f.read()
    else:
        raise HTTPException(400, 'Either video_base64 or valid video_path must be provided')

    try:
        res = cctv_engine.search_video(
            video_bytes=video_bytes,
            filename=request.filename,
            query=request.query,
            asset_id=request.asset_id,
            case_id=request.case_id,
            box_threshold=request.box_threshold,
            text_threshold=request.text_threshold,
        )
        cctv_analyses_cache[res['analysisId']] = res
        return res
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f'CCTV hunt processing failed: {e}')


@app.post('/vision/cctv/search/file')
async def cctv_search_file(
    file: UploadFile = File(...),
    query: str = Form(...),
    asset_id: str = Form(''),
    case_id: str = Form(''),
    box_threshold: Optional[float] = Form(None),
    text_threshold: Optional[float] = Form(None),
):
    if not query or not query.strip():
        raise HTTPException(400, 'Query cannot be empty')

    video_bytes = await file.read()
    try:
        res = cctv_engine.search_video(
            video_bytes=video_bytes,
            filename=file.filename or 'cctv.mp4',
            query=query,
            asset_id=asset_id,
            case_id=case_id,
            box_threshold=box_threshold,
            text_threshold=text_threshold,
        )
        cctv_analyses_cache[res['analysisId']] = res
        return res
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f'CCTV hunt processing failed: {e}')


@app.get('/vision/cctv/search/{analysis_id}')
def cctv_get_analysis(analysis_id: str):
    if analysis_id in cctv_analyses_cache:
        return cctv_analyses_cache[analysis_id]
    raise HTTPException(404, f'CCTV analysis not found: {analysis_id}')

