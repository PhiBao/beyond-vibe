/**
 * Loads `.env.local` before anything else runs.
 *
 * This must be the FIRST import in any script that touches the Sanity client.
 * ES module imports are hoisted and evaluated in order, so an inline
 * `loadEnvFile()` call in the body of a script would run *after* the client
 * module had already read `process.env` at module scope — leaving the client
 * silently unauthenticated on a private dataset.
 */
import {existsSync} from 'node:fs'
import {loadEnvFile} from 'node:process'

for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) {
    try {
      loadEnvFile(file)
    } catch {
      // A malformed env file surfaces as a missing token below, which is a
      // clearer error than a parse failure here.
    }
  }
}

export {}