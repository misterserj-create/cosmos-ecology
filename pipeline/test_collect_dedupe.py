"""Проверка отбора находок в collect.py: громкая новость не должна теряться.

Запуск: cd /opt/cosmos-ecology/pipeline && python3 test_collect_dedupe.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import collect  # noqa: E402


def item(url, title):
    return {"url": url, "title": title}


def main() -> int:
    bad = 0
    # 25 разных тихих новостей и 1 громкая, о которой пишут 5 изданий; громкая пришла последней.
    words = ["альфа", "брусника", "вектор", "гранит", "дельфин", "ежевика", "жасмин", "звезда", "иволга", "кедр",
             "лаванда", "магнит", "нарвал", "облако", "парус", "ракушка", "сосна", "тюльпан", "улитка", "фазан",
             "хвоя", "цапля", "чайка", "шмель", "щука"]
    items = [item(f"https://quiet.example/{i}", f"{w} {words[(i + 3) % 25]} {words[(i + 11) % 25]} заметка")
             for i, w in enumerate(words)]
    items.append(item("https://esa.int/report", "ESA Space Environment Report 2026 warns of growing debris"))
    for k in range(5):
        items.append(item(f"https://outlet{k}.example/esa", "ESA Space Environment Report 2026 warns of growing debris"))

    items = collect.dedupe(items, [])
    fresh, dups = collect.select_for_save(items, 20, set())
    fresh_urls = {i["url"] for i in fresh}

    if "https://esa.int/report" not in fresh_urls:
        print("ОШИБКА: громкая новость отрезана лимитом"); bad += 1
    if len(fresh) != 20:
        print(f"ОШИБКА: новых {len(fresh)}, ожидалось 20"); bad += 1
    orphans = [d for d in dups if d["duplicate_of"] not in fresh_urls]
    if orphans:
        print(f"ОШИБКА: {len(orphans)} дублей ссылаются на незаписанный оригинал"); bad += 1
    if len(dups) != 5:
        print(f"ОШИБКА: дублей {len(dups)}, ожидалось 5"); bad += 1

    # Вырожденные случаи: пусто и лимит 0.
    f0, d0 = collect.select_for_save([], 20, set())
    if f0 or d0:
        print("ОШИБКА: пустой вход дал находки"); bad += 1
    f1, d1 = collect.select_for_save(items, 0, set())
    if f1 or d1:
        print("ОШИБКА: при лимите 0 записаны находки или сиротские дубли"); bad += 1

    # Дубль уже известной находки (оригинал в базе) сохраняется.
    it2 = collect.dedupe([item("https://outlet9.example/x", "Старая новость про тросовую сеть на орбите")],
                         [{"url": "https://old.example/x", "title": "Старая новость про тросовую сеть на орбите"}])
    f2, d2 = collect.select_for_save(it2, 20, {"https://old.example/x"})
    if len(d2) != 1:
        print("ОШИБКА: дубль находки из базы потерян"); bad += 1

    print("ok" if not bad else f"провалов: {bad}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
