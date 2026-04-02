from __future__ import annotations

import math
from statistics import median
from typing import TYPE_CHECKING

from ..data.models import CommitEvent, CommentEvent, PullRequest, ReviewEvent, is_bot

if TYPE_CHECKING:
    from ..data.models import CommitWithFiles

DEFAULT_RCI_WEIGHTS = (0.5, 0.3, 0.2)




def review_complexity_index(
    prs: list[PullRequest],
    *,
    w1: float = DEFAULT_RCI_WEIGHTS[0],
    w2: float = DEFAULT_RCI_WEIGHTS[1],
    w3: float = DEFAULT_RCI_WEIGHTS[2],
) -> float:
    scores: list[float] = []

    for pr in prs:
        if pr.changed_files == 0 and pr.churn == 0:
            continue

        rci = (
            w1 * math.log(1 + pr.changed_files)
            + w2 * math.log(1 + pr.churn)
            + w3 * math.log(1 + len(pr.directories_touched))
        )
        scores.append(rci)

    return median(scores) if scores else 0.0




def requirements_clarity_score(prs: list[PullRequest]) -> float:
    scores: list[float] = []

    for pr in prs:
        timed: list[tuple[object, object]] = []
        for event in pr.timeline:
            if isinstance(event, ReviewEvent):
                t = event.submitted_at
            elif isinstance(event, CommitEvent):
                t = event.committed_date
            elif isinstance(event, CommentEvent):
                t = event.created_at
            else:
                continue
            if t is not None:
                timed.append((t, event))

        timed.sort(key=lambda x: x[0])

        state = "start"
        iteration_count = 0

        for _, event in timed:
            is_feedback = (
                isinstance(event, (ReviewEvent, CommentEvent))
                and (
                    event.author if isinstance(event, CommentEvent) else event.author
                ) != pr.author
                and not is_bot(
                    event.author if isinstance(event, CommentEvent) else event.author
                )
            )
            is_author_commit = (
                isinstance(event, CommitEvent)
                and event.author_login == pr.author
            )

            if is_feedback:
                if state == "after_FC":
                    iteration_count += 1
                    state = "after_F"
                elif state == "start":
                    state = "after_F"

            elif is_author_commit:
                if state == "after_F":
                    state = "after_FC"

        scores.append(1.0 / (1 + iteration_count))

    return median(scores) if scores else 1.0




def exploration_overhead(
    prs: list[PullRequest],
    commit_files: dict[str, list["CommitWithFiles"]],
) -> float:
    scores: list[float] = []

    for pr in prs:
        commits = commit_files.get(str(pr.number))
        if not commits:
            continue

        final_paths: set[str] = {f.path for f in pr.files}

        all_touched: set[str] = set()
        for cwf in commits:
            for f in cwf.files:
                all_touched.add(f.path)

        dead_end_files = all_touched - final_paths

        total_churn = 0
        dead_end_churn = 0
        for cwf in commits:
            for f in cwf.files:
                churn = f.additions + f.deletions
                total_churn += churn
                if f.path in dead_end_files:
                    dead_end_churn += churn

        eo = dead_end_churn / (total_churn + 1)
        scores.append(eo)

    return median(scores) if scores else 0.0
