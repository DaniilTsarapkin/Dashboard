from __future__ import annotations

from datetime import timedelta
from statistics import median
from typing import Optional

from ..data.models import ClosedEvent, Issue, PullRequest, ReopenedEvent

DEFAULT_ESS_WEIGHTS = (0.6, 0.4)
ESS_CEILING = 0.3




def environment_safety_score(
    prs: list[PullRequest],
    *,
    a: float = DEFAULT_ESS_WEIGHTS[0],
    b: float = DEFAULT_ESS_WEIGHTS[1],
    ceiling: float = ESS_CEILING,
) -> float:
    merged = [pr for pr in prs if pr.is_merged]
    merged_count = len(merged)

    if merged_count == 0:
        return 1.0

    ram = sum(1 for pr in merged if pr.is_revert) / merged_count

    merge_times = sorted(
        pr.merged_at for pr in merged if pr.merged_at is not None
    )

    def _within_72h_of_a_merge(pr: PullRequest) -> bool:
        if pr.created_at is None:
            return False
        window = timedelta(hours=72)
        return any(
            pr.created_at > mt and pr.created_at <= mt + window
            for mt in merge_times
        )

    hfp = sum(
        1 for pr in merged
        if pr.is_hotfix and _within_72h_of_a_merge(pr)
    ) / merged_count

    raw = a * ram + b * hfp
    normalized = min(raw / ceiling, 1.0)
    return 1.0 - normalized




def rework_rate(
    prs: list[PullRequest],
    issues: list[Issue],
    reopen_window_days: int = 14,
) -> float:
    window = timedelta(days=reopen_window_days)
    total_closed = 0
    reworked = 0

    items: list[PullRequest | Issue] = [*prs, *issues]

    for item in items:
        closed_times = [
            e.created_at
            for e in item.timeline
            if isinstance(e, ClosedEvent) and e.created_at is not None
        ]
        if not closed_times:
            continue

        total_closed += 1
        last_close = max(closed_times)
        deadline = last_close + window

        reopened = any(
            isinstance(e, ReopenedEvent)
            and e.created_at is not None
            and last_close < e.created_at <= deadline
            for e in item.timeline
        )
        if reopened:
            reworked += 1

    return reworked / total_closed if total_closed > 0 else 0.0




def infrastructure_wait_time(prs: list[PullRequest]) -> Optional[float]:
    any_check_runs = False
    wait_hours: list[float] = []

    for pr in prs:
        qualifying = [
            cr for cr in pr.check_runs
            if cr.required
            and cr.started_at is not None
            and cr.completed_at is not None
            and (cr.completed_at - cr.started_at).total_seconds() > 0
        ]

        if pr.check_runs:
            any_check_runs = True

        if qualifying:
            earliest_start = min(cr.started_at for cr in qualifying)
            latest_complete = max(cr.completed_at for cr in qualifying)
            wall_clock = (latest_complete - earliest_start).total_seconds() / 3600
            wait_hours.append(wall_clock)

    if not any_check_runs:
        return None

    return median(wait_hours) if wait_hours else 0.0
