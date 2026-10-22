/**
 * In-memory mock of the D1Database surface used by the admin API.
 *
 * Supports the exact statement shapes the routes emit:
 *   SELECT <cols|*> FROM <t> [WHERE <c> = ? (AND ...)] [ORDER BY <c> [ASC|DESC]] [LIMIT ?|n]
 *   INSERT INTO <t> (<cols>) VALUES (?, ...)
 *   UPDATE <t> SET <c> = ?, ... WHERE <c> = ? (AND ...)
 *   DELETE FROM <t> [WHERE <c> = ? (AND ...)]
 *
 * Rows are plain objects keyed by column name. Anything else throws — a loud
 * failure is better than a silently wrong mock.
 */
export type Row = Record<string, unknown>;

function norm(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function parseConds(clause: string, params: unknown[], start: number): Array<{ col: string; val: unknown }> {
  const parts = clause.split(/\s+and\s+/i);
  return parts.map((part, i) => {
    const m = part.trim().match(/^(\w+)\s*=\s*\?$/);
    if (!m) throw new Error(`MockD1: unsupported WHERE condition: ${part}`);
    return { col: m[1] as string, val: params[start + i] };
  });
}

export class MockStatement {
  private params: unknown[] = [];
  constructor(
    private db: MockD1,
    private sql: string,
  ) {}
  bind(...params: unknown[]): this {
    this.params = params;
    return this;
  }
  async first<T = Row>(): Promise<T | null> {
    const rows = this.db.select(this.sql, this.params);
    return (rows[0] as T | undefined) ?? null;
  }
  async all<T = Row>(): Promise<{ results: T[]; success: boolean; meta: { changes: number } }> {
    return {
      results: this.db.select(this.sql, this.params) as T[],
      success: true,
      meta: { changes: 0 },
    };
  }
  async run(): Promise<{ success: boolean; meta: { changes: number }; results: never[] }> {
    const changes = this.db.mutate(this.sql, this.params);
    return { success: true, meta: { changes }, results: [] };
  }
}

export class MockD1 {
  readonly tables = new Map<string, Row[]>();

  prepare(sql: string): MockStatement {
    return new MockStatement(this, sql);
  }

  /** Test helper: raw rows of a table. */
  rowsOf(table: string): Row[] {
    return this.tables.get(table) ?? [];
  }

  private rows(table: string): Row[] {
    let r = this.tables.get(table);
    if (!r) {
      r = [];
      this.tables.set(table, r);
    }
    return r;
  }

  select(sql: string, params: unknown[]): Row[] {
    const q = norm(sql);
    const m = q.match(/^select\s+(.+?)\s+from\s+(\w+)(.*)$/i);
    if (!m) throw new Error(`MockD1: unsupported SELECT: ${sql}`);
    const colsRaw = m[1] as string;
    const table = m[2] as string;
    const rest = m[3] as string;
    let rows = this.rows(table).map((r) => ({ ...r }));
    let p = 0;

    const where = rest.match(/\s+where\s+(.+?)(\s+order\s+by\s+|\s+limit\s+|$)/i);
    if (where) {
      const conds = parseConds(where[1] as string, params, p);
      p += conds.length;
      rows = rows.filter((r) => conds.every((c) => r[c.col] === c.val));
    }
    const order = rest.match(/\s+order\s+by\s+(\w+)(?:\s+(asc|desc))?/i);
    if (order) {
      const col = order[1] as string;
      const dir = (order[2] ?? 'asc').toLowerCase();
      rows = rows.slice().sort((a, b) => {
        const av = a[col];
        const bv = b[col];
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const c = av < bv ? -1 : 1;
        return dir === 'desc' ? -c : c;
      });
    }
    const limit = rest.match(/\s+limit\s+(\?|\d+)/i);
    if (limit) {
      const n = limit[1] === '?' ? Number(params[p++]) : Number(limit[1]);
      rows = rows.slice(0, n);
    }
    const cols = colsRaw.trim();
    if (cols !== '*') {
      const list = cols.split(',').map((c) => c.trim());
      rows = rows.map((r) => Object.fromEntries(list.map((c) => [c, r[c]])));
    }
    return rows;
  }

  mutate(sql: string, params: unknown[]): number {
    const q = norm(sql);
    const ins = q.match(/^insert\s+into\s+(\w+)\s*\(([^)]+)\)\s*values\s*\(/i);
    if (ins) {
      const table = ins[1] as string;
      const cols = (ins[2] as string).split(',').map((c) => c.trim());
      const row: Row = {};
      cols.forEach((c, i) => {
        row[c] = params[i];
      });
      this.rows(table).push(row);
      return 1;
    }
    const upd = q.match(/^update\s+(\w+)\s+set\s+(.+?)\s+where\s+(.+)$/i);
    if (upd) {
      const table = upd[1] as string;
      const sets = (upd[2] as string).split(',').map((s) => {
        const sm = s.trim().match(/^(\w+)\s*=\s*\?$/);
        if (!sm) throw new Error(`MockD1: unsupported SET: ${s}`);
        return sm[1] as string;
      });
      const conds = parseConds(upd[3] as string, params, sets.length);
      let n = 0;
      for (const r of this.rows(table)) {
        if (conds.every((c) => r[c.col] === c.val)) {
          sets.forEach((col, i) => {
            r[col] = params[i];
          });
          n++;
        }
      }
      return n;
    }
    const del = q.match(/^delete\s+from\s+(\w+)(?:\s+where\s+(.+))?$/i);
    if (del) {
      const table = del[1] as string;
      const arr = this.rows(table);
      const whereClause = del[2] as string | undefined;
      if (!whereClause) {
        const n = arr.length;
        arr.length = 0;
        return n;
      }
      const conds = parseConds(whereClause, params, 0);
      let n = 0;
      for (let i = arr.length - 1; i >= 0; i--) {
        if (conds.every((c) => (arr[i] as Row)[c.col] === c.val)) {
          arr.splice(i, 1);
          n++;
        }
      }
      return n;
    }
    throw new Error(`MockD1: unsupported statement: ${sql}`);
  }
}
