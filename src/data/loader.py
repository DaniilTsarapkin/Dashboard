from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from .github_client import GitHubClient


@dataclass
class DataBundle:
    prs: list
    issues: list

    base_prs: list
    base_issues: list

    commit_files: dict = field(default_factory=dict)

    owner: str = ""
    repo: str = ""
    window_start: datetime = None
    window_end: datetime = None
    loaded_at: datetime = None


def load_data(
    token: str,
    owner: str,
    repo: str,
    window_days: int = 90,
    load_commit_files: bool = True,
) -> DataBundle:
    client = GitHubClient(token, owner, repo)
    client.fetch_repository_info()

    window_end = datetime.now(timezone.utc)
    window_start = window_end - timedelta(days=window_days)
    base_start = window_start - timedelta(days=window_days)
    base_end = window_start

    prs = list(client.fetch_pull_requests(since=window_start, until=window_end))
    issues = list(client.fetch_issues(since=window_start, until=window_end))

    base_prs = list(client.fetch_pull_requests(since=base_start, until=base_end))
    base_issues = list(client.fetch_issues(since=base_start, until=base_end))

    commit_files: dict = {}
    if load_commit_files:
        for pr in prs:
            shas = [e.oid for e in pr.commit_events if e.oid]
            if shas:
                results = client.fetch_commit_files_batch(shas, max_commits=10)
                commit_files[str(pr.number)] = results

    return DataBundle(
        prs=prs,
        issues=issues,
        base_prs=base_prs,
        base_issues=base_issues,
        commit_files=commit_files,
        owner=owner,
        repo=repo,
        window_start=window_start,
        window_end=window_end,
        loaded_at=datetime.now(timezone.utc),
    )
