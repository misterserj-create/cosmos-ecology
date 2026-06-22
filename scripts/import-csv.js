// Запуск: DATABASE_URL=... node scripts/import-csv.js
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const cache = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/cache/artworks.json'), 'utf-8'))

  for (const rec of cache) {
    const f = rec.fields
    const imgs = f['Изображение'] || []
    const imageUrl = imgs[0]?.url || ''

    await pool.query(
      `INSERT INTO artworks (art_id, title, author, technique, materials, size, year, status, desc_short, curator_text, image_url, in_catalog, category)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (art_id) DO NOTHING`,
      [
        f['ID'] || `REC-${rec.id}`,
        f['Название'] || '',
        f['Автор'] || '',
        f['Техника'] || '',
        f['Материалы'] || '',
        f['Габариты (см)'] || '',
        parseInt(f['Год']) || 0,
        f['Статус'] || '',
        f['Описание (короткое)'] || '',
        f['Кураторский текст'] || '',
        imageUrl,
        f['В каталог'] === true,
        f['Категория'] || '',
      ]
    )
  }

  console.log(`Импортировано ${cache.length} работ`)
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
