from __future__ import annotations

import math
from dataclasses import dataclass, field
from statistics import median, quantiles
from typing import Optional




@dataclass
class MetricResult:
    value: float
    p50: float
    p75: float
    p90: float
    base_value: float
    inverse: bool = False

    @property
    def status(self) -> tuple[str, str]:
        from src.metrics.helpers import get_status
        return get_status(self.value, self.p50, self.p75, self.p90,
                          inverse=self.inverse)

    @property
    def trend(self) -> tuple[str, str]:
        from src.metrics.helpers import get_trend_arrow
        return get_trend_arrow(self.value, self.base_value,
                               inverse=self.inverse)

    @property
    def severity(self) -> float:
        if self.inverse:
            return max(0.0, 0.5 - self.value)
        return max(0.0, (self.value - self.p75) / (self.p90 - self.p75 + 1e-9))




@dataclass
class MetricsSnapshot:
    m01: MetricResult
    m02: MetricResult
    m03: MetricResult
    m04: MetricResult
    m05: MetricResult
    m06: MetricResult
    m07: MetricResult
    m08: MetricResult
    m09: MetricResult
    m10: MetricResult
    m10_available: bool
    m11: MetricResult
    m12: MetricResult
    m13: MetricResult
    m14: MetricResult
    m15_days: float
    m15_n: int
    m16_waste: object

    def top_problems(self, n: int = 3) -> list[tuple[str, MetricResult]]:
        candidates = [
            ("M01", self.m01), ("M02", self.m02), ("M03", self.m03),
            ("M04", self.m04), ("M05", self.m05), ("M06", self.m06),
            ("M07", self.m07), ("M08", self.m08), ("M09", self.m09),
            ("M11", self.m11), ("M12", self.m12),
        ]
        if self.m10_available:
            candidates.append(("M10", self.m10))
        return sorted(candidates, key=lambda x: x[1].severity, reverse=True)[:n]

    def group_status(self, group: int) -> tuple[str, str]:
        groups: dict[int, list[MetricResult]] = {
            1: [self.m01, self.m02, self.m03, self.m04],
            2: [self.m05, self.m06, self.m07],
            3: [self.m08, self.m09] + ([self.m10] if self.m10_available else []),
            4: [self.m11, self.m12],
            5: [self.m13, self.m14],
        }
        metrics = groups.get(group, [])
        if not metrics:
            return ("#95a5a6", "Нет данных")
        worst = max(metrics, key=lambda m: m.severity)
        return worst.status




def _m01_per_pr(prs) -> list[float]:
    from src.metrics.helpers import _pr_m01
    return [v for pr in prs if (v := _pr_m01(pr)) is not None]


def _m02_per_pr(prs) -> list[float]:
    from src.metrics.group5_org import _blockage_hours_for_pr
    return [_blockage_hours_for_pr(pr) for pr in prs]


def _m05_per_pr(prs) -> list[float]:
    vals = []
    for pr in prs:
        if pr.changed_files == 0 and pr.churn == 0:
            continue
        rci = (
            0.5 * math.log(1 + pr.changed_files)
            + 0.3 * math.log(1 + pr.churn)
            + 0.2 * math.log(1 + len(pr.directories_touched))
        )
        vals.append(rci)
    return vals


def _m09_per_item(prs, issues) -> list[float]:
    from datetime import timedelta

    from src.data.models import ClosedEvent, ReopenedEvent

    window = timedelta(days=14)
    vals = []
    for item in [*prs, *issues]:
        closed_times = [
            e.created_at for e in item.timeline
            if isinstance(e, ClosedEvent) and e.created_at
        ]
        if not closed_times:
            continue
        last_close = max(closed_times)
        deadline = last_close + window
        reopened = any(
            isinstance(e, ReopenedEvent)
            and e.created_at
            and last_close < e.created_at <= deadline
            for e in item.timeline
        )
        vals.append(1.0 if reopened else 0.0)
    return vals


def _m11_per_pr(prs) -> list[float]:
    from src.metrics.helpers import _pr_cf
    return [_pr_cf(pr) for pr in prs]


def _safe_percentiles(vals: list[float]) -> tuple[float, float, float]:
    if len(vals) >= 4:
        qs = quantiles(vals, n=100)
        return (qs[49], qs[74], qs[89])
    if len(vals) == 1:
        v = vals[0]
        if v == 0.0:
            return (0.0, 0.0, 0.0)
        return (v * 0.5, v * 1.5, v * 3.0)
    if len(vals) in (2, 3):
        m = median(vals)
        return (m * 0.5, m * 1.5, m * 3.0)
    return (0.0, 0.0, 0.0)


