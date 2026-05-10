import json
import random
from datetime import datetime, timedelta, timezone

random.seed(42)

NOW = datetime(2026, 4, 15, 12, 0, 0, tzinfo=timezone.utc)
WINDOW_DAYS = 90
WINDOW_START = NOW - timedelta(days=WINDOW_DAYS)
BASE_START = WINDOW_START - timedelta(days=WINDOW_DAYS)
BASE_END = WINDOW_START

DEVS = ["alice", "bob", "carol", "dave", "eve", "frank", "grace", "hank"]
REVIEWERS = ["alice", "bob", "carol", "dave", "eve"]
NEWBIES = [f"newbie{i}" for i in range(1, 15)]
MODULES = ["api", "core", "auth", "database", "utils", "tests", "docs", "scripts"]

def rdt(s, e):
    return s + timedelta(seconds=random.uniform(0, (e - s).total_seconds()))

def files(mods):
    r = []
    for m in mods:
        for i in range(random.randint(1, 3)):
            r.append({"path": f"{m}/f{i}.py", "additions": random.randint(10, 150), "deletions": random.randint(0, 60)})
    return r

def dead_files(mods):
    other = [m for m in MODULES if m not in mods]
    dead_mod = random.choice(other) if other else mods[0]
    return [{"path": f"{dead_mod}/explore_{j}.py", "additions": random.randint(20, 80),
             "deletions": random.randint(5, 30)} for j in range(random.randint(2, 4))]

def checks(t):
    s = t + timedelta(minutes=2)
    c = s + timedelta(minutes=random.randint(5, 20))
    return [{"name": n, "status": "COMPLETED", "conclusion": "SUCCESS",
             "started_at": s.isoformat(), "completed_at": c.isoformat(), "required": True}
            for n in ["CI: tests", "CI: lint", "CI: build"]]

def cev(a, t, oid=None):
    return {"typename": "PullRequestCommit", "oid": oid or f"{random.randint(1000000,9999999):07x}",
            "committed_date": t.isoformat(), "author_login": a}

def rev(r, t, st="APPROVED", body="", rx=()):
    return {"typename": "PullRequestReview", "author": r, "submitted_at": t.isoformat(),
            "state": st, "body": body, "comment_count": random.randint(0, 4), "reactions": list(rx)}

def cmt(a, t, body="", rx=()):
    return {"typename": "IssueComment", "author": a, "created_at": t.isoformat(),
            "body": body, "reactions": list(rx)}

def cls(a, t): return {"typename": "ClosedEvent", "created_at": t.isoformat(), "actor": a}
def mrg(a, t): return {"typename": "MergedEvent", "created_at": t.isoformat(), "actor": a}
def rop(a, t): return {"typename": "ReopenedEvent", "created_at": t.isoformat(), "actor": a}

def pr(num, title, auth, cr, mt, fl, tl, ck, cfd, st=None, lb=None):
    st = st or ("MERGED" if mt else "OPEN")
    ad = sum(f["additions"] for f in fl)
    dl = sum(f["deletions"] for f in fl)
    up = mt or (cr + timedelta(days=random.randint(1, 20)))
    return {"number": num, "title": title, "state": st, "is_draft": False,
            "author": auth, "created_at": cr.isoformat(), "updated_at": up.isoformat(),
            "merged_at": mt.isoformat() if mt else None,
            "closed_at": (mt.isoformat() if mt else None),
            "ready_for_review_at": None, "additions": ad, "deletions": dl,
            "changed_files": len(fl), "labels": lb or [], "files": fl,
            "timeline": tl, "check_runs": ck, "reactions": []}, cfd

prs = []
acf = {}
n = 101

