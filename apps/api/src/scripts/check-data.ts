import { db } from '../db';
import { dayCloses } from '../db/schema';

async function checkData() {
  const result = await db.select({
    id: dayCloses.id,
    closedByUserName: dayCloses.closedByUserName,
  }).from(dayCloses).limit(5);
  console.log('Day Closes with closedByUserName:');
  console.log(JSON.stringify(result, null, 2));
}
checkData();
