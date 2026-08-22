"""Общий каркас контент-тракта «Экологии Космоса».

Всё, что нужно каждому этапу, в одном месте:

  - load_env()         ключи из .env рядом с пакетом (путь можно переопределить
                       переменной PIPELINE_ENV);
  - db()               соединение с cosmos_db, схема pipeline в search_path;
  - settings()         настройки из pipe_settings с резервом в DEFAULTS;
  - Run                контекст прогона: строка в pipe_runs, лог, стоимость,
                       перехват исключений, алерт в Telegram при падении;
  - chat()             один вызов модели через OpenRouter с учётом стоимости;
  - has_long_dash()    проверка на длинное тире (канон проекта: только «–»).

Режим --dry-run у любого этапа означает: в базу ничего не пишется, строки
pipe_runs нет, модели вызываются (если этап их вызывает), результат печатается
в stdout. Так можно проверить связку с OpenRouter, не трогая данные.
"""
from __future__ import annotations

import json
import logging
import os
import re
import sys
import time
import traceback
import urllib.parse
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

import requests

try:
    import psycopg2
    import psycopg2.extras
except ImportError:  # psycopg2 нужен только при работе с базой, не в dry-run
    psycopg2 = None  # type: ignore[assignment]

PKG_DIR = Path(__file__).resolve().parent
ENV_PATH = Path(os.environ.get("PIPELINE_ENV", PKG_DIR / ".env"))
OPENROUTER_URL = "https://openrouter.ai/api/v1"
LONG_DASH = "—"

log = logging.getLogger("pipeline")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)

# Зеркало значений из db/migrations/004_pipeline.sql. Используется, когда в
# базе ключа нет или база недоступна (dry-run без DATABASE_URL).
DEFAULTS: dict[str, Any] = {
    "topics": [
        "космический мусор на орбите",
        "синдром Кесслера",
        "спутниковые группировки и мегасозвездия",
        "активное удаление мусора с орбиты",
        "космическое право и регулирование орбитальной деятельности",
        "артсайклинг и апсайклинг техногенных отходов",
        "выставки и проекты на стыке науки и искусства о космосе",
    ],
    "thresholds": {"judge_accept": 6.5, "quality_min": 7.0, "translation_min": 7.0},
    "models": {
        "search": "perplexity/sonar-pro",
        "judge": "openai/gpt-5.6-sol",
        "writer": "anthropic/claude-sonnet-5",
        "factcheck": "perplexity/sonar-pro",
        "judge_a": "x-ai/grok-4.6",
        "judge_b": "google/gemini-3.7-flash",
        "translator": "anthropic/claude-sonnet-5",
        "native_cjk": "google/gemini-3.7-flash",
        "native_eu": "openai/gpt-5.6-sol",
    },
    "publish": {"mode": "manual", "telegram_chat_id": "", "vk_group_id": "",
                "languages_to_site": False},
    "schedule": {"run_all": "0 7 * * *", "publish": "*/30 * * * *", "tz": "Europe/Moscow"},
    "limits": {"search_results_per_topic": 8, "max_findings_per_run": 40,
               "max_posts_per_run": 5, "max_age_days": 14, "rewrite_rounds": 1},
    "voice": {"words_min": 120, "words_max": 250, "signature": ""},
}

TRANSLATION_LANGS = ("en", "es", "fr", "de", "zh", "ja")


# ---------------------------------------------------------------------------
# Окружение
# ---------------------------------------------------------------------------

_ENV: dict[str, str] | None = None


def load_env() -> dict[str, str]:
    """Переменные окружения поверх файла .env. Значения из окружения главнее."""
    global _ENV
    if _ENV is not None:
        return _ENV
    env: dict[str, str] = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            v = v.strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                v = v[1:-1]
            env[k.strip()] = v
    for k, v in os.environ.items():
        if v:
            env[k] = v
    _ENV = env
    return env


def env(key: str, default: str = "") -> str:
    return load_env().get(key, default)


# ---------------------------------------------------------------------------
# База
# ---------------------------------------------------------------------------

def db():
    """Соединение с cosmos_db. search_path = pipeline, public: таблицы тракта
    пишутся без префикса, таблицы сайта остаются доступны."""
    if psycopg2 is None:
        raise RuntimeError("psycopg2 не установлен")
    dsn = env("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL не задан в .env тракта")
    conn = psycopg2.connect(dsn, connect_timeout=10,
                            cursor_factory=psycopg2.extras.RealDictCursor)
    with conn.cursor() as cur:
        cur.execute("SET search_path TO pipeline, public")
    conn.commit()
    return conn


