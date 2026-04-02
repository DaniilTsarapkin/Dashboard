from __future__ import annotations

import math
from statistics import median

from ..data.models import (
    NEGATIVE_REACTION_CONTENTS,
    NEGATIVE_TEXT_MARKERS,
    POSITIVE_REACTION_CONTENTS,
    SUPPORTIVE_TEXT_MARKERS,
    CommentEvent,
    Issue,
    PullRequest,
    ReviewEvent,
    is_bot,
)




def collaboration_friction(prs: list[PullRequest]) -> float:
    scores: list[float] = []

    for pr in prs:
        discussion = sum(
            1 for e in pr.timeline
            if isinstance(e, CommentEvent) and not is_bot(e.author)
        ) + sum(
            e.comment_count for e in pr.timeline
            if isinstance(e, ReviewEvent) and not is_bot(e.author)
        )

        scale = 1 + math.log(1 + pr.changed_files)
        scores.append(discussion / scale)

    return median(scores) if scores else 0.0




def psychological_safety_signal(
    prs: list[PullRequest],
    issues: list[Issue],
) -> float:
    if not prs and not issues:
        return 0.5

    reaction_support = 0
    reaction_negative = 0
    text_support = 0
    text_negative = 0

    for pr in prs:
        for content in pr.reactions:
            if content in POSITIVE_REACTION_CONTENTS:
                reaction_support += 1
            elif content in NEGATIVE_REACTION_CONTENTS:
                reaction_negative += 1

        for event in pr.timeline:
            if isinstance(event, ReviewEvent):
                for content in event.reactions:
                    if content in POSITIVE_REACTION_CONTENTS:
                        reaction_support += 1
                    elif content in NEGATIVE_REACTION_CONTENTS:
                        reaction_negative += 1
                body = event.body
            elif isinstance(event, CommentEvent):
                for content in event.reactions:
                    if content in POSITIVE_REACTION_CONTENTS:
                        reaction_support += 1
                    elif content in NEGATIVE_REACTION_CONTENTS:
                        reaction_negative += 1
                body = event.body
            else:
                continue

            if not body:
                continue
            lowered = body.lower()
            if any(marker in lowered for marker in SUPPORTIVE_TEXT_MARKERS):
                text_support += 1
            if any(marker in lowered for marker in NEGATIVE_TEXT_MARKERS):
                text_negative += 1

    for issue in issues:
        for content in issue.reactions:
            if content in POSITIVE_REACTION_CONTENTS:
                reaction_support += 1
            elif content in NEGATIVE_REACTION_CONTENTS:
                reaction_negative += 1

        for event in issue.timeline:
            if not isinstance(event, CommentEvent):
                continue
            for content in event.reactions:
                if content in POSITIVE_REACTION_CONTENTS:
                    reaction_support += 1
                elif content in NEGATIVE_REACTION_CONTENTS:
                    reaction_negative += 1

            body = event.body
            if not body:
                continue
            lowered = body.lower()
            if any(marker in lowered for marker in SUPPORTIVE_TEXT_MARKERS):
                text_support += 1
            if any(marker in lowered for marker in NEGATIVE_TEXT_MARKERS):
                text_negative += 1

    total_support = reaction_support + text_support
    total_negative = reaction_negative + text_negative
    if total_support == 0 and total_negative == 0:
        return 0.5
    return total_support / (total_support + total_negative + 1)
