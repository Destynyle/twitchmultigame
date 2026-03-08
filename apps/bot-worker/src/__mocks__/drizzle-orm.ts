// Minimal mock for drizzle-orm used in tests

export const eq = (_col: unknown, _val: unknown) => ({ _type: 'eq', _col, _val })
export const and = (..._args: unknown[]) => ({ _type: 'and', _args })
export const desc = (_col: unknown) => ({ _type: 'desc', _col })
export const asc = (_col: unknown) => ({ _type: 'asc', _col })
export const sql = (_strings: TemplateStringsArray, ..._values: unknown[]) => ({ _type: 'sql' })