for i in range(15):
    a = random.choice(DEVS)
    cr = rdt(WINDOW_START + timedelta(days=5), NOW - timedelta(days=10))
    m = [random.choice(MODULES[:4])]
    fl = files(m)
    o = f"{random.randint(1000000,9999999):07x}"
    rv = random.choice([r for r in REVIEWERS if r != a])
    rt = cr + timedelta(hours=random.uniform(2, 16))

    tl = [cev(a, cr - timedelta(minutes=10), o)]
    iters = random.randint(1, 2)
    t = rt
    for _ in range(iters):
        tl.append(rev(rv, t, "CHANGES_REQUESTED", random.choice(["fix this", "needs update"])))
        t += timedelta(hours=random.uniform(2, 8))
        tl.append(cev(a, t))
        t += timedelta(hours=random.uniform(4, 12))
    tl.append(rev(rv, t, "APPROVED", random.choice(["thanks", "LGTM"])))
    mt = t + timedelta(minutes=30)
    tl.append(mrg(rv, mt))

    df = dead_files(m)
    cf = [{"oid": o, "committed_date": (cr - timedelta(minutes=10)).isoformat(),
           "author_login": a, "files": fl + df}]

    p, _ = pr(n, f"feat: feature {n}", a, cr, mt, fl, tl, checks(cr), cf)
    prs.append(p); acf[str(n)] = cf; n += 1

for i in range(12):
    a = random.choice(DEVS)
    cr = rdt(WINDOW_START + timedelta(days=10), NOW - timedelta(days=20))
    m = random.sample(MODULES[:5], random.randint(3, 5))
    fl = files(m)
    o1 = f"{random.randint(1000000,9999999):07x}"
    rv = random.choice([r for r in REVIEWERS if r != a])

    tl = [cev(a, cr - timedelta(minutes=15), o1)]
    rt = cr + timedelta(hours=random.uniform(48, 200))
    t = rt
    iters = random.randint(3, 6)
    for _ in range(iters):
        tl.append(rev(rv, t, "CHANGES_REQUESTED", random.choice(["obvious", "just refactor", "why not"])))
        t += timedelta(hours=random.uniform(6, 24))
        on = f"{random.randint(1000000,9999999):07x}"
        tl.append(cev(a, t, on))
        t += timedelta(hours=random.uniform(12, 48))
    tl.append(rev(rv, t, "APPROVED", "ok finally"))
    mt = t + timedelta(hours=1)
    tl.append(mrg(rv, mt))

    df = dead_files(m)
    cf = [{"oid": o1, "committed_date": (cr - timedelta(minutes=15)).isoformat(),
           "author_login": a, "files": fl + df},
          {"oid": on, "committed_date": t.isoformat(), "author_login": a, "files": fl}]

    p, _ = pr(n, f"refactor: complex {n}", a, cr, mt, fl, tl, checks(cr), cf)
    prs.append(p); acf[str(n)] = cf; n += 1

for i in range(16):
    a = random.choice(DEVS)
    cr = rdt(WINDOW_START + timedelta(days=5), NOW - timedelta(days=15))
    m = random.sample(MODULES[:4], random.randint(1, 2))
    fl = files(m)
    o = f"{random.randint(1000000,9999999):07x}"
    rv = random.choice([r for r in REVIEWERS if r != a])
    t = cr + timedelta(hours=random.uniform(4, 12))

    tl = [cev(a, cr - timedelta(minutes=10), o)]
    iters = random.randint(3, 5)
    for _ in range(iters):
        tl.append(rev(rv, t, "CHANGES_REQUESTED", random.choice(["why not", "nonsense", "just use X"])))
        t += timedelta(hours=random.uniform(4, 16))
        tl.append(cev(a, t))
        t += timedelta(hours=random.uniform(6, 24))
    tl.append(rev(rv, t, "APPROVED", "finally"))
    mt = t + timedelta(hours=1)
    tl.append(mrg(rv, mt))

    cf = [{"oid": o, "committed_date": (cr - timedelta(minutes=10)).isoformat(),
           "author_login": a, "files": fl}]
    p, _ = pr(n, f"fix: heavy iteration {n}", a, cr, mt, fl, tl, checks(cr), cf)
    prs.append(p); acf[str(n)] = cf; n += 1

for i in range(4):
    a = random.choice(DEVS)
    cr = rdt(WINDOW_START + timedelta(days=20), NOW - timedelta(days=25))
    m = [random.choice(MODULES[:3])]
    fl = files(m)
    o = f"{random.randint(1000000,9999999):07x}"
    rv = random.choice([r for r in REVIEWERS if r != a])
    rt = cr + timedelta(hours=random.uniform(0.5, 2))
    tl = [cev(a, cr - timedelta(minutes=5), o), rev(rv, rt, "APPROVED", "urgent")]
    mt = rt + timedelta(minutes=10)
    tl.append(mrg(rv, mt))
    cf = [{"oid": o, "committed_date": (cr - timedelta(minutes=5)).isoformat(), "author_login": a, "files": fl}]
    p, _ = pr(n, f"hotfix: critical {n}", a, cr, mt, fl, tl, checks(cr), cf, lb=["hotfix"])
    prs.append(p); acf[str(n)] = cf; n += 1

