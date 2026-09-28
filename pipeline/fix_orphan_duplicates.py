"""Сиротские дубли: цепочка «дубль -> оригинал» не доходит до записанной не-дубль находки.
По умолчанию только список. --apply: в каждой группе одна находка (самый авторитетный
источник, затем самая ранняя) снова становится new, чтобы её оценил судья."""
import sys; sys.path.insert(0, "/opt/cosmos-ecology/pipeline")
import common
apply = "--apply" in sys.argv
c = common.db(); cur = c.cursor()
cur.execute("""SELECT f.id, f.url, f.title, f.verdict, f.verdict_reason, f.found_at, coalesce(s.authority,0) a
               FROM pipeline.pipe_findings f LEFT JOIN pipeline.pipe_sources s ON s.id=f.source_id
               WHERE f.found_at > now() - interval '30 days'""")
rows = [dict(r) for r in cur.fetchall()]
by_url = {r["url"]: r for r in rows}
cur.execute("SELECT url, verdict FROM pipeline.pipe_findings")
all_v = {r["url"]: r["verdict"] for r in cur.fetchall()}
def root(r, seen):
    while r["verdict"] == "duplicate":
        t = (r["verdict_reason"] or "").removeprefix("дубль ").strip()
        if t in seen: return None
        seen.add(t)
        if t not in by_url:
            return t if all_v.get(t) not in (None, "duplicate") else None
        r = by_url[t]
    return r["url"]
groups = {}
for r in rows:
    if r["verdict"] != "duplicate": continue
    if root(r, {r["url"]}) is None:
        # ключ группы: множество url цепочки
        key = frozenset(); x = r; seen = set()
        while x and x["url"] not in seen:
            seen.add(x["url"]); t = (x.get("verdict_reason") or "").removeprefix("дубль ").strip(); x = by_url.get(t)
        k = min(seen)
        groups.setdefault(k, set()).update(seen)
# склеить пересекающиеся
merged = []
for g in groups.values():
    for m in merged:
        if m & g: m |= g; break
    else: merged.append(set(g))
for g in merged:
    members = sorted([by_url[u] for u in g if u in by_url], key=lambda r: (-r["a"], r["found_at"]))
    pick = members[0]
    print(f"группа {len(members)}: берём {pick['id']} a={pick['a']} {pick['title'][:80]} | {pick['url'][:80]}")
    for m in members[1:]: print(f"    {m['id']} {m['title'][:70]}")
    if apply:
        cur.execute("UPDATE pipeline.pipe_findings SET verdict='new', verdict_reason='возвращена: сиротский дубль (29.09)', found_at=now() WHERE id=%s", (pick["id"],))
if apply: c.commit(); print("применено")
print("групп:", len(merged))
