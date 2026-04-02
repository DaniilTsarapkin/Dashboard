from __future__ import annotations

import logging
import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from statistics import median, quantiles
from typing import Optional

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

from backend.routers.data import get_current_bundle

router = APIRouter()


def _p90(vals: list[float]) -> float:
    if len(vals) < 4:
        return max(vals) if vals else 0.0
    return quantiles(vals, n=100)[89]


@router.get("/charts/all")
def get_all_charts(from_days: Optional[int] = None, to_days: Optional[int] = None):
  try:
    bundle = get_current_bundle()

    now = datetime.now(timezone.utc)
    start = now - timedelta(days=from_days) if from_days is not None else None
    end = now - timedelta(days=to_days) if to_days is not None else now

    def _in_range(item):
        t = getattr(item, 'merged_at', None) or getattr(item, 'updated_at', None) or getattr(item, 'created_at', None)
        if t is None:
            return True
        return (start is None or t >= start) and t <= end

    prs    = [pr for pr in bundle.prs if _in_range(pr)] if (from_days is not None or to_days is not None) else bundle.prs
    issues = bundle.issues
    base_prs    = bundle.base_prs
    base_issues = bundle.base_issues

    from src.metrics import (
        cost_of_process_waste,
        environment_safety_score,
        feedback_loop_latency,
        process_blockage_time,
        psychological_safety_signal,
        requirements_clarity_score,
        review_complexity_index,
        rework_rate,
        systemic_overload_index,
    )
    from src.metrics.group5_org import _blockage_hours_for_pr
    from src.metrics.helpers import _pr_m01, _pr_m10, _pr_lifetime_hours
    from src.data.models import CommentEvent, CommitEvent, ReviewEvent, is_bot

    weekly_map: dict[tuple[int, int], list] = defaultdict(list)
    for pr in prs:
        anchor = pr.merged_at or pr.updated_at
        if anchor:
            iso = anchor.isocalendar()
            weekly_map[(iso.year, iso.week)].append(pr)

    weeks      = sorted(weekly_map.keys())
    week_labels = [f"{y}-W{w:02d}" for y, w in weeks]

    weekly = {
        "labels": week_labels,
        "m01": [feedback_loop_latency(weekly_map[k]) for k in weeks],
        "m02": [process_blockage_time(weekly_map[k]) for k in weeks],
        "m05": [review_complexity_index(weekly_map[k]) for k in weeks],
        "m06": [requirements_clarity_score(weekly_map[k]) for k in weeks],
        "m08": [environment_safety_score(weekly_map[k]) for k in weeks],
        "m09": [rework_rate(weekly_map[k], issues) for k in weeks],
        "m12": [psychological_safety_signal(weekly_map[k], issues) for k in weeks],
        "m13": [
            systemic_overload_index(base_prs, base_issues, weekly_map[k], issues)
            for k in weeks
        ],
        "m16": [
            cost_of_process_waste(weekly_map[k], issues).total_hours
            for k in weeks
        ],
    }

    m01_hist: list[float] = []
    m02_hist: list[float] = []
    lifecycle_rows: list[tuple] = []

    for pr in prs:
        v01 = _pr_m01(pr)
        v02 = _blockage_hours_for_pr(pr)
        v10 = _pr_m10(pr)
        m02_hist.append(v02)
        if v01 is not None:
            m01_hist.append(v01)
            total = _pr_lifetime_hours(pr)
            if total and total > 0:
                t_other  = max(0.0, v02 - v01)
                t_active = max(0.0, total - v01 - v10 - t_other)
                lifecycle_rows.append((v01, v10, t_other, t_active))

    lifecycle = (
        {
            "review_wait": median(r[0] for r in lifecycle_rows),
            "ci_wait":     median(r[1] for r in lifecycle_rows),
            "other_wait":  median(r[2] for r in lifecycle_rows),
            "active":      median(r[3] for r in lifecycle_rows),
        }
        if lifecycle_rows
        else {"review_wait": 0.0, "ci_wait": 0.0, "other_wait": 0.0, "active": 0.0}
    )

    p90_m01 = _p90(m01_hist)
    p90_m02 = _p90(m02_hist)
    m10_vals = [_pr_m10(pr) for pr in prs]
    p90_m10  = _p90(m10_vals)

    outliers = sorted(
        [
            {
                "number": pr.number,
                "title":  pr.title[:80],
                "m01":    round(_pr_m01(pr) or 0.0, 1),
                "m02":    round(_blockage_hours_for_pr(pr), 1),
                "m10":    round(_pr_m10(pr), 1),
                "state":  pr.state.value,
                "author": pr.author,
                "created_at": pr.created_at.strftime("%d.%m.%Y") if pr.created_at else "—",
            }
            for pr in prs
            if ((_pr_m01(pr) or 0.0) > p90_m01
                or _blockage_hours_for_pr(pr) > p90_m02
                or _pr_m10(pr) > p90_m10)
        ],
        key=lambda r: -r["m01"],
    )

    scatter = []
    for pr in prs:
        v01 = _pr_m01(pr)
        if v01 is None or (pr.changed_files == 0 and pr.churn == 0):
            continue
        rci = (
            0.5 * math.log(1 + pr.changed_files)
            + 0.3 * math.log(1 + pr.churn)
            + 0.2 * math.log(1 + len(pr.directories_touched))
        )
        scatter.append({
            "pr":     pr.number,
            "title":  pr.title[:60],
            "rci":    round(rci, 3),
            "m01":    round(v01, 2),
            "author": pr.author,
        })

    module_activity: dict[str, int] = defaultdict(int)
    module_eo: dict[str, list[float]] = defaultdict(list)
    commit_files = bundle.commit_files

    for pr in prs:
        pr_modules = {f.directory for f in pr.files}
        for mod in pr_modules:
            module_activity[mod] += 1
        commits = commit_files.get(str(pr.number))
        if not commits:
            continue
        final_paths = {f.path for f in pr.files}
        all_touched: set[str] = set()
        for cwf in commits:
            for f in cwf.files:
                all_touched.add(f.path)
        dead_end = all_touched - final_paths
        total_churn = sum(f.additions + f.deletions for cwf in commits for f in cwf.files)
        dead_end_churn = sum(
            f.additions + f.deletions
            for cwf in commits for f in cwf.files
            if f.path in dead_end
        )
        eo = dead_end_churn / (total_churn + 1)
        for mod in pr_modules:
            module_eo[mod].append(eo)

    modules_load = [
        {
            "module":   mod,
            "activity": module_activity[mod],
            "eo":       round(median(module_eo[mod]) if module_eo.get(mod) else 0.0, 3),
        }
        for mod in sorted(module_activity)
    ]

    module_author_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for pr in prs:
        for mod in {f.directory for f in pr.files}:
            module_author_counts[mod][pr.author] += 1

    author_totals: dict[str, int] = defaultdict(int)
    for ac in module_author_counts.values():
        for author, cnt in ac.items():
            author_totals[author] += cnt
    top_authors = sorted(author_totals, key=lambda a: -author_totals[a])[:15]

    def _max_share(mod: str) -> float:
        counts = module_author_counts[mod]
        total  = sum(counts.values())
        return max(counts.values()) / total if total else 0.0

    sorted_mods = sorted(module_author_counts.keys(), key=_max_share, reverse=True)

    heatmap_z = [
        [
            (module_author_counts[mod].get(a, 0) / sum(module_author_counts[mod].values()))
            if sum(module_author_counts[mod].values()) > 0 else 0.0
            for a in top_authors
        ]
        for mod in sorted_mods
    ]

    def _pr_cf(pr) -> float:
        discussion = sum(
            1 for e in pr.timeline
            if isinstance(e, CommentEvent) and not is_bot(e.author)
        ) + sum(
            e.comment_count for e in pr.timeline
            if isinstance(e, ReviewEvent) and not is_bot(e.author)
        )
        scale = 1 + math.log(1 + pr.changed_files)
        return discussion / scale

    m11_hist = [round(_pr_cf(pr), 3) for pr in prs]

    p90_cf = _p90(m11_hist)
    m11_outliers = sorted(
        [
            {
                "number": pr.number,
                "title":  pr.title[:80],
                "cf":     round(_pr_cf(pr), 2),
                "changed_files": pr.changed_files,
                "state":  pr.state.value,
                "author": pr.author,
            }
            for pr in prs
            if _pr_cf(pr) > p90_cf
        ],
        key=lambda r: -r["cf"],
    )[:10]

    window_start = bundle.window_start
    step1 = step2 = step3 = 0
    onboarding_days = 0.0

    if window_start is not None:
        earliest: dict[str, object] = {}
        for pr in prs:
            t = pr.created_at
            if pr.author not in earliest or t < earliest[pr.author]:
                earliest[pr.author] = t
            for ev in pr.timeline:
                if (
                    isinstance(ev, CommitEvent)
                    and ev.author_login == pr.author
                    and ev.committed_date
                ):
                    tc = ev.committed_date
                    if pr.author not in earliest or tc < earliest[pr.author]:
                        earliest[pr.author] = tc

        new_authors = {login for login, t in earliest.items() if t >= window_start}
        step1 = len(new_authors)

        received_feedback: set[str] = set()
        for pr in prs:
            if pr.author not in new_authors:
                continue
            for ev in pr.timeline:
                actor = ev.author if isinstance(ev, (ReviewEvent, CommentEvent)) else None
                if actor and actor != pr.author and actor != "ghost" and not is_bot(actor):
                    received_feedback.add(pr.author)
                    break
        step2 = len(received_feedback)

        from src.metrics.group5_org import onboarding_efficiency
        onboarding_days, step3 = onboarding_efficiency(prs, since=window_start)

    theta = 0.6
    m14_modules = sorted(
        [
            {
                "module":    mod,
                "max_share": round(_max_share(mod), 3),
                "authors":   {
                    a: round(cnt / sum(module_author_counts[mod].values()), 3)
                    for a, cnt in module_author_counts[mod].items()
                },
            }
            for mod in module_author_counts
            if _max_share(mod) >= theta
        ],
        key=lambda x: -x["max_share"],
    )

    return {
        "weekly": weekly,
        "flow": {
            "lifecycle": lifecycle,
            "m01_hist":  m01_hist,
            "m02_hist":  m02_hist,
            "outliers":  outliers,
        },
        "load": {
            "scatter": scatter,
            "modules": modules_load,
        },
        "team": {
            "heatmap":      {"modules": sorted_mods, "authors": top_authors, "z": heatmap_z},
            "m11_hist":     m11_hist,
            "m11_outliers": m11_outliers,
        },
        "risks": {
            "m15_funnel":  {
                "step1": step1, "step2": step2, "step3": step3,
                "onboarding_days": round(onboarding_days, 1),
            },
            "m14_modules": m14_modules,
        },
    }
  except HTTPException:
    raise
  except Exception as e:
    logger.error(f"charts/all error: {e}", exc_info=True)
    raise HTTPException(status_code=500, detail=f"Ошибка вычисления графиков: {str(e)}")
