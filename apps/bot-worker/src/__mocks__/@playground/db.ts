// Mock for @playground/db used in tests
// The real implementations are replaced by the test file's vi.mock() calls

export const db = {
  select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
  insert: () => ({ values: () => Promise.resolve() }),
  update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
}

export const withTenantContext = async <T>(
  _tenantId: string,
  callback: (tx: typeof db) => Promise<T>
): Promise<T> => {
  return callback(db)
}

export type Database = typeof db
export type Transaction = typeof db
