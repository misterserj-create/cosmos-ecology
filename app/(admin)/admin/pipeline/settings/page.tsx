'use client'
import { useEffect, useState } from 'react'
import { PipelineShell, btn, btnGold, card, muted, input, th, td, fmtDate } from '@/components/admin/PipelineShell'

type Settings = {
  topics: string[]
  thresholds: { judge_accept: number; quality_min: number; translation_min: number }
  models: Record<string, string>
  publish: { mode: 'manual' | 'auto'; telegram_chat_id: string; vk_group_id: string }
  schedule: { run_all: string; publish: string; tz: string }
  limits: Record<string, number>
  voice: { words_min: number; words_max: number; signature: string }
}
type Source = { id: number; kind: string; query_or_url: string; name: string; organization: string; topic: string; feed_kind: string | null; authority: number; active: boolean; last_run_at: string | null; last_error: string | null; findings: string }

const MODEL_LABEL: Record<string, string> = {
  search: 'поиск (collect)', judge: 'отбор находок', writer: 'автор поста', factcheck: 'фактчек',
  judge_a: 'судья качества А', judge_b: 'судья качества Б', translator: 'переводчик', native_cjk: 'носитель zh/ja', native_eu: 'носитель en/es/fr/de',
}
const LIMIT_LABEL: Record<string, string> = {
  search_results_per_topic: 'находок на тему за поиск', max_findings_per_run: 'находок за прогон', max_posts_per_run: 'постов за прогон',
  max_age_days: 'максимальный возраст материала, дней', rewrite_rounds: 'кругов переписывания',
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/admin/pipeline/settings').then(r => r.json()).then(j => { if (j.error) setMsg(j.error); else setS(j) })
    fetch('/api/admin/pipeline/sources').then(r => r.json()).then(j => { if (!j.error) setSources(j) })
  }, [])

  async function save() {
    if (!s) return
    const r = await fetch('/api/admin/pipeline/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) })
    const j = await r.json()
    setMsg(r.ok ? `Сохранено ${fmtDate(new Date().toISOString())}. Новые значения подхватит следующий прогон.` : j.error)
  }

  async function toggleSource(id: number, active: boolean) {
    await fetch(`/api/admin/pipeline/sources/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) })
    setSources(prev => prev.map(x => x.id === id ? { ...x, active } : x))
  }

  if (!s) return <PipelineShell title="Настройки">{msg ? <div style={{ color: '#b3261e' }}>{msg}</div> : <div style={muted}>Загрузка…</div>}</PipelineShell>

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v })

  return (
    <PipelineShell title="Настройки" right={<button onClick={save} style={btnGold}>Сохранить</button>}>
      {msg && <div style={{ color: msg.startsWith('Сохранено') ? '#2e7d32' : '#b3261e', marginBottom: 16, fontSize: '1.05rem' }}>{msg}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        <div style={card}>
          <div style={h3}>Публикация</div>
          <label style={lbl}>Режим
            <select value={s.publish.mode} onChange={e => set('publish', { ...s.publish, mode: e.target.value as 'manual' | 'auto' })} style={input}>
              <option value="manual">manual: только одобренные человеком</option>
              <option value="auto">auto: всё, что прошло судей качества</option>
            </select>
          </label>
          <label style={lbl}>Telegram: chat_id канала (например -1001234567890 или @канал)
            <input value={s.publish.telegram_chat_id || ''} onChange={e => set('publish', { ...s.publish, telegram_chat_id: e.target.value.trim() })} style={input} />
          </label>
          <label style={lbl}>ВКонтакте: id группы (число без минуса)
            <input value={s.publish.vk_group_id || ''} onChange={e => set('publish', { ...s.publish, vk_group_id: e.target.value.trim() })} style={input} />
          </label>
          <label style={lbl}>Подпись в конце поста (необязательно)
            <input value={s.voice.signature || ''} onChange={e => set('voice', { ...s.voice, signature: e.target.value })} style={input} />
          </label>
          <div style={muted}>Пустое поле = канал выключен. Токены лежат в .env тракта, не здесь.</div>
        </div>

        <div style={card}>
          <div style={h3}>Пороги</div>
          <Num label="Приём находки (оценка судьи 0-10)" value={s.thresholds.judge_accept} onChange={v => set('thresholds', { ...s.thresholds, judge_accept: v })} />
          <Num label="Качество поста (среднее двух судей)" value={s.thresholds.quality_min} onChange={v => set('thresholds', { ...s.thresholds, quality_min: v })} />
          <Num label="Качество перевода (оценка носителя)" value={s.thresholds.translation_min} onChange={v => set('thresholds', { ...s.thresholds, translation_min: v })} />
          <div style={{ ...h3, marginTop: 16 }}>Объём</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Num label="слов, от" value={s.voice.words_min} onChange={v => set('voice', { ...s.voice, words_min: v })} />
            <Num label="слов, до" value={s.voice.words_max} onChange={v => set('voice', { ...s.voice, words_max: v })} />
          </div>
          <div style={{ ...h3, marginTop: 16 }}>Лимиты</div>
          {Object.keys(s.limits).map(k => (
            <Num key={k} label={LIMIT_LABEL[k] || k} value={s.limits[k]} onChange={v => set('limits', { ...s.limits, [k]: v })} />
          ))}
        </div>

        <div style={card}>
          <div style={h3}>Темы поиска (по одной в строке)</div>
          <textarea value={s.topics.join('\n')} onChange={e => set('topics', e.target.value.split('\n').map(x => x.trim()).filter(Boolean))} style={{ ...input, height: 200, lineHeight: 1.5, fontFamily: 'inherit' }} />
          <div style={{ ...h3, marginTop: 16 }}>Расписание</div>
          <div style={muted}>Само расписание живёт в кроне сервера (/root/etc/jobs.yaml). Здесь только справочно, чтобы было видно, когда ждать прогон.</div>
          <label style={lbl}>run_all (cron, {s.schedule.tz})<input value={s.schedule.run_all} onChange={e => set('schedule', { ...s.schedule, run_all: e.target.value })} style={input} /></label>
          <label style={lbl}>publish (cron)<input value={s.schedule.publish} onChange={e => set('schedule', { ...s.schedule, publish: e.target.value })} style={input} /></label>
        </div>

        <div style={card}>
          <div style={h3}>Модели (id OpenRouter)</div>
          {Object.keys(s.models).map(k => (
            <label key={k} style={lbl}>{MODEL_LABEL[k] || k}
              <input value={s.models[k]} onChange={e => set('models', { ...s.models, [k]: e.target.value.trim() })} style={input} />
            </label>
          ))}
        </div>
      </div>

      <div style={{ ...card, marginTop: 20 }}>
        <div style={h3}>Источники ({sources.length})</div>
        <div style={{ ...muted, marginBottom: 10 }}>Ленты читает collect.py. Реестр заполняется скриптом seed_sources.py; здесь можно выключить или включить ленту.</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '1px solid #d9d5cc' }}>{['вид', 'название', 'адрес', 'авторитет', 'находок', 'последний раз', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {sources.map(x => (
              <tr key={x.id} style={{ borderBottom: '1px solid #e6e3dc', opacity: x.active ? 1 : 0.5 }}>
                <td style={td}>{x.kind === 'rss' ? `лента${x.feed_kind ? ` (${x.feed_kind})` : ''}` : x.kind === 'search' ? 'поиск' : 'справочник'}</td>
                <td style={td}>{x.name}{x.organization ? <div style={muted}>{x.organization}</div> : null}</td>
                <td style={{ ...td, color: '#5c574f', fontSize: '1rem', wordBreak: 'break-all', maxWidth: 360 }}>{x.query_or_url}</td>
                <td style={td}>{x.authority ? `${x.authority}/5` : ''}</td>
                <td style={td}>{x.findings}</td>
                <td style={{ ...td, fontSize: '1rem' }}>{fmtDate(x.last_run_at)}{x.last_error && <div style={{ color: '#b3261e' }}>{x.last_error}</div>}</td>
                <td style={td}><button onClick={() => toggleSource(x.id, !x.active)} style={{ ...btn, color: x.active ? '#2e7d32' : '#6f6a61' }}>{x.active ? 'вкл' : 'выкл'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PipelineShell>
  )
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={lbl}>{label}
      <input type="number" step="0.1" value={value ?? ''} onChange={e => onChange(Number(e.target.value))} style={input} />
    </label>
  )
}

const h3: React.CSSProperties = { color: '#4a463f', fontSize: '0.95rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }
const lbl: React.CSSProperties = { display: 'block', fontSize: '1rem', color: '#5c574f', marginBottom: 12 }
