from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.routers.data import get_current_bundle

router = APIRouter()


def _serialize_event(ev, ref_tz=None, pr_is_merged=False) -> dict | None:
    from src.data.models import (
        ClosedEvent, CommentEvent, CommitEvent, ConvertToDraftEvent,
        MergedEvent, ReadyForReviewEvent, ReopenedEvent, ReviewEvent, is_bot,
    )

    def _ts(dt) -> str | None:
        return dt.isoformat() if dt else None

    if isinstance(ev, CommitEvent):
        if not ev.committed_date or not ev.author_login:
            return None
        return {
            "time":   _ts(ev.committed_date),
            "icon":   "",
            "type":   "Коммит",
            "actor":  ev.author_login,
            "detail": f"SHA: {ev.oid[:8] if ev.oid else '—'}",
            "metric": None,
        }

    if isinstance(ev, ReviewEvent):
        if not ev.submitted_at:
            return None
        state_label = {
            "APPROVED":          "Одобрено",
            "CHANGES_REQUESTED": "Запрошены правки",
            "COMMENTED":         "Комментарий к ревью",
            "DISMISSED":         "Отклонено",
        }.get(ev.state, ev.state)
        body = ev.body or ""
        return {
            "time":   _ts(ev.submitted_at),
            "icon":   "",
            "type":   f"Ревью: {state_label}",
            "actor":  ev.author,
            "detail": (body[:80] + "…") if len(body) > 80 else body,
            "metric": "M01/M02",
        }

    if isinstance(ev, CommentEvent):
        if not ev.created_at or is_bot(ev.author):
            return None
        body = ev.body or ""
        return {
            "time":   _ts(ev.created_at),
            "icon":   "",
            "type":   "Комментарий",
            "actor":  ev.author,
            "detail": (body[:80] + "…") if len(body) > 80 else body,
            "metric": "M01/M02",
        }

    if isinstance(ev, ReadyForReviewEvent):
        return {
            "time":   _ts(ev.created_at),
            "icon":   "",
            "type":   "Переведён в Ready",
            "actor":  ev.actor,
            "detail": "Draft → Ready for review",
            "metric": None,
        }

    if isinstance(ev, ConvertToDraftEvent):
        return {
            "time":   _ts(ev.created_at),
            "icon":   "",
            "type":   "Переведён в Draft",
            "actor":  ev.actor,
            "detail": "Ready → Draft",
            "metric": None,
        }

    if isinstance(ev, MergedEvent):
        return {
            "time":   _ts(ev.created_at),
            "icon":   "",
            "type":   "Смёрджен",
            "actor":  ev.actor,
            "detail": "PR принят и влит",
            "metric": None,
        }

    if isinstance(ev, ClosedEvent):
        if pr_is_merged:
            return None
        return {
            "time":   _ts(ev.created_at),
            "icon":   "",
            "type":   "Закрыт",
            "actor":  ev.actor,
            "detail": "PR закрыт без мержа",
            "metric": None,
        }

    return None


@router.get("/prs")
def list_prs():
    bundle = get_current_bundle()
    return [
        {
            "number": pr.number,
            "title":  pr.title[:80],
            "author": pr.author,
            "state":  pr.state.value,
        }
        for pr in bundle.prs
    ]


@router.get("/prs/{number}")
def get_pr_timeline(number: int):
    bundle = get_current_bundle()
    pr = next((p for p in bundle.prs if p.number == number), None)
    if pr is None:
        raise HTTPException(status_code=404, detail=f"PR #{number} не найден")

    events: list[dict] = [
        {
            "time":   pr.request_time.isoformat() if pr.request_time else None,
            "icon":   "",
            "type":   "Готов к ревью" if pr.ready_for_review_at else "Создан",
            "actor":  pr.author,
            "detail": "PR стал доступен для ревью",
            "metric": None,
        }
    ]

    for ev in pr.timeline:
        serialized = _serialize_event(ev, pr_is_merged=pr.is_merged)
        if serialized:
            events.append(serialized)

    for cr in pr.check_runs:
        if cr.started_at:
            dur = cr.duration_seconds
            dur_str = f" · {dur/3600:.1f}ч" if dur else ""
            events.append({
                "time":   cr.started_at.isoformat(),
                "icon":   "",
                "type":   f"CI: {cr.name[:40]}",
                "actor":  "github-actions",
                "detail": f"Статус: {cr.conclusion or cr.status}{dur_str}",
                "metric": "M10",
            })

    events.sort(key=lambda e: e["time"] or "9999")

    return {
        "number":        pr.number,
        "title":         pr.title,
        "author":        pr.author,
        "state":         pr.state.value,
        "changed_files": pr.changed_files,
        "events":        events,
    }
