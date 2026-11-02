import { randomUUID } from 'node:crypto';
import type pg from 'pg';

export interface BusinessGraph {
  label: string;
  businessId: string;
  ownerId: string;
  employeeId: string;
  customerId: string;
  programId: string;
  enrollmentId: string;
  /** Cycle 1: completed, with a prize. */
  completedCycleId: string;
  /** Cycle 2: open, with one stamp. */
  openCycleId: string;
  stampId: string;
  redemptionId: string;
}

let counter = 0;

/**
 * Everything one business needs to have a row in each table, inserted as the owner of the
 * tables (which ignores RLS). Used by the tests that check isolation.
 */
export async function insertBusinessGraph(admin: pg.Pool, label: string): Promise<BusinessGraph> {
  counter += 1;
  const g: BusinessGraph = {
    label,
    businessId: randomUUID(),
    ownerId: randomUUID(),
    employeeId: randomUUID(),
    customerId: randomUUID(),
    programId: randomUUID(),
    enrollmentId: randomUUID(),
    completedCycleId: randomUUID(),
    openCycleId: randomUUID(),
    stampId: randomUUID(),
    redemptionId: randomUUID(),
  };
  const slug = `${label.toLowerCase()}-${counter}`;
  const phone = `+55119${String(10000000 + counter).slice(-8)}`;

  await admin.query(
    `INSERT INTO businesses (id, name, slug, trial_ends_at) VALUES ($1, $2, $3, now())`,
    [g.businessId, `Business ${label}`, slug],
  );
  await admin.query(
    `INSERT INTO staff (id, business_id, name, email, role) VALUES
       ($1, $3, 'Owner', $4, 'owner'), ($2, $3, 'Employee', $5, 'employee')`,
    [g.ownerId, g.employeeId, g.businessId, `owner-${slug}@x.test`, `employee-${slug}@x.test`],
  );
  await admin.query(`INSERT INTO customers (id, phone_e164, name) VALUES ($1, $2, $3)`, [
    g.customerId,
    phone,
    `Customer ${label}`,
  ]);
  await admin.query(`INSERT INTO business_customers (business_id, customer_id) VALUES ($1, $2)`, [
    g.businessId,
    g.customerId,
  ]);
  await admin.query(
    `INSERT INTO programs (id, business_id, name, stamps_required, reward_description)
     VALUES ($1, $2, 'Card', 10, 'Free one')`,
    [g.programId, g.businessId],
  );
  // The enrollment points to its open cycle, and the cycle to the enrollment. The foreign key
  // of the enrollment is deferred, so both go in one transaction.
  const client = await admin.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO enrollments (id, business_id, customer_id, program_id, current_cycle_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [g.enrollmentId, g.businessId, g.customerId, g.programId, g.openCycleId],
    );
    await client.query(
      `INSERT INTO cycles (id, business_id, enrollment_id, number, status, stamps_required,
                           reward_description, validity_days, reward_validity_days, completed_at)
       VALUES ($1, $2, $3, 1, 'completed', 10, 'Free one', 30, 30, now()),
              ($4, $2, $3, 2, 'open', 10, 'Free one', 30, 30, NULL)`,
      [g.completedCycleId, g.businessId, g.enrollmentId, g.openCycleId],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  await admin.query(
    `INSERT INTO stamps (id, business_id, enrollment_id, cycle_id, customer_id, staff_id, method)
     VALUES ($1, $2, $3, $4, $5, $6, 'qr')`,
    [g.stampId, g.businessId, g.enrollmentId, g.openCycleId, g.customerId, g.employeeId],
  );
  await admin.query(
    `INSERT INTO redemptions (id, business_id, enrollment_id, cycle_id, customer_id,
                              reward_description, earned_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'Free one', now(), now() + interval '30 days')`,
    [g.redemptionId, g.businessId, g.enrollmentId, g.completedCycleId, g.customerId],
  );
  return g;
}
