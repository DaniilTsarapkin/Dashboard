from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from statistics import median
from typing import Optional

from ..data.models import (
    CommitEvent,
    CommentEvent,
    Issue,
    PullRequest,
    ReadyForReviewEvent,
    ReopenedEvent,
    ReviewEvent,
    is_bot,
)




def _event_time(event) -> Optional[datetime]:
    for attr in ("submitted_at", "created_at", "committed_date"):
        val = getattr(event, attr, None)
        if val is not None:
            return val
    return None


def _actor_login(event) -> Optional[str]:
    for attr in ("author_login", "author", "actor"):
        val = getattr(event, attr, None)
        if val:
            return val
    return None


def _collect_developer_events(
    prs: list[PullRequest],
    issues: list[Issue],
) -> dict[str, list[datetime]]:
    events: dict[str, list[datetime]] = defaultdict(list)

    for pr in prs:
        for event in pr.timeline:
            t = _event_time(event)
            if t is None:
                continue
            login = _actor_login(event)
            if login and login != "ghost" and not is_bot(login):
                events[login].append(t)

    for issue in issues:
        for event in issue.timeline:
            t = _event_time(event)
            if t is None:
                continue
            login = _actor_login(event)
            if login and login != "ghost" and not is_bot(login):
                events[login].append(t)

    return {login: sorted(ts) for login, ts in events.items()}


def _blockage_hours_for_pr(pr: PullRequest) -> float:
    timed: list[tuple[datetime, object]] = []
    for event in pr.timeline:
        t = _event_time(event)
        if t is not None:
            timed.append((t, event))
    timed.sort(key=lambda x: x[0])

    last_author_t: Optional[datetime] = pr.request_time
    last_colleague_t: Optional[datetime] = None
    total = 0.0

    for t, event in timed:
        if (
            isinstance(event, CommitEvent) and event.author_login == pr.author
        ) or isinstance(event, ReadyForReviewEvent):
            if last_colleague_t is not None:
                gap = (t - last_colleague_t).total_seconds() / 3600
                if gap > 0:
                    total += gap
            last_author_t = t
            last_colleague_t = None
        elif isinstance(event, (ReviewEvent, CommentEvent)):
            actor = event.author
            if not actor or actor == "ghost" or actor == pr.author or is_bot(actor):
                continue
            if last_author_t is not None:
                gap = (t - last_author_t).total_seconds() / 3600
                if gap > 0:
                    total += gap
            last_colleague_t = t
            last_author_t = None

    return total




def systemic_overload_index(
    base_prs: list[PullRequest],
    base_issues: list[Issue],
    current_prs: list[PullRequest],
    current_issues: list[Issue],
    coverage: float = 0.8,
) -> float:
    base_events = _collect_developer_events(base_prs, base_issues)
    base_windows: dict[str, set[tuple[int, int]]] = {}

    for login, timestamps in base_events.items():
        slot_counts: dict[tuple[int, int], int] = defaultdict(int)
        for t in timestamps:
            slot_counts[(t.weekday(), t.hour)] += 1

        total = sum(slot_counts.values())
        threshold = coverage * total

        window: set[tuple[int, int]] = set()
        cumulative = 0
        for slot, count in sorted(slot_counts.items(), key=lambda x: -x[1]):
            window.add(slot)
            cumulative += count
            if cumulative >= threshold:
                break

        base_windows[login] = window

    current_events = _collect_developer_events(current_prs, current_issues)
    soi_values: list[float] = []

    for login, timestamps in current_events.items():
        if login not in base_windows:
            continue

        window = base_windows[login]
        total = len(timestamps)
        outside = sum(1 for t in timestamps if (t.weekday(), t.hour) not in window)
        soi_values.append(outside / (total + 1))

    return median(soi_values) if soi_values else 0.0




def knowledge_concentration_risk(
    prs: list[PullRequest],
    theta: float = 0.6,
) -> float:
    module_author_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for pr in prs:
        touched_modules: set[str] = set()
        for f in pr.files:
            touched_modules.add(f.directory)
        for module in touched_modules:
            module_author_counts[module][pr.author] += 1

    if not module_author_counts:
        return 0.0

    concentrated = 0
    for author_counts in module_author_counts.values():
        total = sum(author_counts.values())
        max_share = max(author_counts.values()) / total
        if max_share >= theta:
            concentrated += 1

    return concentrated / (len(module_author_counts) + 1)




def onboarding_efficiency(
    prs: list[PullRequest],
    since: datetime,
) -> tuple[float, int]:
    earliest_event: dict[str, datetime] = {}

    for pr in prs:
        _update_earliest(earliest_event, pr.author, pr.created_at)
        for event in pr.timeline:
            if isinstance(event, CommitEvent) and event.author_login == pr.author:
                if event.committed_date:
                    _update_earliest(earliest_event, pr.author, event.committed_date)

    new_participants: set[str] = {
        login for login, t in earliest_event.items() if t >= since
    }

    if not new_participants:
        return (0.0, 0)

    first_pr_created: dict[str, datetime] = {}
    first_merge: dict[str, datetime] = {}

    for pr in prs:
        if pr.author not in new_participants:
            continue
        _update_earliest(first_pr_created, pr.author, pr.created_at)
        if pr.is_merged and pr.merged_at is not None:
            _update_earliest(first_merge, pr.author, pr.merged_at)

    onboarding_days: list[float] = []
    for participant in new_participants:
        if participant not in first_merge:
            continue
        t_first = first_pr_created[participant]
        t_merge = first_merge[participant]
        onboarding_days.append((t_merge - t_first).total_seconds() / 86400)

    n = len(onboarding_days)
    return (median(onboarding_days), n) if onboarding_days else (0.0, 0)


def _update_earliest(mapping: dict[str, datetime], login: str, t: datetime) -> None:
    if login not in mapping or t < mapping[login]:
        mapping[login] = t




@dataclass
class WasteResult:
    infra_wait_hours: float
    blockage_hours: float
    rework_hours: float

    @property
    def total_hours(self) -> float:
        return self.infra_wait_hours + self.blockage_hours + self.rework_hours

    def cost(self, hourly_rate: float) -> float:
        return self.total_hours * hourly_rate


def cost_of_process_waste(
    prs: list[PullRequest],
    issues: list[Issue],
    alpha: float = 1.0,
    beta: float = 1.0,
    gamma: float = 1.0,
    rework_hours_per_event: float = 1.5,
) -> WasteResult:
    infra_total = 0.0
    for pr in prs:
        qualifying = [
            cr for cr in pr.check_runs
            if cr.required
            and cr.started_at is not None
            and cr.completed_at is not None
        ]
        if qualifying:
            wall_clock = (
                max(cr.completed_at for cr in qualifying)
                - min(cr.started_at for cr in qualifying)
            ).total_seconds() / 3600
            if wall_clock > 0:
                infra_total += wall_clock

    blockage_total = sum(_blockage_hours_for_pr(pr) for pr in prs)

    reopen_count = 0
    for pr in prs:
        reopen_count += sum(1 for e in pr.timeline if isinstance(e, ReopenedEvent))
    for issue in issues:
        reopen_count += sum(1 for e in issue.timeline if isinstance(e, ReopenedEvent))

    rework_total = reopen_count * rework_hours_per_event

    return WasteResult(
        infra_wait_hours=alpha * infra_total,
        blockage_hours=beta * blockage_total,
        rework_hours=gamma * rework_total,
    )
