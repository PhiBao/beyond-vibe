/**
 * Deterministic document IDs.
 *
 * The seed script writes documents under these IDs so that re-running it
 * updates in place instead of duplicating the dataset. The same IDs are used
 * when building an offline snapshot, which guarantees that the engine produces
 * identical verdicts whether its rules came from Sanity or from the local
 * dataset. That equivalence is what makes the demo and the tests trustworthy.
 */

export type DocType =
  | 'source'
  | 'allowance'
  | 'territory'
  | 'nationalityClass'
  | 'visaRegime'
  | 'permitExemption'
  | 'presenceRule'
  | 'precedent'
  | 'dispute'
  | 'itinerary'
  | 'trip'

export function docId(type: DocType, key: string): string {
  return `ninety.${type}.${key}`
}