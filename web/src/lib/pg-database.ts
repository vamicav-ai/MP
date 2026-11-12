type QueryRow = Record<string, unknown>;
type QueryResult = { rows: QueryRow[]; rowCount: number | null };
export type QueryClient = {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
};
export type RunResult = { changes: number; lastInsertRowid: number | bigint | undefined };
export type Statement = {
  all(...values: unknown[]): Promise<QueryRow[]>;
  get(...values: unknown[]): Promise<QueryRow | undefined>;
  run(...values: unknown[]): Promise<RunResult>;
};
export type DatabaseClient = {
  prepare(query: string): Statement;
};
export type TransactionalDatabaseClient = DatabaseClient & {
  transaction<T>(callback: (transaction: DatabaseClient) => Promise<T>): Promise<T>;
};
type PoolClient = QueryClient & { release(): void };
type QueryPool = QueryClient & { connect(): Promise<PoolClient> };

function normalizeQuery(query: string): string {
  return query
    .replace(/\bdatetime\(\s*'now'\s*\)/gi, "now()")
    .replace(/\bgroup_concat\s*\(\s*([^,()]+?)\s*,\s*'([^']*)'\s*\)/gi, "string_agg($1, '$2')")
    .replace(/\bgroup_concat\s*\(\s*(distinct\s+)?([^,()]+?)\s*\)/gi, "string_agg($1$2, ',')");
}

function toPostgresParameters(query: string): string {
  let index = 0;
  return query.replace(/\?/g, () => `$${++index}`);
}

function makeClient(client: QueryClient): DatabaseClient {
  return {
    prepare(query) {
      const statement = normalizeQuery(query);
      return {
        async all(...values) {
          const result = await client.query(toPostgresParameters(statement), values);
          return result.rows;
        },
        async get(...values) {
          const rows = await this.all(...values);
          return rows[0];
        },
        async run(...values) {
          let sql = toPostgresParameters(statement);
          if (/^\s*INSERT\b/i.test(sql) && /\bOR\s+IGNORE\b/i.test(sql)) {
            sql = sql.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO");
            sql += " ON CONFLICT DO NOTHING";
          }
          const result = await client.query(sql, values);
          const insertedId = result.rows[0]?.id;
          return {
            changes: result.rowCount ?? result.rows.length,
            lastInsertRowid: typeof insertedId === "number" || typeof insertedId === "bigint" ? insertedId : undefined,
          };
        },
      };
    },
  };
}

export function createDatabaseClient(pool: QueryPool): TransactionalDatabaseClient {
  const client = makeClient(pool);
  return {
    ...client,
    async transaction(callback) {
      const connection = await pool.connect();
      try {
        await connection.query("BEGIN");
        const result = await callback(makeClient(connection));
        await connection.query("COMMIT");
        return result;
      } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}
