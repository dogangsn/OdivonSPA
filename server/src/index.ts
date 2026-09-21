import 'dotenv/config';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 8787);

createApp().listen(port, () => {
  console.log(`odivon-spa-server listening on :${port}`);
});