def settings(conn=None) -> dict[str, Any]:
    """Все настройки: DEFAULTS, поверх них то, что лежит в pipe_settings."""
    merged = json.loads(json.dumps(DEFAULTS))
    if conn is None:
        return merged
    with conn.cursor() as cur:
        cur.execute("SELECT key, value FROM pipe_settings")
        for row in cur.fetchall():
            val = row["value"]
            if isinstance(val, dict) and isinstance(merged.get(row["key"]), dict):
                merged[row["key"]].update(val)
            else:
                merged[row["key"]] = val
    return merged


def set_setting(conn, key: str, value: Any) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO pipe_settings (key, value) VALUES (%s, %s::jsonb) "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            (key, json.dumps(value, ensure_ascii=False)),
        )
    conn.commit()


# ---------------------------------------------------------------------------
# Алерты
# ---------------------------------------------------------------------------

def alert(text: str) -> None:
    """Сообщение в чат алертов (TG_ALERTS_CHAT_ID). Тот же механизм, что у
    сторожей Резонанса: голый sendMessage, без разметки, ошибки гасятся."""
    token = env("TELEGRAM_BOT_TOKEN")
    chat = env("TG_ALERTS_CHAT_ID") or env("TG_OWNER_CHAT_ID")
    if not token or not chat:
        log.warning("алерт не отправлен: нет TELEGRAM_BOT_TOKEN или TG_ALERTS_CHAT_ID")
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat, "text": text[:4000], "disable_web_page_preview": True},
            timeout=15,
        )
    except Exception as e:  # noqa: BLE001
        log.warning("алерт не ушёл: %s", e)


# ---------------------------------------------------------------------------
# Прогон этапа
# ---------------------------------------------------------------------------

class Run:
    """Один прогон этапа.

        with Run("collect", dry_run=args.dry_run) as run:
            run.log("нашёл %d", n)
            run.items_in += 1
            ...

    На входе пишет строку в pipe_runs, на выходе закрывает её: ok, счётчики,
    стоимость, лог. Исключение внутри блока не пробрасывается наружу: прогон
    помечается упавшим, трассировка уходит в лог и в алерт, процесс
    завершается кодом 1 (видно крону и run_job.sh).
    """

    def __init__(self, stage: str, dry_run: bool = False):
        self.stage = stage
        self.dry_run = dry_run
        self.conn = None
        self.run_id: int | None = None
        self.items_in = 0
        self.items_out = 0
        self.cost = 0.0
        self.lines: list[str] = []
        self.ok: bool | None = None
        self.started = time.time()
        self.settings: dict[str, Any] = DEFAULTS

    def __enter__(self) -> "Run":
        if not self.dry_run:
            self.conn = db()
            with self.conn.cursor() as cur:
                cur.execute("INSERT INTO pipe_runs (stage) VALUES (%s) RETURNING id",
                            (self.stage,))
                self.run_id = cur.fetchone()["id"]
            self.conn.commit()
            self.settings = settings(self.conn)
        else:
            # В dry-run базу не трогаем, но если она доступна, настройки
            # читаем оттуда: так проверка идёт с теми же темами и порогами.
            try:
                if env("DATABASE_URL") and psycopg2 is not None:
                    conn = db()
                    self.settings = settings(conn)
                    conn.close()
            except Exception as e:  # noqa: BLE001
                self.log("dry-run: база недоступна (%s), настройки из DEFAULTS", e)
        self.log("старт %s%s", self.stage, " (dry-run)" if self.dry_run else "")
        return self

    def log(self, msg: str, *args: Any) -> None:
        text = msg % args if args else msg
        self.lines.append(f"{datetime.now(timezone.utc).strftime('%H:%M:%S')} {text}")
        log.info("[%s] %s", self.stage, text)

    def __exit__(self, exc_type, exc, tb) -> bool:
        self.ok = exc is None
        if exc is not None:
            self.log("ОШИБКА: %s\n%s", exc, "".join(traceback.format_exception(exc_type, exc, tb)))
        elapsed = time.time() - self.started
        self.log("итог: in=%d out=%d cost=$%.4f за %.0f с", self.items_in, self.items_out,
                 self.cost, elapsed)
        if self.conn is not None:
            try:
                if exc is not None:
                    self.conn.rollback()
                with self.conn.cursor() as cur:
                    cur.execute(
                        "UPDATE pipe_runs SET finished_at = NOW(), ok = %s, items_in = %s, "
                        "items_out = %s, cost = %s, log = %s WHERE id = %s",
                        (self.ok, self.items_in, self.items_out, round(self.cost, 6),
                         "\n".join(self.lines), self.run_id),
                    )
                self.conn.commit()
            except Exception as e:  # noqa: BLE001
                log.error("не смог закрыть pipe_runs: %s", e)
            finally:
                self.conn.close()
        if exc is not None and not self.dry_run:
            alert(f"Экология Космоса, тракт: упал этап {self.stage}\n{exc}"[:1500])
        if exc is not None:
            sys.exit(1)
        return False


