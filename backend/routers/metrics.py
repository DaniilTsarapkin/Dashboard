from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from backend.routers.data import get_current_bundle
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.metrics.snapshot import compute_snapshot

router = APIRouter()


def _filter_bundle(bundle, from_days: Optional[int], to_days: Optional[int]):
    if from_days is None and to_days is None:
        return bundle

    now = datetime.now(timezone.utc)
    start = now - timedelta(days=from_days) if from_days is not None else None
    end = now - timedelta(days=to_days) if to_days is not None else now

    from copy import copy
    filtered = copy(bundle)

    def _in_range(item):
        t = getattr(item, 'merged_at', None) or getattr(item, 'updated_at', None) or getattr(item, 'created_at', None)
        if t is None:
            return True
        return (start is None or t >= start) and t <= end

    filtered.prs = [pr for pr in bundle.prs if _in_range(pr)]
    filtered.issues = [i for i in bundle.issues if _in_range(i)]
    return filtered


@router.get("/metrics/snapshot")
def get_snapshot(window_days: int = 90, from_days: Optional[int] = None, to_days: Optional[int] = None):
    bundle = _filter_bundle(get_current_bundle(), from_days, to_days)
    try:
        snapshot = compute_snapshot(bundle)
        return {
            "m01": snapshot.m01.__dict__,
            "m02": snapshot.m02.__dict__,
            "m03": snapshot.m03.__dict__,
            "m04": snapshot.m04.__dict__,
            "m05": snapshot.m05.__dict__,
            "m06": snapshot.m06.__dict__,
            "m07": snapshot.m07.__dict__,
            "m08": snapshot.m08.__dict__,
            "m09": snapshot.m09.__dict__,
            "m10": snapshot.m10.__dict__,
            "m10_available": snapshot.m10_available,
            "m11": snapshot.m11.__dict__,
            "m12": snapshot.m12.__dict__,
            "m13": snapshot.m13.__dict__,
            "m14": snapshot.m14.__dict__,
            "m15_days": snapshot.m15_days,
            "m15_n": snapshot.m15_n,
            "m16_waste": {
                "infra_wait_hours": snapshot.m16_waste.infra_wait_hours,
                "blockage_hours": snapshot.m16_waste.blockage_hours,
                "rework_hours": snapshot.m16_waste.rework_hours,
                "total_hours": snapshot.m16_waste.total_hours,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
