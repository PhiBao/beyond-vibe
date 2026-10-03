import {defineBlueprint, defineCorsOrigin, defineDocumentFunction} from '@sanity/blueprints'

/**
 * Ninety's infrastructure, declared rather than configured by clicking.
 *
 * Everything below was previously a set of manual dashboard steps that nobody
 * could review. As a blueprint it is version-controlled, reviewable in a diff,
 * and reproducible with `blueprints plan` before anything is applied.
 *
 * The one that matters for the product is `complete-adjudication`. Ninety's
 * central claim is that a ruling is not a message — it is a typed, dated,
 * scoped precedent that every later calculation reads. The web app writes that
 * precedent when you use the desk, but a dispute can also be adjudicated by
 * editing the document in the Studio. Without a guard, that path produces a
 * dispute marked adjudicated with no precedent behind it: exactly the silent
 * inconsistency that shipped once during this build.
 *
 * So the invariant is enforced in the data layer, not only in the interface.
 */
export default defineBlueprint({
  values: {
    appOrigin: 'https://web-eight-amber-6zft3r0kdf.vercel.app',
    organizationId: 'ovihgdwkx',
  },

  resources: [
    /**
     * The Studio application is deliberately NOT declared here.
     *
     * Blueprints refuses to adopt a Studio that already exists, and this one was
     * created by `sanity deploy` with the appId from the Dashboard. Declaring it
     * would fail the whole plan with `Slug "beyond-vibe" is already taken`.
     *
     * That is also the documented split: `sanity deploy` owns the Studio
     * application, `sanity blueprints deploy` owns infrastructure. The hostname
     * is not cosmetic either — Sanity Context refuses to serve a dataset whose
     * Studio has never been deployed, so `sanity deploy` is load-bearing for the
     * agent and belongs in its own step.
     */

    /** The web app is the only browser origin that reads this dataset. */
    defineCorsOrigin({
      name: 'web-app',
      origin: '$.values.appOrigin',
      // No credentials: this origin reads the dataset server-side with a token,
      // and it must never be able to act as a signed-in Studio user.
      allowCredentials: false,
    }),

    /**
     * Completes the adjudication lifecycle wherever it was started.
     *
     * Fires when a dispute becomes adjudicated. If the ruling has no precedent
     * attached, one is written — scoped to the presence kind, effective from the
     * date of the ruling, and carrying the presence rule's own sources so the
     * ledger's citations stay intact.
     *
     * Older precedents for the same presence kind are superseded rather than
     * deleted, because a ruling history is evidence. The filter requires the
     * document to still be incomplete, so the patch this function performs does
     * not re-trigger it.
     */
    defineDocumentFunction({
      name: 'complete-adjudication',
      displayName: 'Complete an adjudication',
      memory: 1,
      timeout: 30,
      event: {
        on: ['create', 'update'],
        filter: '_type == "dispute" && status == "adjudicated" && !defined(precedent)',
      },
    }),
  ],
})
