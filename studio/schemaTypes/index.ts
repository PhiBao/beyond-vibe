/**
 * Schema entry point. Only types listed here are part of the Studio schema and
 * are available to schema deployment and to Sanity Context.
 *
 * The registry is grouped by role rather than sorted alphabetically, because the
 * order mirrors how the engine resolves a verdict:
 *   sources → regime → territories → the person → their history → their rulings
 */

// --- Provenance -------------------------------------------------------------
import {source} from './documents/source'

// --- The regime ------------------------------------------------------------
import {allowance} from './documents/allowance'

// --- Geography and people ---------------------------------------------------
import {territory} from './documents/territory'
import {nationalityClass} from './documents/nationality-class'
import {visaRegime} from './documents/visa-regime'
import {permitExemption} from './documents/permit-exemption'
import {presenceRule} from './documents/presence-rule'

// --- A person's history -----------------------------------------------------
import {itinerary} from './documents/itinerary'
import {trip} from './documents/trip'

// --- Adjudication -----------------------------------------------------------
import {dispute} from './documents/dispute'
import {precedent} from './documents/precedent'

// --- Reusable objects -------------------------------------------------------
import {sourceRef} from './objects/source-ref'
import {effectiveWindow} from './objects/effective-window'
import {accessBand} from './objects/access-band'
import {stay} from './objects/stay'
import {holder} from './objects/holder'
import {competingClaim} from './objects/competing-claim'
import {ruling} from './objects/ruling'

export const schemaTypes = [
  // Provenance
  source,
  sourceRef,

  // Regime
  allowance,
  effectiveWindow,

  // Geography and people
  territory,
  accessBand,
  nationalityClass,
  visaRegime,
  permitExemption,
  presenceRule,

  // History
  itinerary,
  holder,
  trip,
  stay,

  // Adjudication
  dispute,
  competingClaim,
  ruling,
  precedent,
]