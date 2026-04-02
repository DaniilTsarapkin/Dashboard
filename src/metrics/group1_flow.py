from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from statistics import median
from typing import Optional

from ..data.models import (
    CommitEvent,
    CommentEvent,
    Issue,
    PullRequest,
    ReadyForReviewEvent,
    ReviewEvent,
    is_bot,
)




def _event_time(event) -> Optional[datetime]:
    for attr in ("submitted_at", "created_at", "committed_date"):
        val = getattr(event, attr, None)
        if val is not None:
            return val
    return None


def _is_human_colleague(login: str, pr_author: str) -> bool:
    return bool(login) and login != "ghost" and login != pr_author and not is_bot(login)




def feedback_loop_latency(prs: list[PullRequest]) -> float:
    latencies: list[float] = []

    for pr in prs:
        earliest_response: Optional[datetime] = None

        for event in pr.timeline:
            if isinstance(event, ReviewEvent):
                if not _is_human_colleague(event.author, pr.author):
                    continue
                t = event.submitted_at
            elif isinstance(event, CommentEvent):
                if not _is_human_colleague(event.author, pr.author):
                    continue
                t = event.created_at
            else:
                continue

            if t is None:
                continue
            if earliest_response is None or t < earliest_response:
                earliest_response = t

        if earliest_response is None:
            continue

        delta_hours = (earliest_response - pr.request_time).total_seconds() / 3600
        if delta_hours >= 0:
            latencies.append(delta_hours)

    return median(latencies) if latencies else 0.0




def process_blockage_time(prs: list[PullRequest]) -> float:
    blockage_totals: list[float] = []

    for pr in prs:
        timed_events: list[tuple[datetime, object]] = []
        for event in pr.timeline:
            t = _event_time(event)
            if t is not None:
                timed_events.append((t, event))
        timed_events.sort(key=lambda x: x[0])

        last_author_t: Optional[datetime] = pr.request_time
        last_colleague_t: Optional[datetime] = None
        total_hours = 0.0
        has_colleague = False

        for t, event in timed_events:
            if (
                isinstance(event, CommitEvent)
                and event.author_login == pr.author
            ) or isinstance(event, ReadyForReviewEvent):
                if last_colleague_t is not None:
                    gap = (t - last_colleague_t).total_seconds() / 3600
                    if gap > 0:
                        total_hours += gap
                last_author_t = t
                last_colleague_t = None

            elif isinstance(event, (ReviewEvent, CommentEvent)):
                actor = event.author
                if not _is_human_colleague(actor, pr.author):
                    continue
                has_colleague = True
                if last_author_t is not None:
                    gap = (t - last_author_t).total_seconds() / 3600
                    if gap > 0:
                        total_hours += gap
                last_colleague_t = t
                last_author_t = None

        if has_colleague:
            blockage_totals.append(total_hours)

    return median(blockage_totals) if blockage_totals else 0.0




def fragmentation_rate(
    prs: list[PullRequest],
    issues: list[Issue],
) -> float:
    contexts: dict[tuple[str, datetime], set[int]] = defaultdict(set)

    for pr in prs:
        for event in pr.timeline:
            t = _event_time(event)
            if t is None:
                continue
            hour_slot = t.replace(minute=0, second=0, microsecond=0)

            if isinstance(event, CommitEvent):
                login = event.author_login
                if login and not is_bot(login):
                    contexts[(login, hour_slot)].add(pr.number)
            elif isinstance(event, (ReviewEvent, CommentEvent)):
                login = event.author
                if login and not is_bot(login):
                    contexts[(login, hour_slot)].add(pr.number)

    for issue in issues:
        for event in issue.timeline:
            if not isinstance(event, CommentEvent):
                continue
            t = event.created_at
            if t is None:
                continue
            login = event.author
            if login and not is_bot(login):
                hour_slot = t.replace(minute=0, second=0, microsecond=0)
                contexts[(login, hour_slot)].add(issue.number)

    counts = [len(ctxs) for ctxs in contexts.values()]
    return median(counts) if counts else 0.0




def post_interruption_recovery_cost(prs: list[PullRequest]) -> float:
    author_commit_index: dict[str, list[tuple[datetime, int]]] = defaultdict(list)

    for pr in prs:
        for event in pr.timeline:
            if (
                isinstance(event, CommitEvent)
                and event.committed_date is not None
                and event.author_login == pr.author
            ):
                author_commit_index[pr.author].append(
                    (event.committed_date, pr.number)
                )

    for login in author_commit_index:
        author_commit_index[login].sort(key=lambda x: x[0])

    recovery_costs: list[float] = []
    window = timedelta(hours=8)
    deadline_window = timedelta(hours=24)

    for pr in prs:
        for event in pr.timeline:
            if isinstance(event, ReviewEvent):
                reviewer = event.author
                t_interrupt = event.submitted_at
            elif isinstance(event, CommentEvent):
                reviewer = event.author
                t_interrupt = event.created_at
            else:
                continue

            if (
                t_interrupt is None
                or not reviewer
                or reviewer == "ghost"
                or is_bot(reviewer)
                or reviewer == pr.author
            ):
                continue

            window_start = t_interrupt - window
            deadline = t_interrupt + deadline_window

            own_pr_numbers: set[int] = set()
            for commit_time, own_pr_number in author_commit_index.get(reviewer, []):
                if commit_time > t_interrupt:
                    break
                if commit_time >= window_start:
                    own_pr_numbers.add(own_pr_number)

            if not own_pr_numbers:
                continue

            for commit_time, own_pr_number in author_commit_index.get(reviewer, []):
                if commit_time <= t_interrupt:
                    continue
                if commit_time > deadline:
                    break
                if own_pr_number in own_pr_numbers:
                    recovery_hours = (commit_time - t_interrupt).total_seconds() / 3600
                    recovery_costs.append(recovery_hours)
                    break

    return median(recovery_costs) if recovery_costs else 0.0
