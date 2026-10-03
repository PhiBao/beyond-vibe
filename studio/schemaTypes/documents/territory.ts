import {defineField, defineType} from 'sanity'

/**
 * A territory whose days may or may not be charged to an allowance.
 *
 * Two distinct populations live here:
 *   1. States inside the area (France, Bulgaria, Croatia...)
 *   2. States and territories outside it — plus the in-state carve-outs that
 *      catch people out (Canary Islands, Ceuta and Melilla, Azores and Madeira,
 *      Svalbard, Büsingen, Campione, Åland).
 *
 * Modelling carve-outs as first-class territories, rather than as flags on the
 * parent state, means the ledger can name the exact place a day was spent.
 */
export const territory = defineType({
  name: 'territory',
  title: 'Territory',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'code',
      title: 'Code',
      type: 'string',
      description: 'ISO 3166-1 alpha-2, or a synthetic code for sub-national territories.',
      validation: (rule) => rule.required().uppercase().length(2),
    }),
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: {
        list: [
          {title: 'State', value: 'state'},
          {title: 'In-state territory outside the area', value: 'carve_out'},
          {title: 'Outside the area', value: 'external'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'carveOutOf',
      title: 'Carve-out of',
      type: 'reference',
      to: [{type: 'territory'}],
      description: 'For kind = carve_out, the state whose area this sits outside of.',
      hidden: ({parent}) => parent?.kind !== 'carve_out',
    }),
    defineField({
      name: 'allowances',
      title: 'Applies to allowances',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'allowance'}]}],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'accessBands',
      title: 'Access bands',
      type: 'array',
      of: [{type: 'accessBand'}],
      description:
        'Time-banded membership. Order matters: the engine picks the band whose window contains the date under test.',
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: {name: 'name', code: 'code', kind: 'kind'},
    prepare: ({name, code, kind}) => ({title: `${name} (${code})`, subtitle: kind}),
  },
})