# ---------------------------------------------------------------------------
# OpenRouter
# ---------------------------------------------------------------------------

_PRICES: dict[str, tuple[float, float]] | None = None


def model_prices() -> dict[str, tuple[float, float]]:
    """Цены за токен (вход, выход) из /api/v1/models. Один запрос на процесс."""
    global _PRICES
    if _PRICES is not None:
        return _PRICES
    _PRICES = {}
    try:
        r = requests.get(f"{OPENROUTER_URL}/models",
                         headers={"Authorization": f"Bearer {env('OPENROUTER_API_KEY')}"},
                         timeout=30)
        for m in r.json().get("data", []):
            p = m.get("pricing") or {}
            _PRICES[m["id"]] = (float(p.get("prompt") or 0), float(p.get("completion") or 0))
    except Exception as e:  # noqa: BLE001
        log.warning("цены моделей не получены: %s", e)
    return _PRICES


def _cost_of(model: str, usage: dict[str, Any]) -> float:
    if usage.get("cost") is not None:
        return float(usage["cost"])
    p_in, p_out = model_prices().get(model, (0.0, 0.0))
    return usage.get("prompt_tokens", 0) * p_in + usage.get("completion_tokens", 0) * p_out


def _record_call(run: Run | None, purpose: str, model: str, usage: dict[str, Any],
                 cost: float, ok: bool, error: str | None) -> None:
    if run is None:
        return
    run.cost += cost
    if run.conn is None:
        return
    try:
        with run.conn.cursor() as cur:
            cur.execute(
                "INSERT INTO pipe_api_calls (run_id, stage, purpose, model, prompt_tokens, "
                "completion_tokens, cost_usd, ok, error) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (run.run_id, run.stage, purpose, model, usage.get("prompt_tokens", 0),
                 usage.get("completion_tokens", 0), round(cost, 6), ok, error),
            )
        run.conn.commit()
    except Exception as e:  # noqa: BLE001
        log.warning("pipe_api_calls не записан: %s", e)


class ChatResult:
    def __init__(self, text: str, usage: dict[str, Any], cost: float, raw: dict[str, Any]):
        self.text = text
        self.usage = usage
        self.cost = cost
        self.raw = raw

    def json(self) -> Any:
        """Ответ как JSON. Терпит ограждение ```json ... ``` и текст вокруг."""
        return parse_json(self.text)


def parse_json(text: str) -> Any:
    s = text.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s)
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        start = min([i for i in (s.find("{"), s.find("[")) if i >= 0], default=-1)
        if start < 0:
            raise
        end = max(s.rfind("}"), s.rfind("]"))
        return json.loads(s[start:end + 1])


def chat(model: str, messages: list[dict[str, str]], *, run: Run | None = None,
         purpose: str = "", temperature: float = 0.4, max_tokens: int = 2000,
         json_mode: bool = False, timeout: int = 180, retries: int = 2,
         extra: dict[str, Any] | None = None) -> ChatResult:
    """Один вызов /chat/completions. Стоимость: usage.cost от OpenRouter
    (просим include: true), иначе токены умноженные на цены из /models.
    Каждый вызов, удачный или нет, попадает в pipe_api_calls и в run.cost."""
    key = env("OPENROUTER_API_KEY")
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY не задан")
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "usage": {"include": True},
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    if extra:
        payload.update(extra)
    last_err: Exception | None = None
    for attempt in range(retries + 1):
        try:
            r = requests.post(
                f"{OPENROUTER_URL}/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                         "HTTP-Referer": "https://xn--80afpgcdklbdb8ac0nmb.xn--p1ai",
                         "X-Title": "cosmos-ecology pipeline"},
                json=payload, timeout=timeout,
            )
            data = r.json()
            if r.status_code >= 400 or "error" in data:
                raise RuntimeError(f"OpenRouter {r.status_code}: {str(data.get('error', data))[:300]}")
            usage = data.get("usage") or {}
            cost = _cost_of(data.get("model") or model, usage)
            text = data["choices"][0]["message"].get("content") or ""
            _record_call(run, purpose, data.get("model") or model, usage, cost, True, None)
            return ChatResult(text, usage, cost, data)
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt < retries:
                log.warning("%s: попытка %d не удалась (%s), повтор", model, attempt + 1, e)
                time.sleep(3 * (attempt + 1))
    _record_call(run, purpose, model, {}, 0.0, False, str(last_err)[:500])
    raise RuntimeError(f"{model}: {last_err}")


