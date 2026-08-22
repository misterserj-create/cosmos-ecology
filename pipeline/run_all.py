#!/usr/bin/env python3
"""Суточный прогон: collect -> judge -> write -> translate. Для крона.

    python3 run_all.py
    python3 run_all.py --skip translate
    python3 run_all.py --dry-run        # каждому этапу передаётся --dry-run

Каждый этап запускается отдельным процессом: падение одного не мешает
следующему (judge после упавшего collect оценит то, что накопилось раньше),
а в pipe_runs у каждого своя строка. Сводка по этапам уходит в stdout;
алерт при падении шлёт сам этап. publish.py сюда не входит: он ходит по
своему расписанию и публикует только одобренное.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
STAGES = ["collect", "judge", "write", "translate"]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip", action="append", default=[], help="этап, который пропустить (можно несколько раз)")
    ap.add_argument("--only", help="только этот этап")
    args = ap.parse_args()

    stages = [args.only] if args.only else [s for s in STAGES if s not in args.skip]
    results: dict[str, int] = {}
    for stage in stages:
        cmd = [sys.executable, str(HERE / f"{stage}.py")]
        if args.dry_run:
            cmd.append("--dry-run")
        t0 = time.time()
        print(f"=== {stage} ===", flush=True)
        code = subprocess.call(cmd)
        results[stage] = code
        print(f"=== {stage}: код {code}, {time.time() - t0:.0f} с ===", flush=True)

    print("сводка:", ", ".join(f"{k}={'ok' if v == 0 else 'FAIL'}" for k, v in results.items()), flush=True)
    return 1 if any(results.values()) else 0


if __name__ == "__main__":
    sys.exit(main())