for i in range(3):
    a = random.choice(DEVS)
    cr = rdt(WINDOW_START + timedelta(days=25), NOW - timedelta(days=20))
    m = [random.choice(MODULES[:3])]
    fl = files(m)
    o = f"{random.randint(1000000,9999999):07x}"
    rv = random.choice([r for r in REVIEWERS if r != a])
    tl = [cev(a, cr - timedelta(minutes=5), o), rev(rv, cr + timedelta(hours=0.5), "APPROVED")]
    mt = cr + timedelta(hours=1)
    tl.append(mrg(rv, mt))
    cf = [{"oid": o, "committed_date": (cr - timedelta(minutes=5)).isoformat(), "author_login": a, "files": fl}]
    p, _ = pr(n, f"Revert \"add endpoint {n}\"", a, cr, mt, fl, tl, [], cf)
    prs.append(p); acf[str(n)] = cf; n += 1

for mod in ["scripts", "src/auth"]:
    for i in range(5):
        cr = rdt(WINDOW_START + timedelta(days=5), NOW - timedelta(days=5))
        fl = files([mod])
        o = f"{random.randint(1000000,9999999):07x}"
        rv = random.choice([r for r in REVIEWERS if r != "alice"])
        rt = cr + timedelta(hours=random.uniform(2, 8))
        tl = [cev("alice", cr - timedelta(minutes=10), o), rev(rv, rt, "APPROVED", "thanks")]
        mt = rt + timedelta(minutes=20)
        tl.append(mrg(rv, mt))
        cf = [{"oid": o, "committed_date": (cr - timedelta(minutes=10)).isoformat(), "author_login": "alice", "files": fl}]
        p, _ = pr(n, f"chore: alice {mod} {n}", "alice", cr, mt, fl, tl, checks(cr), cf)
        prs.append(p); acf[str(n)] = cf; n += 1

for i, dev in enumerate(NEWBIES):
    cr = rdt(WINDOW_START + timedelta(days=30), NOW - timedelta(days=10))
    m = [random.choice(MODULES[:4])]
    fl = files(m)
    o = f"{random.randint(1000000,9999999):07x}"
    tl = [cev(dev, cr - timedelta(minutes=5), o)]
    cf = [{"oid": o, "committed_date": (cr - timedelta(minutes=5)).isoformat(), "author_login": dev, "files": fl}]
    if i < 1:
        rv = random.choice(REVIEWERS)
        rt = cr + timedelta(hours=random.uniform(1, 12))
        tl.append(rev(rv, rt, "APPROVED", "welcome!", ("HEART",)))
        tl.append(cmt(rv, rt + timedelta(minutes=5), "thanks for contributing!", ("THUMBS_UP",)))
        mt = rt + timedelta(hours=random.uniform(0.5, 4))
        tl.append(mrg(rv, mt))
        p, _ = pr(n, f"docs: from {dev}", dev, cr, mt, fl, tl, checks(cr), cf)
    elif i < 2:
        rv = random.choice(REVIEWERS)
        rt = cr + timedelta(hours=random.uniform(6, 48))
        tl.append(cmt(rv, rt, "needs work"))
        p, _ = pr(n, f"fix: from {dev}", dev, cr, None, fl, tl, checks(cr), cf, st="OPEN")
    else:
        p, _ = pr(n, f"fix: from {dev}", dev, cr, None, fl, tl, checks(cr), cf, st="OPEN")
    prs.append(p); acf[str(n)] = cf; n += 1

issues = []
iss = 201

for i in range(8):
    a = random.choice(DEVS)
    cr = rdt(WINDOW_START + timedelta(days=5), NOW - timedelta(days=5))
    rv = random.choice([r for r in REVIEWERS if r != a])
    t = cr + timedelta(hours=random.uniform(2, 24))
    ca = t + timedelta(hours=random.uniform(1, 48))
    tl = [cmt(rv, t, random.choice(["thanks", "good catch"])), cls(rv, ca)]
    issues.append({"number": iss, "title": f"bug {iss}", "state": "CLOSED", "author": a,
                   "created_at": cr.isoformat(), "updated_at": ca.isoformat(), "closed_at": ca.isoformat(),
                   "labels": [], "timeline": tl, "reactions": [], "comment_count": 1}); iss += 1

