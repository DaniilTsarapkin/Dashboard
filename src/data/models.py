from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Union



KNOWN_BOTS: frozenset[str] = frozenset(
    {
        "dependabot",
        "dependabot-preview",
        "github-actions",
        "codecov",
        "renovate",
        "renovate-bot",
        "greenkeeper",
        "snyk-bot",
        "imgbot",
        "allcontributors",
        "stale",
        "bors",
        "mergify",
    }
)

POSITIVE_REACTION_CONTENTS: frozenset[str] = frozenset(
    {"THUMBS_UP", "LAUGH", "HOORAY", "HEART", "ROCKET"}
)
NEGATIVE_REACTION_CONTENTS: frozenset[str] = frozenset({"THUMBS_DOWN", "CONFUSED"})

HOTFIX_KEYWORDS: tuple[str, ...] = ("hotfix", "hot-fix", "urgent", "emergency", "critical")
REVERT_PREFIX = "revert"

SUPPORTIVE_TEXT_MARKERS: tuple[str, ...] = (
    "thanks", "thank you", "good catch", "nice", "appreciate",
    "lgtm", "great", "well done", "excellent", "awesome", "👍", "🙏",
)
NEGATIVE_TEXT_MARKERS: tuple[str, ...] = (
    "wtf", "nonsense", "obvious", "just do", "???",
    "why didn't you", "this is wrong", "this is bad", "terrible",
)


def is_bot(login: str) -> bool:
    return login.endswith("[bot]") or login.lower() in KNOWN_BOTS




class PRState(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    MERGED = "MERGED"


class ReviewState(str, Enum):
    APPROVED = "APPROVED"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"
    COMMENTED = "COMMENTED"
    DISMISSED = "DISMISSED"
    PENDING = "PENDING"




@dataclass(frozen=True)
class PRFile:
    path: str
    additions: int
    deletions: int

    @property
    def churn(self) -> int:
        return self.additions + self.deletions

    @property
    def directory(self) -> str:
        parts = self.path.split("/")
        return parts[0] if len(parts) > 1 else "__root__"


@dataclass(frozen=True)
class CheckRun:
    name: str
    status: str
    conclusion: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    required: bool = True

    @property
    def duration_seconds(self) -> Optional[float]:
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None




@dataclass(frozen=True)
class CommitEvent:
    typename: str = field(default="PullRequestCommit", init=False)
    oid: str = ""
    committed_date: Optional[datetime] = None
    author_login: Optional[str] = None


@dataclass(frozen=True)
class ReviewEvent:
    typename: str = field(default="PullRequestReview", init=False)
    author: str = ""
    submitted_at: Optional[datetime] = None
    state: str = ""
    body: str = ""
    comment_count: int = 0
    reactions: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class CommentEvent:
    typename: str = field(default="IssueComment", init=False)
    author: str = ""
    created_at: Optional[datetime] = None
    body: str = ""
    reactions: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class ReadyForReviewEvent:
    typename: str = field(default="ReadyForReviewEvent", init=False)
    created_at: Optional[datetime] = None
    actor: str = ""


@dataclass(frozen=True)
class ConvertToDraftEvent:
    typename: str = field(default="ConvertToDraftEvent", init=False)
    created_at: Optional[datetime] = None
    actor: str = ""


@dataclass(frozen=True)
class ReopenedEvent:
    typename: str = field(default="ReopenedEvent", init=False)
    created_at: Optional[datetime] = None
    actor: str = ""


@dataclass(frozen=True)
class ClosedEvent:
    typename: str = field(default="ClosedEvent", init=False)
    created_at: Optional[datetime] = None
    actor: str = ""


@dataclass(frozen=True)
class MergedEvent:
    typename: str = field(default="MergedEvent", init=False)
    created_at: Optional[datetime] = None
    actor: str = ""


TimelineEvent = Union[
    CommitEvent,
    ReviewEvent,
    CommentEvent,
    ReadyForReviewEvent,
    ConvertToDraftEvent,
    ReopenedEvent,
    ClosedEvent,
    MergedEvent,
]




@dataclass
class PullRequest:
    number: int
    title: str
    state: PRState
    is_draft: bool
    author: str
    created_at: datetime
    updated_at: datetime
    merged_at: Optional[datetime]
    closed_at: Optional[datetime]
    ready_for_review_at: Optional[datetime]
    additions: int
    deletions: int
    changed_files: int
    labels: list[str]
    files: list[PRFile]
    timeline: list[TimelineEvent]
    check_runs: list[CheckRun]
    reactions: tuple[str, ...]


    @property
    def churn(self) -> int:
        return self.additions + self.deletions

    @property
    def directories_touched(self) -> frozenset[str]:
        return frozenset(f.directory for f in self.files)

    @property
    def request_time(self) -> datetime:
        return self.ready_for_review_at or self.created_at

    @property
    def is_merged(self) -> bool:
        return self.state == PRState.MERGED

    @property
    def is_revert(self) -> bool:
        return self.title.lower().startswith(REVERT_PREFIX)

    @property
    def is_hotfix(self) -> bool:
        title_lower = self.title.lower()
        label_lower = " ".join(self.labels).lower()
        return any(kw in title_lower or kw in label_lower for kw in HOTFIX_KEYWORDS)

    @property
    def human_review_events(self) -> list[ReviewEvent]:
        return [
            e for e in self.timeline
            if isinstance(e, ReviewEvent) and not is_bot(e.author) and e.author != self.author
        ]

    @property
    def human_comment_events(self) -> list[CommentEvent]:
        return [
            e for e in self.timeline
            if isinstance(e, CommentEvent) and not is_bot(e.author) and e.author != self.author
        ]

    @property
    def commit_events(self) -> list[CommitEvent]:
        return [e for e in self.timeline if isinstance(e, CommitEvent)]

    @property
    def positive_reaction_count(self) -> int:
        return sum(1 for r in self.reactions if r in POSITIVE_REACTION_CONTENTS)

    @property
    def negative_reaction_count(self) -> int:
        return sum(1 for r in self.reactions if r in NEGATIVE_REACTION_CONTENTS)


@dataclass
class CommitWithFiles:
    oid: str
    committed_date: datetime
    author_login: Optional[str]
    files: list[PRFile] = field(default_factory=list)

    @property
    def directories_touched(self) -> frozenset[str]:
        return frozenset(f.directory for f in self.files)


@dataclass
class Issue:
    number: int
    title: str
    state: str
    author: str
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime]
    labels: list[str]
    timeline: list[TimelineEvent]
    reactions: tuple[str, ...]
    comment_count: int

    @property
    def positive_reaction_count(self) -> int:
        return sum(1 for r in self.reactions if r in POSITIVE_REACTION_CONTENTS)

    @property
    def negative_reaction_count(self) -> int:
        return sum(1 for r in self.reactions if r in NEGATIVE_REACTION_CONTENTS)

    @property
    def was_reopened(self) -> bool:
        return any(isinstance(e, ReopenedEvent) for e in self.timeline)
