import { createClient } from '@supabase/supabase-js';
const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await c.storage.from('avatars').createSignedUrl('34fcb430-8961-4237-b933-bea7db15b0cf/6i447z5u1bm.jpg', 3600);
console.log(JSON.stringify({data, error}, null, 2));
if (data?.signedUrl) {
  const r = await fetch(data.signedUrl);
  console.log('STATUS:', r.status);
}