def citations_of(result: ChatResult) -> list[str]:
    """Ссылки из ответа Perplexity. OpenRouter отдаёт их то полем citations
    на верхнем уровне, то аннотациями url_citation в сообщении."""
    raw = result.raw
    urls: list[str] = list(raw.get("citations") or [])
    try:
        for a in raw["choices"][0]["message"].get("annotations") or []:
            u = (a.get("url_citation") or {}).get("url")
            if u:
                urls.append(u)
    except (KeyError, IndexError, TypeError):
        pass
    seen: set[str] = set()
    out: list[str] = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


# ---------------------------------------------------------------------------
# Мелочи
# ---------------------------------------------------------------------------

_TRACKING_PARAMS = re.compile(r"^(utm_\w+|fbclid|gclid|yclid|mc_cid|mc_eid|ref|source)$", re.I)


def normalize_url(url: str) -> str:
    """Адрес без якоря, utm-хвостов и завершающего слеша, хост строчными.
    По нему сводятся дубли между RSS и поиском."""
    url = (url or "").strip()
    if not url:
        return ""
    p = urllib.parse.urlsplit(url)
    query = [(k, v) for k, v in urllib.parse.parse_qsl(p.query, keep_blank_values=True)
             if not _TRACKING_PARAMS.match(k)]
    path = p.path.rstrip("/") or "/"
    scheme = "https" if p.scheme in ("http", "https") else p.scheme
    return urllib.parse.urlunsplit((scheme, p.netloc.lower(), path,
                                    urllib.parse.urlencode(query, doseq=True), ""))


def title_key(title: str) -> str:
    """Грубый ключ заголовка для поиска дублей: строчные, без пунктуации,
    первые восемь слов."""
    words = re.findall(r"\w+", (title or "").lower())
    return " ".join(words[:8])


def titles_close(a: str, b: str) -> bool:
    """Похожи ли два заголовка: совпадают ключи или совпадает не меньше
    70 процентов слов более короткого."""
    ka, kb = title_key(a), title_key(b)
    if not ka or not kb:
        return False
    if ka == kb:
        return True
    sa, sb = set(ka.split()), set(kb.split())
    return len(sa & sb) >= 0.7 * min(len(sa), len(sb)) and min(len(sa), len(sb)) >= 4


def has_long_dash(text: str) -> bool:
    return LONG_DASH in (text or "")


def fix_long_dash(text: str) -> str:
    """Длинное тире заменяется на среднее. Применяется как последняя
    страховка после модели, а не вместо запрета в промпте."""
    return (text or "").replace(LONG_DASH, "–")


def word_count(text: str) -> int:
    return len(re.findall(r"[\w'’-]+", text or ""))


def parse_date(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    s = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s[:len(fmt) + 2], fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


@contextmanager
def cursor(run: Run) -> Iterator[Any]:
    """Курсор прогона. В dry-run курсора нет: вызывающий код обязан это
    учитывать и не писать."""
    if run.conn is None:
        raise RuntimeError("dry-run: записи в базу запрещены")
    with run.conn.cursor() as cur:
        yield cur


def dump(obj: Any) -> None:
    print(json.dumps(obj, ensure_ascii=False, indent=2, default=str))


# ---------------------------------------------------------------------------
# Полный текст статьи по ссылке
# ---------------------------------------------------------------------------
# Ленты отдают только анонс в одну-две фразы. Первый живой прогон показал,
# что автор на таком входе честно пишет четыре абзаца «в источнике одна
# вводная фраза, судить невозможно». Поэтому перед написанием статья
# открывается целиком; если не открылась - автор получает анонс, но знает,
# что это анонс, и пишет коротко.

ARTICLE_MAX_CHARS = 12000


def fetch_article(url: str, timeout: int = 25) -> str:
    try:
        import trafilatura  # noqa: WPS433
    except ImportError:
        return ""
    try:
        r = requests.get(url, timeout=timeout, headers={
            "User-Agent": "Mozilla/5.0 (compatible; CosmosEcologyBot/1.0; +https://cosmosecology.ru)"})
        if r.status_code != 200 or not r.text:
            return ""
        text = trafilatura.extract(r.text, url=url, include_comments=False,
                                   include_tables=False, favor_precision=True) or ""
    except Exception:  # noqa: BLE001
        return ""
    text = text.strip()
    if len(text) < 300:
        return ""
    return text[:ARTICLE_MAX_CHARS]
