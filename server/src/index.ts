import 'dotenv/config';
import { app } from './app.js';
import { connectDb } from './db.js';
import { persistReadings, seed } from './repository.js';
import { tick } from './store.js';

const port=Number(process.env.PORT||5000);

if(process.env.NODE_ENV==='production'&&!process.env.JWT_SECRET){
  console.error('JWT_SECRET must be set in production. Refusing to start with the development fallback.');
  process.exit(1);
}

await connectDb();
await seed();

// The simulator runs fast so the dashboard feels live; persistence is slower to stay inside
// the Atlas free tier. See READING_TTL_DAYS in models.ts for how old readings are reclaimed.
setInterval(tick,Number(process.env.SENSOR_INTERVAL_MS||4000)).unref();
setInterval(()=>{void persistReadings();},Number(process.env.PERSIST_INTERVAL_MS||30000)).unref();

app.listen(port,()=>console.log(`MaintAI API listening on http://localhost:${port}`));
