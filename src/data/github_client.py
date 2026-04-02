from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
from typing import Generator, Optional

import requests

from .models import (
    CheckRun,
    CommitEvent,
    CommitWithFiles,
    CommentEvent,
    ClosedEvent,
    ConvertToDraftEvent,
    Issue,
    MergedEvent,
    PRFile,
    PRState,
    PullRequest,
    ReadyForReviewEvent,
    ReopenedEvent,
    ReviewEvent,
    TimelineEvent,
    is_bot,
)
from .queries import (
    ISSUES_QUERY,
    PR_FILES_PAGE_QUERY,
    PR_TIMELINE_PAGE_QUERY,
    PULL_REQUESTS_QUERY,
    RATE_LIMIT_QUERY,
    REPOSITORY_INFO_QUERY,
)

logger = logging.getLogger(__name__)

GRAPHQL_URL = "https://api.github.com/graphql"
REST_BASE_URL = "https://api.github.com"

DEFAULT_PAGE_SIZE = 20




class GitHubError(Exception):
    pass


class RateLimitError(GitHubError):
    def __init__(self, reset_at: Optional[datetime]) -> None:
        self.reset_at = reset_at
        super().__init__(
            f"GitHub rate limit exhausted. Resets at {reset_at.isoformat() if reset_at else 'unknown'}."
        )


class RepositoryNotFoundError(GitHubError):
    pass




def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _login_from_actor(node: Optional[dict]) -> str:
    if not node:
        return "ghost"
    return node.get("login") or "ghost"




