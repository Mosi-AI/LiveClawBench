export const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #f5f5f5; color: #222; }
nav { background: #4caf50; color: #fff; padding: 0.75rem 1rem; display: flex; gap: 1rem; align-items: center; }
nav a { color: #fff; text-decoration: none; font-weight: 600; }
nav a:hover { text-decoration: underline; }
.container { max-width: 900px; margin: 1rem auto; padding: 0 1rem; }
.card { background: #fff; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.1); padding: 1rem; margin-bottom: 1rem; }
.slot-card { margin-bottom: 1rem; }
.slot-title { font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; color: #333; border-bottom: 1px solid #eee; padding-bottom: 0.25rem; }
.entry-row { display: flex; justify-content: space-between; align-items: center; padding: 0.3rem 0; border-bottom: 1px solid #f0f0f0; }
.entry-row:last-child { border-bottom: none; }
.entry-name { font-weight: 500; }
.entry-meta { font-size: 0.8rem; color: #666; }
.btn { display: inline-block; padding: 0.4rem 0.9rem; border-radius: 4px; border: none; cursor: pointer; font-size: 0.9rem; text-decoration: none; }
.btn-primary { background: #4caf50; color: #fff; }
.btn-secondary { background: #eee; color: #333; }
.btn-danger { background: #f44336; color: #fff; }
.btn-sm { padding: 0.2rem 0.5rem; font-size: 0.8rem; }
.summary-panel { background: #e8f5e9; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
.summary-row { display: flex; justify-content: space-between; }
.summary-label { color: #555; }
.summary-value { font-weight: 700; }
.macro-bar { height: 8px; border-radius: 4px; background: #c8e6c9; margin: 0.2rem 0; }
.macro-bar-fill { height: 100%; border-radius: 4px; background: #4caf50; }
.daynav { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem; }
.daynav a { color: #4caf50; text-decoration: none; font-size: 0.9rem; }
.daynav .date-label { font-weight: 700; font-size: 1rem; }
form.inline { display: inline; }
.form-group { margin-bottom: 0.75rem; }
label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.2rem; color: #444; }
input, select, textarea { width: 100%; padding: 0.4rem 0.6rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.95rem; }
.error { color: #c62828; font-size: 0.85rem; margin-top: 0.2rem; }
.search-result { padding: 0.4rem 0; border-bottom: 1px solid #eee; }
.search-result a { color: #2e7d32; text-decoration: none; }
.search-result a:hover { text-decoration: underline; }
.plan-grid { display: grid; gap: 0.5rem; }
.plan-day { background: #fafafa; border: 1px solid #e0e0e0; border-radius: 6px; padding: 0.75rem; }
.plan-day-date { font-weight: 700; margin-bottom: 0.4rem; }
.tabs { display: flex; gap: 0; border-bottom: 2px solid #4caf50; margin-bottom: 1rem; }
.tab { padding: 0.5rem 1rem; cursor: pointer; background: none; border: none; font-size: 0.95rem; color: #666; }
.tab.active { background: #4caf50; color: #fff; border-radius: 4px 4px 0 0; }
.ingredient-row { display: flex; gap: 0.5rem; align-items: center; padding: 0.3rem 0; border-bottom: 1px solid #eee; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #eee; font-size: 0.9rem; }
th { background: #f5f5f5; font-weight: 700; }
.note { font-size: 0.8rem; color: #888; margin-top: 0.25rem; }
h1 { font-size: 1.4rem; margin-bottom: 0.75rem; }
h2 { font-size: 1.1rem; margin-bottom: 0.5rem; }
.edit-form-row { background: #f9fbe7; border: 1px solid #dce775; border-radius: 4px; padding: 0.5rem; margin-bottom: 0.5rem; }
.edit-form-row .form-row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
`;
