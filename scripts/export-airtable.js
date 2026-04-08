const fs = require('fs');
const path = require('path');

const TOKEN = process.env.AIRTABLE_TOKEN;
const APP_ID = process.env.AIRTABLE_APP_ID;
const TABLE_ID = process.env.AIRTABLE_TABLE_ID;
const EVENTS_TABLE_ID = 'tbl6JeW1z4f8XAyaz';

async function fetchAirtableTable(tableId, filterFormula) {
  const records = [];
  let offset;

  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) params.set('offset', offset);
    if (filterFormula) params.set('filterByFormula', filterFormula);

    const res = await fetch(
      `https://api.airtable.com/v0/${APP_ID}/${tableId}?${params}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    if (!res.ok) {
      throw new Error(`Airtable error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  return records;
}

async function main() {
  console.log('Exporting Airtable data...');

  try {
    const [artworks, events] = await Promise.all([
      fetchAirtableTable(TABLE_ID),
      fetchAirtableTable(EVENTS_TABLE_ID, '{Опубликовать}=1'),
    ]);

    const cacheDir = path.join(__dirname, '..', 'public', 'cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(cacheDir, 'artworks.json'),
      JSON.stringify(artworks, null, 2)
    );
    fs.writeFileSync(
      path.join(cacheDir, 'events.json'),
      JSON.stringify(events, null, 2)
    );

    console.log(`✓ Exported ${artworks.length} artworks`);
    console.log(`✓ Exported ${events.length} events`);
    console.log('✓ Cache updated:', new Date().toISOString());
  } catch (error) {
    console.error('Export failed:', error);
    process.exit(1);
  }
}

main();