class GitHubClient:
    def __init__(self, token: str, owner: str, repo: str) -> None:
        self.owner = owner
        self.repo = repo
        self._session = requests.Session()
        self._session.headers.update(
            {
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            }
        )
        self._rate_limit_remaining: Optional[int] = None
        self._rate_limit_reset_at: Optional[datetime] = None

    @classmethod
    def from_env(cls, owner: str, repo: str) -> "GitHubClient":
        token = os.environ.get("GITHUB_TOKEN", "").strip()
        if not token:
            raise EnvironmentError(
                "GITHUB_TOKEN environment variable is not set. "
                "Generate a token at https://github.com/settings/tokens "
                "with 'repo' and 'read:org' scopes."
            )
        return cls(token, owner, repo)


    def _graphql(self, query: str, variables: dict) -> dict:
        resp = self._session.post(
            GRAPHQL_URL,
            json={"query": query, "variables": variables},
            timeout=30,
        )
        resp.raise_for_status()
        body = resp.json()

        if errors := body.get("errors"):
            msg = errors[0].get("message", str(errors))
            if "Could not resolve to a Repository" in msg:
                raise RepositoryNotFoundError(
                    f"Repository {self.owner}/{self.repo} not found or inaccessible."
                )
            raise GitHubError(f"GraphQL error: {msg}")

        data = body.get("data", {})

        if rate := data.get("rateLimit"):
            self._rate_limit_remaining = rate.get("remaining")
            self._rate_limit_reset_at = _parse_dt(rate.get("resetAt"))
            logger.debug(
                "Rate limit: %d/%d remaining (query cost: %d)",
                rate.get("remaining", -1),
                rate.get("limit", -1),
                rate.get("cost", -1),
            )
            if rate.get("remaining", 1) == 0:
                raise RateLimitError(self._rate_limit_reset_at)

        return data

    def _rest_get(self, path: str, params: Optional[dict] = None) -> dict | list:
        resp = self._session.get(
            f"{REST_BASE_URL}{path}",
            params=params,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()


    def _parse_timeline_node(self, node: dict) -> Optional[TimelineEvent]:
        typename = node.get("__typename", "")

        if typename == "PullRequestCommit":
            c = node["commit"]
            user_node = (c.get("author") or {}).get("user")
            login = user_node["login"] if user_node else None
            return CommitEvent(
                oid=c["oid"],
                committed_date=_parse_dt(c["committedDate"]),
                author_login=login,
            )

        if typename == "PullRequestReview":
            reactions = tuple(
                r["content"]
                for r in node.get("reactions", {}).get("nodes", [])
            )
            return ReviewEvent(
                author=_login_from_actor(node.get("author")),
                submitted_at=_parse_dt(node.get("submittedAt")),
                state=node.get("state", ""),
                body=node.get("body", ""),
                comment_count=node.get("comments", {}).get("totalCount", 0),
                reactions=reactions,
            )

        if typename == "IssueComment":
            reactions = tuple(
                r["content"]
                for r in node.get("reactions", {}).get("nodes", [])
            )
            return CommentEvent(
                author=_login_from_actor(node.get("author")),
                created_at=_parse_dt(node.get("createdAt")),
                body=node.get("body", ""),
                reactions=reactions,
            )

        if typename == "ReadyForReviewEvent":
            return ReadyForReviewEvent(
                created_at=_parse_dt(node.get("createdAt")),
                actor=_login_from_actor(node.get("actor")),
            )

        if typename == "ConvertToDraftEvent":
            return ConvertToDraftEvent(
                created_at=_parse_dt(node.get("createdAt")),
                actor=_login_from_actor(node.get("actor")),
            )

        if typename == "ReopenedEvent":
            return ReopenedEvent(
                created_at=_parse_dt(node.get("createdAt")),
                actor=_login_from_actor(node.get("actor")),
            )

        if typename == "ClosedEvent":
            return ClosedEvent(
                created_at=_parse_dt(node.get("createdAt")),
                actor=_login_from_actor(node.get("actor")),
            )

        if typename == "MergedEvent":
            return MergedEvent(
                created_at=_parse_dt(node.get("createdAt")),
                actor=_login_from_actor(node.get("actor")),
            )

        logger.debug("Skipping unknown timeline typename: %s", typename)
        return None


    def _fetch_remaining_timeline(
        self, pr_number: int, after_cursor: str
    ) -> list[TimelineEvent]:
        events: list[TimelineEvent] = []
        cursor = after_cursor

        while cursor:
            data = self._graphql(
                PR_TIMELINE_PAGE_QUERY,
                {
                    "owner": self.owner,
                    "repo": self.repo,
                    "number": pr_number,
                    "after": cursor,
                },
            )
            tl = data["repository"]["pullRequest"]["timelineItems"]
            for node in tl["nodes"]:
                if event := self._parse_timeline_node(node):
                    events.append(event)

            page_info = tl["pageInfo"]
            cursor = page_info["endCursor"] if page_info["hasNextPage"] else None

        return events


    def _fetch_remaining_files(
        self, pr_number: int, after_cursor: str
    ) -> list[PRFile]:
        files: list[PRFile] = []
        cursor = after_cursor

        while cursor:
            data = self._graphql(
                PR_FILES_PAGE_QUERY,
                {
                    "owner": self.owner,
                    "repo": self.repo,
                    "number": pr_number,
                    "after": cursor,
                },
            )
            page = data["repository"]["pullRequest"]["files"]
            for f in page["nodes"]:
                files.append(
                    PRFile(
                        path=f["path"],
                        additions=f["additions"],
                        deletions=f["deletions"],
                    )
                )

            page_info = page["pageInfo"]
            cursor = page_info["endCursor"] if page_info["hasNextPage"] else None

        return files


    def _parse_pr(self, node: dict) -> PullRequest:
        author = _login_from_actor(node.get("author"))
        labels = [lbl["name"] for lbl in node.get("labels", {}).get("nodes", [])]

        files_data = node.get("files", {})
        files: list[PRFile] = [
            PRFile(
                path=f["path"],
                additions=f["additions"],
                deletions=f["deletions"],
            )
            for f in files_data.get("nodes", [])
        ]
        files_page_info = files_data.get("pageInfo", {})
        if files_page_info.get("hasNextPage"):
            files.extend(
                self._fetch_remaining_files(node["number"], files_page_info["endCursor"])
            )

        reactions = tuple(
            r["content"] for r in node.get("reactions", {}).get("nodes", [])
        )

        tl_data = node.get("timelineItems", {})
        timeline: list[TimelineEvent] = []
        for tl_node in tl_data.get("nodes", []):
            if event := self._parse_timeline_node(tl_node):
                timeline.append(event)

        tl_page_info = tl_data.get("pageInfo", {})
        if tl_page_info.get("hasNextPage"):
            timeline.extend(
                self._fetch_remaining_timeline(node["number"], tl_page_info["endCursor"])
            )

        ready_for_review_at: Optional[datetime] = None
        for event in timeline:
            if isinstance(event, ReadyForReviewEvent):
                ready_for_review_at = event.created_at

        check_runs: list[CheckRun] = []
        for commit_node in node.get("commits", {}).get("nodes", []):
            for suite in commit_node["commit"].get("checkSuites", {}).get("nodes", []):
                for cr in suite.get("checkRuns", {}).get("nodes", []):
                    check_runs.append(
                        CheckRun(
                            name=cr["name"],
                            status=cr["status"],
                            conclusion=cr.get("conclusion"),
                            started_at=_parse_dt(cr.get("startedAt")),
                            completed_at=_parse_dt(cr.get("completedAt")),
                            required=True,
                        )
                    )

        return PullRequest(
            number=node["number"],
            title=node["title"],
            state=PRState(node["state"]),
            is_draft=node["isDraft"],
            author=author,
            created_at=_parse_dt(node["createdAt"]),
            updated_at=_parse_dt(node["updatedAt"]),
            merged_at=_parse_dt(node.get("mergedAt")),
            closed_at=_parse_dt(node.get("closedAt")),
            ready_for_review_at=ready_for_review_at,
            additions=node["additions"],
            deletions=node["deletions"],
            changed_files=node["changedFiles"],
            labels=labels,
            files=files,
            timeline=timeline,
            check_runs=check_runs,
            reactions=reactions,
        )


    def _parse_issue(self, node: dict) -> Issue:
        author = _login_from_actor(node.get("author"))
        labels = [lbl["name"] for lbl in node.get("labels", {}).get("nodes", [])]
        reactions = tuple(
            r["content"] for r in node.get("reactions", {}).get("nodes", [])
        )

        timeline: list[TimelineEvent] = []
        for tl_node in node.get("timelineItems", {}).get("nodes", []):
            if event := self._parse_timeline_node(tl_node):
                timeline.append(event)

        comment_count = sum(1 for e in timeline if isinstance(e, CommentEvent))

        return Issue(
            number=node["number"],
            title=node["title"],
            state=node["state"],
            author=author,
            created_at=_parse_dt(node["createdAt"]),
            updated_at=_parse_dt(node["updatedAt"]),
            closed_at=_parse_dt(node.get("closedAt")),
            labels=labels,
            timeline=timeline,
            reactions=reactions,
            comment_count=comment_count,
        )


    def fetch_pull_requests(
        self,
        since: datetime,
        until: Optional[datetime] = None,
        page_size: int = DEFAULT_PAGE_SIZE,
    ) -> Generator[PullRequest, None, None]:
        until = until or datetime.now(timezone.utc)
        cursor: Optional[str] = None

        while True:
            data = self._graphql(
                PULL_REQUESTS_QUERY,
                {
                    "owner": self.owner,
                    "repo": self.repo,
                    "first": page_size,
                    "after": cursor,
                },
            )
            page = data["repository"]["pullRequests"]
            nodes = page["nodes"]

            if not nodes:
                break

            for node in nodes:
                updated_at = _parse_dt(node["updatedAt"])

                if updated_at < since:
                    return

                if updated_at > until:
                    continue

                yield self._parse_pr(node)

            page_info = page["pageInfo"]
            if not page_info["hasNextPage"]:
                break
            cursor = page_info["endCursor"]

    def fetch_issues(
        self,
        since: datetime,
        until: Optional[datetime] = None,
        page_size: int = DEFAULT_PAGE_SIZE,
    ) -> Generator[Issue, None, None]:
        until = until or datetime.now(timezone.utc)
        cursor: Optional[str] = None

        while True:
            data = self._graphql(
                ISSUES_QUERY,
                {
                    "owner": self.owner,
                    "repo": self.repo,
                    "first": page_size,
                    "after": cursor,
                },
            )
            page = data["repository"]["issues"]
            nodes = page["nodes"]

            if not nodes:
                break

            for node in nodes:
                updated_at = _parse_dt(node["updatedAt"])
                if updated_at < since:
                    return
                if updated_at > until:
                    continue
                yield self._parse_issue(node)

            page_info = page["pageInfo"]
            if not page_info["hasNextPage"]:
                break
            cursor = page_info["endCursor"]

    def _fetch_commit_files_single(self, sha: str) -> CommitWithFiles:
        data = self._rest_get(
            f"/repos/{self.owner}/{self.repo}/commits/{sha}",
            params={"per_page": 300},
        )
        commit_info = data.get("commit", {})
        author_info = commit_info.get("author", {}) or {}

        files = [
            PRFile(
                path=f["filename"],
                additions=f.get("additions", 0),
                deletions=f.get("deletions", 0),
            )
            for f in data.get("files", [])
        ]

        committed_date = _parse_dt(author_info.get("date"))
        if committed_date is None:
            committed_date = datetime.now(timezone.utc)

        return CommitWithFiles(
            oid=data.get("sha", sha),
            committed_date=committed_date,
            author_login=data.get("author", {}).get("login") if data.get("author") else None,
            files=files,
        )

    def fetch_commit_files_batch(
        self,
        shas: list[str],
        max_commits: int = 10,
        delay_seconds: float = 0.5,
    ) -> list[CommitWithFiles]:
        if len(shas) > max_commits:
            logger.warning(
                "fetch_commit_files_batch: capping %d SHAs to %d to preserve REST rate limit",
                len(shas), max_commits,
            )
            shas = shas[:max_commits]
        results = []
        for i, sha in enumerate(shas):
            results.append(self._fetch_commit_files_single(sha))
            if i < len(shas) - 1:
                time.sleep(delay_seconds)
        return results

    def fetch_repository_info(self) -> dict:
        data = self._graphql(
            REPOSITORY_INFO_QUERY,
            {"owner": self.owner, "repo": self.repo},
        )
        repo = data.get("repository")
        if repo is None:
            raise RepositoryNotFoundError(
                f"Repository {self.owner}/{self.repo} not found or inaccessible."
            )
        return repo

    def check_rate_limit(self) -> dict:
        data = self._graphql(RATE_LIMIT_QUERY, {})
        return data.get("rateLimit", {})

    @property
    def rate_limit_remaining(self) -> Optional[int]:
        return self._rate_limit_remaining

    @property
    def rate_limit_reset_at(self) -> Optional[datetime]:
        return self._rate_limit_reset_at