def _make(
    value: float,
    vals: list[float],
    base_value: float,
    inverse: bool = False,
) -> MetricResult:
    p50, p75, p90 = _safe_percentiles(vals)
    return MetricResult(
        value=value, p50=p50, p75=p75, p90=p90,
        base_value=base_value, inverse=inverse,
    )




def compute_snapshot(bundle: "DataBundle") -> MetricsSnapshot:
    from src.metrics import (
        collaboration_friction,
        cost_of_process_waste,
        environment_safety_score,
        exploration_overhead,
        feedback_loop_latency,
        fragmentation_rate,
        infrastructure_wait_time,
        knowledge_concentration_risk,
        onboarding_efficiency,
        post_interruption_recovery_cost,
        process_blockage_time,
        psychological_safety_signal,
        requirements_clarity_score,
        review_complexity_index,
        rework_rate,
        systemic_overload_index,
    )

    prs = bundle.prs
    issues = bundle.issues
    base_prs = bundle.base_prs
    base_issues = bundle.base_issues
    commit_files = bundle.commit_files

    cur_m01 = feedback_loop_latency(prs)
    cur_m02 = process_blockage_time(prs)
    cur_m03 = fragmentation_rate(prs, issues)
    cur_m04 = post_interruption_recovery_cost(prs)
    cur_m05 = review_complexity_index(prs)
    cur_m06 = requirements_clarity_score(prs)
    cur_m07 = exploration_overhead(prs, commit_files)
    cur_m08 = environment_safety_score(prs)
    cur_m09 = rework_rate(prs, issues)
    cur_m10_raw = infrastructure_wait_time(prs)
    cur_m10 = cur_m10_raw if cur_m10_raw is not None else 0.0
    m10_available = cur_m10_raw is not None
    cur_m11 = collaboration_friction(prs)
    cur_m12 = psychological_safety_signal(prs, issues)
    cur_m13 = systemic_overload_index(base_prs, base_issues, prs, issues)
    cur_m14 = knowledge_concentration_risk(prs)
    cur_m15_days, cur_m15_n = onboarding_efficiency(prs, since=bundle.window_start)
    cur_m16 = cost_of_process_waste(prs, issues)

    base_m01 = feedback_loop_latency(base_prs)
    base_m02 = process_blockage_time(base_prs)
    base_m03 = fragmentation_rate(base_prs, base_issues)
    base_m04 = post_interruption_recovery_cost(base_prs)
    base_m05 = review_complexity_index(base_prs)
    base_m06 = requirements_clarity_score(base_prs)
    base_m07 = exploration_overhead(base_prs, {})
    base_m08 = environment_safety_score(base_prs)
    base_m09 = rework_rate(base_prs, base_issues)
    base_m10_raw = infrastructure_wait_time(base_prs)
    base_m10 = base_m10_raw if base_m10_raw is not None else 0.0
    base_m11 = collaboration_friction(base_prs)
    base_m12 = psychological_safety_signal(base_prs, base_issues)
    base_m13 = systemic_overload_index([], [], base_prs, base_issues)
    base_m14 = knowledge_concentration_risk(base_prs)

    d_m01 = _m01_per_pr(prs)
    d_m02 = _m02_per_pr(prs)
    d_m05 = _m05_per_pr(prs)
    d_m09 = _m09_per_item(prs, issues)
    d_m11 = _m11_per_pr(prs)

    return MetricsSnapshot(
        m01=_make(cur_m01, d_m01, base_m01),
        m02=_make(cur_m02, d_m02, base_m02),
        m03=_make(cur_m03, [cur_m03], base_m03),
        m04=_make(cur_m04, [cur_m04], base_m04),
        m05=_make(cur_m05, d_m05, base_m05),
        m06=_make(cur_m06, [cur_m06], base_m06, inverse=True),
        m07=_make(cur_m07, [cur_m07], base_m07),
        m08=_make(cur_m08, [cur_m08], base_m08, inverse=True),
        m09=_make(cur_m09, d_m09, base_m09),
        m10=_make(cur_m10, [cur_m10], base_m10),
        m10_available=m10_available,
        m11=_make(cur_m11, d_m11, base_m11),
        m12=_make(cur_m12, [cur_m12], base_m12, inverse=True),
        m13=_make(cur_m13, [cur_m13], base_m13),
        m14=_make(cur_m14, [cur_m14], base_m14),
        m15_days=cur_m15_days,
        m15_n=cur_m15_n,
        m16_waste=cur_m16,
    )
