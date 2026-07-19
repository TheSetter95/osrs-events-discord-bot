require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

// Deze client gebruikt de SERVICE ROLE key, die alle RLS-policies omzeilt.
// Dat is precies wat we hier willen: de bot handelt namens het systeem,
// niet namens een ingelogde website-gebruiker.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

module.exports = { supabaseAdmin }
