import { sql, type Transaction } from 'kysely';
import type { Database } from './database';
import type { DB } from './types.generated';

/** Who the request acts for: a business (staff and owner) or a customer. Never both. */
export type TenantContext = { businessId: string } | { customerId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs `work` in one transaction with the row level security context set by `SET LOCAL`
 * (`set_config(..., true)`), as in docs/DATA_MODEL.md section 9. The context lives only until
 * the transaction ends, so a pooled connection never carries it to the next request.
 *
 * The id comes from the verified token, never from the body of the request (docs/API.md).
 * Tenant filters are not written in the code of the rules: the database applies them.
 */
export async function withTenantContext<T>(
  db: Database,
  context: TenantContext,
  work: (trx: Transaction<DB>) => Promise<T>,
): Promise<T> {
  const [setting, id] =
    'businessId' in context
      ? (['app.business_id', context.businessId] as const)
      : (['app.customer_id', context.customerId] as const);
  if (!UUID.test(id)) throw new Error(`Invalid id for ${setting}`);

  return db.transaction().execute(async (trx) => {
    await sql`SELECT set_config(${setting}, ${id}, true)`.execute(trx);
    return work(trx);
  });
}
