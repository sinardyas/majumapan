import { db } from '../db';
import { dayCloses, operationalDays, users } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

async function backfillClosedByUserName() {
  console.log('Backfilling closed_by_user_name for day_closes...');

  const result = await db.update(dayCloses)
    .set({ closedByUserName: users.name })
    .from(users)
    .where(
      sql`${dayCloses.closedByUserId} = ${users.id}
        AND (${dayCloses.closedByUserName} IS NULL OR ${dayCloses.closedByUserName} = '')`
    );

  console.log('Updated day_closes records');

  console.log('Backfilling closed_by_user_name for operational_days...');

  const result2 = await db.update(operationalDays)
    .set({ closedByUserName: users.name })
    .from(users)
    .where(
      sql`${operationalDays.closedByUserId} = ${users.id}
        AND (${operationalDays.closedByUserName} IS NULL OR ${operationalDays.closedByUserName} = '')`
    );

  console.log('Updated operational_days records');

  console.log('Done!');
}

backfillClosedByUserName().catch(console.error);
