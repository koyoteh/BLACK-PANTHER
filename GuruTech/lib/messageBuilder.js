import { pantherBox } from './pantherStyle.js';

function normalizeLine(value) {
  return String(value ?? '')
    .replace(/^\s*(?:│|┊|>\s*)/u, '')
    .trim();
}

function render(title, lines = []) {
  const values = (Array.isArray(lines) ? lines : [lines]).map(normalizeLine);
  return pantherBox(title, values, { includeSection: true });
}

export function buildMsg(title, lines = []) {
  return render(title, lines);
}

export function buildLine(msg) {
  return render('NOTICE', [msg]);
}

export function buildError(title, err) {
  const message = err instanceof Error ? err.message : String(err);
  return render(`${title} ERROR`, [`⚠️ ${message}`]);
}

export function buildList(title, items = []) {
  return render(title, (Array.isArray(items) ? items : [items]).map((item, index) => `◆ ${index + 1}  ⟶  ${item}`));
}

export function buildField(title, fields = {}) {
  return render(title, Object.entries(fields).map(([key, value]) => `◆ ${key}  ⟶  ${value}`));
}

export function buildUsage(cmd, usage, example) {
  return render(String(cmd).toUpperCase(), [`◆ Usage   ⟶  ${usage}`, `◆ Example ⟶  ${example}`]);
}
