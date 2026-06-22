CREATE TABLE IF NOT EXISTS artworks (
  id          SERIAL PRIMARY KEY,
  art_id      TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL DEFAULT '',
  author      TEXT DEFAULT '',
  technique   TEXT DEFAULT '',
  materials   TEXT DEFAULT '',
  size        TEXT DEFAULT '',
  year        INT DEFAULT 0,
  status      TEXT DEFAULT '',
  desc_short  TEXT DEFAULT '',
  curator_text TEXT DEFAULT '',
  image_url   TEXT DEFAULT '',
  thumb_url   TEXT DEFAULT '',
  in_catalog  BOOLEAN DEFAULT false,
  category    TEXT DEFAULT '',
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL DEFAULT '',
  type         TEXT DEFAULT '',
  event_date   DATE,
  place        TEXT DEFAULT '',
  description  TEXT DEFAULT '',
  link         TEXT DEFAULT '',
  image_url    TEXT DEFAULT '',
  thumb_url    TEXT DEFAULT '',
  published    BOOLEAN DEFAULT false,
  published_tg BOOLEAN DEFAULT false,
  created_at   TIMESTAMP DEFAULT NOW()
);
