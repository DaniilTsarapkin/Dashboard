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


DEMO_PATH = Path(__file__).resolve().parent.parent.parent / "demo_data.json"


@router.post("/admin/demo")
def load_demo(req: ClearRequest):
    if req.admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Неверный пароль администратора")

    if not DEMO_PATH.exists():
        raise HTTPException(status_code=404, detail="Файл demo_data.json не найден")

    from datetime import datetime, timezone
    from backend.routers.data import _set_bundle
    from src.data.loader import DataBundle
    from src.data.models import (
        PRState, PullRequest, Issue, PRFile, CheckRun,
        CommitEvent, ReviewEvent, CommentEvent,
        ReadyForReviewEvent, ConvertToDraftEvent,
        MergedEvent, ClosedEvent, ReopenedEvent,
        CommitWithFiles,
    )

    def _parse_dt(s):
        if not s:
            return None
        return datetime.fromisoformat(s)

    def _parse_event(e):
        tn = e.get("typename", "")
        if tn == "PullRequestCommit":
            return CommitEvent(oid=e.get("oid", ""), committed_date=_parse_dt(e.get("committed_date")), author_login=e.get("author_login"))
        if tn == "PullRequestReview":
            return ReviewEvent(author=e.get("author", ""), submitted_at=_parse_dt(e.get("submitted_at")), state=e.get("state", ""), body=e.get("body", ""), comment_count=e.get("comment_count", 0), reactions=tuple(e.get("reactions", [])))
        if tn == "IssueComment":
            return CommentEvent(author=e.get("author", ""), created_at=_parse_dt(e.get("created_at")), body=e.get("body", ""), reactions=tuple(e.get("reactions", [])))
        if tn == "ReadyForReviewEvent":
            return ReadyForReviewEvent(created_at=_parse_dt(e.get("created_at")), actor=e.get("actor", ""))
        if tn == "ConvertToDraftEvent":
            return ConvertToDraftEvent(created_at=_parse_dt(e.get("created_at")), actor=e.get("actor", ""))
        if tn == "MergedEvent":
            return MergedEvent(created_at=_parse_dt(e.get("created_at")), actor=e.get("actor", ""))
        if tn == "ClosedEvent":
            return ClosedEvent(created_at=_parse_dt(e.get("created_at")), actor=e.get("actor", ""))
        if tn == "ReopenedEvent":
            return ReopenedEvent(created_at=_parse_dt(e.get("created_at")), actor=e.get("actor", ""))
        return None

    def _parse_pr(d):
        return PullRequest(
            number=d["number"], title=d["title"],
            state=PRState(d["state"]), is_draft=d.get("is_draft", False),
            author=d["author"],
            created_at=_parse_dt(d["created_at"]), updated_at=_parse_dt(d["updated_at"]),
            merged_at=_parse_dt(d.get("merged_at")), closed_at=_parse_dt(d.get("closed_at")),
            ready_for_review_at=_parse_dt(d.get("ready_for_review_at")),
            additions=d.get("additions", 0), deletions=d.get("deletions", 0),
            changed_files=d.get("changed_files", 0),
            labels=d.get("labels", []),
            files=[PRFile(path=f["path"], additions=f["additions"], deletions=f["deletions"]) for f in d.get("files", [])],
            timeline=[ev for ev in (_parse_event(e) for e in d.get("timeline", [])) if ev is not None],
            check_runs=[CheckRun(name=c["name"], status=(c["status"] or "").upper(), conclusion=(c.get("conclusion") or "").upper() or None, started_at=_parse_dt(c.get("started_at")), completed_at=_parse_dt(c.get("completed_at")), required=c.get("required", True)) for c in d.get("check_runs", [])],
            reactions=tuple(d.get("reactions", [])),
        )

    def _parse_issue(d):
        return Issue(
            number=d["number"], title=d["title"], state=d["state"],
            author=d["author"],
            created_at=_parse_dt(d["created_at"]), updated_at=_parse_dt(d["updated_at"]),
            closed_at=_parse_dt(d.get("closed_at")),
            labels=d.get("labels", []),
            timeline=[ev for ev in (_parse_event(e) for e in d.get("timeline", [])) if ev is not None],
            reactions=tuple(d.get("reactions", [])),
            comment_count=d.get("comment_count", 0),
        )

    try:
        data = json.loads(DEMO_PATH.read_text(encoding="utf-8"))

        commit_files = {}
        for pr_num, cwf_list in data.get("commit_files", {}).items():
            commit_files[pr_num] = [
                CommitWithFiles(
                    oid=c["oid"],
                    committed_date=_parse_dt(c["committed_date"]),
                    author_login=c.get("author_login"),
                    files=[PRFile(path=f["path"], additions=f["additions"], deletions=f["deletions"]) for f in c.get("files", [])],
                )
                for c in cwf_list
            ]

        bundle = DataBundle(
            prs=[_parse_pr(p) for p in data["prs"]],
            issues=[_parse_issue(i) for i in data["issues"]],
            base_prs=[_parse_pr(p) for p in data.get("base_prs", [])],
            base_issues=[_parse_issue(i) for i in data.get("base_issues", [])],
            commit_files=commit_files,
            owner=data.get("owner", "demo"),
            repo=data.get("repo", "dx-project"),
            window_start=_parse_dt(data["window_start"]),
            window_end=_parse_dt(data["window_end"]),
            loaded_at=_parse_dt(data.get("loaded_at")) or datetime.now(timezone.utc),
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
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки демо-данных: {str(e)}")
