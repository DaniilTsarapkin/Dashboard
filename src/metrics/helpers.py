from __future__ import annotations

import math
from typing import Optional

from src.data.models import CommentEvent, PullRequest, ReviewEvent, is_bot




def _human_colleague(login: str, pr_author: str) -> bool:
    return bool(login) and login != "ghost" and login != pr_author and not is_bot(login)


def _pr_m01(pr: PullRequest) -> Optional[float]:
    earliest: Optional[object] = None
    for event in pr.timeline:
        if isinstance(event, ReviewEvent) and _human_colleague(event.author, pr.author):
            t = event.submitted_at
        elif isinstance(event, CommentEvent) and _human_colleague(event.author, pr.author):
            t = event.created_at
        else:
            continue
        if t and (earliest is None or t < earliest):
            earliest = t
    if earliest is None:
        return None
    return max(0.0, (earliest - pr.request_time).total_seconds() / 3600)


def _pr_m10(pr: PullRequest) -> float:
    qualifying = [
        cr for cr in pr.check_runs
        if cr.required
        and cr.started_at is not None
        and cr.completed_at is not None
        and (cr.completed_at - cr.started_at).total_seconds() > 0
    ]
    if not qualifying:
        return 0.0
    earliest_start = min(cr.started_at for cr in qualifying)
    latest_complete = max(cr.completed_at for cr in qualifying)
    return (latest_complete - earliest_start).total_seconds() / 3600


def _pr_lifetime_hours(pr: PullRequest) -> Optional[float]:
    end = pr.merged_at or pr.closed_at or pr.updated_at
    if end is None:
        return None
    delta = (end - pr.request_time).total_seconds() / 3600
    return delta if delta >= 0 else None


def _pr_cf(pr: PullRequest) -> float:
    discussion = sum(
        1 for e in pr.timeline
        if isinstance(e, CommentEvent) and not is_bot(e.author)
    ) + sum(
        e.comment_count for e in pr.timeline
        if isinstance(e, ReviewEvent) and not is_bot(e.author)
    )
    scale = 1 + math.log(1 + pr.changed_files)
    return discussion / scale




def get_status(
    value: float,
    p50: float,
    p75: float,
    p90: float,
    inverse: bool = False,
) -> tuple[str, str]:
    if inverse:
        if value >= 0.7:
            return ("#2ecc71", "В норме")
        if value >= 0.5:
            return ("#f1c40f", "Требует внимания")
        if value >= 0.3:
            return ("#e67e22", "Повышенное трение")
        return ("#e74c3c", "Аномалия")

    if value < p50:
        return ("#2ecc71", "В норме")
    if value < p75:
        return ("#f1c40f", "Требует внимания")
    if value < p90:
        return ("#e67e22", "Повышенное трение")
    return ("#e74c3c", "Аномалия")


def get_trend_arrow(
    current: float,
    previous: float,
    inverse: bool = False,
) -> tuple[str, str]:
    if previous == 0:
        return ("→", "#95a5a6")
    pct_change = (current - previous) / abs(previous)
    if pct_change > 0.20:
        worse_color = "#2ecc71" if inverse else "#e74c3c"
        return ("↑", worse_color)
    if pct_change < -0.20:
        better_color = "#e74c3c" if inverse else "#2ecc71"
        return ("↓", better_color)
    return ("→", "#95a5a6")
