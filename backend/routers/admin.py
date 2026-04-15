from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

CONFIG_PATH = Path(__file__).resolve().parent.parent / "data" / "config.json"
ADMIN_PASSWORD = os.getenv("DX_ADMIN_PASSWORD", "123")


class ConfigRequest(BaseModel):
    token: str = ""
    owner: str
    repo: str
    window_days: int = 90
    load_commit_files: bool = False
    admin_password: str


class ClearRequest(BaseModel):
    admin_password: str


def _read_config() -> dict | None:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return None


def _write_config(data: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


@router.get("/admin/status")
def admin_status():
    from backend.routers.data import _bundle

    config = _read_config()
    if config is None:
        return {"configured": False, "loaded": False}
    return {
        "configured": True,
        "loaded": _bundle is not None,
        "owner": config.get("owner"),
        "repo": config.get("repo"),
        "window_days": config.get("window_days", 90),
    }


@router.put("/admin/config")
def save_config_only(req: ConfigRequest):
    if req.admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Неверный пароль администратора")

    token = req.token
    if not token:
        existing = _read_config()
        if existing and existing.get("token"):
            token = existing["token"]
        else:
            raise HTTPException(status_code=400, detail="Токен не указан и не сохранён ранее")

    _write_config({
        "token": token,
        "owner": req.owner,
        "repo": req.repo,
        "window_days": req.window_days,
        "load_commit_files": req.load_commit_files,
    })
    return {"status": "saved", "owner": req.owner, "repo": req.repo, "window_days": req.window_days}


@router.post("/admin/config")
def save_config(req: ConfigRequest):
    if req.admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Неверный пароль администратора")

    from backend.routers.data import _set_bundle
    from src.data.loader import load_data

    token = req.token
    if not token:
        existing = _read_config()
        if existing and existing.get("token"):
            token = existing["token"]
        else:
            raise HTTPException(status_code=400, detail="Токен не указан и не сохранён ранее")

    _write_config({
        "token": token,
        "owner": req.owner,
        "repo": req.repo,
        "window_days": req.window_days,
        "load_commit_files": req.load_commit_files,
    })

    try:
        bundle = load_data(
            token=token,
            owner=req.owner,
            repo=req.repo,
            window_days=req.window_days,
            load_commit_files=req.load_commit_files,
        )
        _set_bundle(bundle)
        return {
            "owner": bundle.owner,
            "repo": bundle.repo,
            "pr_count": len(bundle.prs),
            "issue_count": len(bundle.issues),
            "window_start": bundle.window_start.isoformat(),
            "window_end": bundle.window_end.isoformat(),
            "commit_files_loaded": bool(bundle.commit_files),
        }
    except Exception as e:
        CONFIG_PATH.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/admin/config")
def clear_config(req: ClearRequest):
    if req.admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Неверный пароль администратора")

    from backend.routers.data import _set_bundle
    CONFIG_PATH.unlink(missing_ok=True)
    _set_bundle(None)
    return {"status": "ok"}
