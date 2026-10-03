import {createClient} from 'next-sanity'

/**
 * Server-side Sanity client.
 *
 * The dataset is private, so every read needs the server-only token — an
 * unauthenticated read returns zero documents rather than an error, which is a
 * quiet way to look like an empty dataset. `verify:data` exists to make that
 * failure loud.
 *
 * Reads deliberately bypass the CDN: the corpus is small and read rarely, and
 * the adjudication flow needs to see a ruling immediately after it is written.
 */
export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? 'jvgi63fz'
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
export const apiVersion = '2026-01-01'

function requireToken(): string {
  const token = process.env.SANITY_API_READ_TOKEN ?? process.env.SANITY_API_TOKEN
  if (!token) {
    throw new Error(
      'SANITY_API_READ_TOKEN is not set. The dataset is private, so reads without a token silently return nothing.',
    )
  }
  return token
}

export const readClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: process.env.SANITY_API_READ_TOKEN ?? process.env.SANITY_API_TOKEN,
  perspective: 'published',
})

export function writeClient() {
  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false,
    token: requireToken(),
  })
}