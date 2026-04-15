from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.data.loader import load_data, DataBundle

router = APIRouter()

_bundle: Optional[DataBundle] = None


def _set_bundle(b: Optional[DataBundle]) -> None:
    global _bundle
    _bundle = b


def _ensure_loaded() -> None:
    global _bundle
    if _bundle is not None:
        return
    from backend.routers.admin import _read_config
    config = _read_config()
    if config is None:
        return
    try:
        _bundle = load_data(
            token=config["token"],
            owner=config["owner"],
            repo=config["repo"],
            window_days=config.get("window_days", 90),
            load_commit_files=config.get("load_commit_files", False),
        )
    except Exception:
        pass

class LoadRequest(BaseModel):
    token: str
    owner: str
    repo: str
    window_days: int = 90
    load_commit_files: bool = False

@router.post("/load")
def load(req: LoadRequest):
    global _bundle
    try:
        _bundle = load_data(
            token=req.token,
            owner=req.owner,
            repo=req.repo,
            window_days=req.window_days,
            load_commit_files=req.load_commit_files,
        )
        return {
            "owner": _bundle.owner,
            "repo": _bundle.repo,
            "pr_count": len(_bundle.prs),
            "issue_count": len(_bundle.issues),
            "window_start": _bundle.window_start.isoformat(),
            "window_end": _bundle.window_end.isoformat(),
            "commit_files_loaded": bool(_bundle.commit_files),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/bundle")
def get_bundle_info():
    _ensure_loaded()
    if _bundle is None:
        raise HTTPException(status_code=404, detail="Данные не загружены")
    return {
        "owner": _bundle.owner,
        "repo": _bundle.repo,
        "pr_count": len(_bundle.prs),
        "issue_count": len(_bundle.issues),
        "window_start": _bundle.window_start.isoformat(),
        "window_end": _bundle.window_end.isoformat(),
        "commit_files_loaded": bool(_bundle.commit_files),
    }

def get_current_bundle() -> DataBundle:
    _ensure_loaded()
    if _bundle is None:
        raise HTTPException(status_code=404, detail="Данные не загружены. Сначала вызови /api/load")
    return _bundle