for i in range(8):
    a = random.choice(DEVS)
    cr = rdt(WINDOW_START + timedelta(days=10), NOW - timedelta(days=15))
    rv = random.choice(REVIEWERS)
    t = cr + timedelta(hours=random.uniform(4, 24))
    ca = t + timedelta(hours=1)
    rt = ca + timedelta(days=random.randint(1, 10))
    tl = [cmt(rv, t, "fixed"), cls(rv, ca), rop(a, rt), cmt(a, rt + timedelta(hours=1), "still broken")]
    issues.append({"number": iss, "title": f"bug reopened {iss}", "state": "OPEN", "author": a,
                   "created_at": cr.isoformat(), "updated_at": rt.isoformat(), "closed_at": ca.isoformat(),
                   "labels": [], "timeline": tl, "reactions": [], "comment_count": 2}); iss += 1

for i in range(6):
    a = random.choice(NEWBIES)
    cr = rdt(WINDOW_START + timedelta(days=20), NOW - timedelta(days=10))
    rv = random.choice(REVIEWERS)
    t = cr + timedelta(hours=random.uniform(1, 12))
    ca = t + timedelta(hours=24)
    tl = [cmt(rv, t, random.choice(["obvious", "just read docs", "why not", "nonsense"]), ("CONFUSED",))]
    tl.append(cls(rv, ca))
    issues.append({"number": iss, "title": f"question {iss}", "state": "CLOSED", "author": a,
                   "created_at": cr.isoformat(), "updated_at": ca.isoformat(), "closed_at": ca.isoformat(),
                   "labels": [], "timeline": tl, "reactions": ["CONFUSED"], "comment_count": 1}); iss += 1

base_prs = []
bn = 50
for i in range(20):
    a = random.choice(DEVS)
    cr = rdt(BASE_START + timedelta(days=5), BASE_END - timedelta(days=5))
    cr = cr.replace(hour=random.choice([9, 10, 11, 14, 15, 16]), minute=random.randint(0, 59))
    m = random.sample(MODULES[:4], random.randint(1, 2))
    fl = files(m)
    o = f"{random.randint(1000000,9999999):07x}"
    rv = random.choice([r for r in REVIEWERS if r != a])
    rt = cr + timedelta(hours=random.uniform(2, 16))
    tl = [cev(a, cr - timedelta(minutes=10), o), rev(rv, rt, "APPROVED", "thanks")]
    mt = rt + timedelta(hours=1)
    tl.append(mrg(rv, mt))
    p, _ = pr(bn, f"feat: base {bn}", a, cr, mt, fl, tl, checks(cr),
              [{"oid": o, "committed_date": (cr - timedelta(minutes=10)).isoformat(), "author_login": a, "files": fl}])
    base_prs.append(p); bn += 1

base_issues = []
bi = 150
for i in range(6):
    a = random.choice(DEVS)
    cr = rdt(BASE_START + timedelta(days=5), BASE_END - timedelta(days=5))
    rv = random.choice(REVIEWERS)
    t = cr + timedelta(hours=random.uniform(2, 24))
    ca = t + timedelta(hours=12)
    tl = [cmt(rv, t, "thanks"), cls(rv, ca)]
    base_issues.append({"number": bi, "title": f"base bug {bi}", "state": "CLOSED", "author": a,
                        "created_at": cr.isoformat(), "updated_at": ca.isoformat(), "closed_at": ca.isoformat(),
                        "labels": [], "timeline": tl, "reactions": [], "comment_count": 1}); bi += 1

bundle = {
    "owner": "demo", "repo": "dx-project",
    "window_start": WINDOW_START.isoformat(), "window_end": NOW.isoformat(), "loaded_at": NOW.isoformat(),
    "prs": prs, "issues": issues, "base_prs": base_prs, "base_issues": base_issues,
    "commit_files": acf,
}

with open("demo_data.json", "w", encoding="utf-8") as f:
    json.dump(bundle, f, ensure_ascii=False, indent=2)

print(f"PRs: {len(prs)} + {len(base_prs)} base")
print(f"Issues: {len(issues)} + {len(base_issues)} base")
print(f"Commit files: {len(acf)}")
