"""Проверка правил отправки в vk в publish.py: выключатель и интервал досылки.

Запуск: cd /opt/cosmos-ecology/pipeline && python3 test_publish_vk.py
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import publish  # noqa: E402

NOW = datetime(2026, 9, 29, 12, 0, tzinfo=timezone.utc)


def d(vk):
    return {"published_to": {"vk": vk} if vk is not None else {}}


def ok_at(minutes_ago):
    return {"ok": True, "at": (NOW - timedelta(minutes=minutes_ago)).isoformat()}


def main() -> int:
    bad = []

    # Выключатель: только явное true, отсутствие ключа не выключает.
    if not publish.vk_vyklyuchen({"vk_off": True}):
        bad.append("vk_off=true не выключает vk")
    for pub in ({}, {"vk_off": False}, {"vk_off": None}):
        if publish.vk_vyklyuchen(pub):
            bad.append(f"vk выключен при {pub}")

    # Интервал: после удачной отправки 20 минут назад при интервале 60 - ждать ещё 40.
    got = publish.vk_interval_do_kogda([d(ok_at(20)), d(None), d({"ok": False, "at": NOW.isoformat()})], 60)
    if got != NOW + timedelta(minutes=40):
        bad.append(f"интервал после отправки 20 мин назад: {got}")
    # Берётся самая поздняя удачная отправка из всех черновиков.
    got = publish.vk_interval_do_kogda([d(ok_at(300)), d(ok_at(10))], 60)
    if got != NOW + timedelta(minutes=50):
        bad.append(f"не самая поздняя отправка: {got}")
    # Вырожденные случаи: ни одной удачной, пустой список, интервал 0, битая дата.
    for drafts, iv, what in (([d(None), d({"ok": False, "at": NOW.isoformat()})], 60, "без удачных"),
                             ([], 60, "пустой список"),
                             ([d(ok_at(5))], 0, "интервал 0"),
                             ([d({"ok": True, "at": "мусор"})], 60, "битая дата")):
        got = publish.vk_interval_do_kogda(drafts, iv)
        if got is not None:
            bad.append(f"{what}: ждёт до {got}, а не должен")

    for b in bad:
        print("ПРОВАЛ:", b)
    print("ok" if not bad else f"провалов: {len(bad)}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
