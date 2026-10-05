"""CPU-only visual inference for the illustrated simulator, not real CCTV.

Pixels are the only classification input. Bounded sessions retain motion history
and suppress repeated incidents from the same simulated event.
"""
import base64
import io
import os
import time
from collections import OrderedDict
from datetime import datetime, timezone
from threading import Lock
from typing import Any

import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from PIL import Image, UnidentifiedImageError
from .vision import inspect_frame

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://gateway:8080").rstrip("/")
SERVICE_API_KEY = os.getenv("SERVICE_API_KEY", "cypher-internal-dev-key")
Image.MAX_IMAGE_PIXELS = 640 * 360
app = FastAPI(title="Cypher lightweight vision", version="0.2.0")
sessions: OrderedDict[str, dict] = OrderedDict()
lock = Lock()
processed = 0


class FrameRequest(BaseModel):
    camera_id: int = Field(ge=1)
    session_id: str = Field(min_length=8, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    sequence: int = Field(ge=0, le=10000)
    frame_base64: str = Field(min_length=20, max_length=200000)


def decode_frame(value: str):
    try:
        raw = base64.b64decode(value.split(",", 1)[-1], validate=True)
        with Image.open(io.BytesIO(raw), formats=["PNG", "JPEG"]) as image:
            if image.width > 640 or image.height > 360 or image.width < 160 or image.height < 90:
                raise ValueError("Use a frame between 160×90 and 640×360 pixels")
            frame = image.convert("RGB")
            frame.thumbnail((320, 180))
            return frame
    except (ValueError, OSError, UnidentifiedImageError, Image.DecompressionBombError) as exc:
        raise HTTPException(400, "Invalid or oversized PNG/JPEG frame") from exc


def submit_incident(analysis: dict, request: FrameRequest, snapshot: str):
    incident = analysis["incident"]
    payload = {
        "cameraId": request.camera_id, "incidentType": incident["incident_type"],
        "assetType": incident["asset_type"], "confidence": incident["confidence"],
        "priority": incident["priority"], "summary": incident["summary"],
        "boundingBox": incident["bounding_box"],
        "metadata": {"rule": incident["rule"], "source": "illustrated-simulation",
                     "eventId": request.session_id, "explanation": analysis["explanation"],
                     "snapshot": snapshot, "scoreType": "geometric-match"},
        "detections": [{"assetType": d["asset_type"], "confidence": d["confidence"],
                        "boundingBox": d["bounding_box"], "metadata": {"source": "illustrated-simulation"}}
                       for d in analysis["detections"]],
    }
    try:
        response = requests.post(f"{GATEWAY_URL}/api/ingest/incident", json=payload,
                                 headers={"X-Service-Key": SERVICE_API_KEY}, timeout=(3, 8))
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        raise HTTPException(502, "Detection succeeded, but saving the incident failed. Check gateway ingestion logs.") from exc


@app.get("/health")
def health():
    return {"status": "healthy", "service": "ai-engine", "mode": "simulation-vision",
            "detector": "silhouette geometry + temporal motion", "trained_model": False,
            "frames_processed": processed, "max_frame": "320x180", "workers": 1}


@app.get("/metrics")
def metrics():
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(f"cypher_ai_frames_processed_total {processed}\n")


@app.post("/analyze")
def analyze(request: FrameRequest) -> dict[str, Any]:
    global processed
    frame = decode_frame(request.frame_base64)
    start = time.perf_counter()
    with lock:
        cutoff = time.monotonic() - 600
        for key in list(sessions):
            if sessions[key]["seen"] < cutoff:
                sessions.pop(key)
        state = sessions.get(request.session_id)
        if state and state["camera_id"] != request.camera_id:
            raise HTTPException(409, "Start a new session when changing cameras")
        if state and request.sequence <= state.get("sequence", -1):
            return state["result"]
        if state is None:
            state = {"seen": 0, "camera_id": request.camera_id, "history": [], "created": None}
        if time.monotonic() - state["seen"] < .20 and state.get("result"):
            raise HTTPException(429, "Sample at most two frames per second")
        result = inspect_frame(frame, state["history"])
        result.update(camera_id=request.camera_id, processed_at=datetime.now(timezone.utc).isoformat(),
                      mode="simulation-vision", sequence=request.sequence,
                      created_incident=state["created"], persisted=bool(state["created"]))
        if result["incident"] and len(state["history"]) >= 3 and state["created"] is None:
            buffer = io.BytesIO()
            frame.save(buffer, format="PNG", optimize=True)
            snapshot = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()
            state["created"] = submit_incident(result, request, snapshot)
            result["created_incident"] = state["created"]
            result["persisted"] = True
        result["processing_ms"] = round((time.perf_counter() - start) * 1000, 1)
        state.update(seen=time.monotonic(), sequence=request.sequence, result=result)
        sessions[request.session_id] = state
        sessions.move_to_end(request.session_id)
        while len(sessions) > 64:
            sessions.popitem(last=False)
        processed += 1
        return result
