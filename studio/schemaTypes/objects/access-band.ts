import {defineField, defineType} from 'sanity'

/**
 * Whether — and since when — days on this territory count against a short-stay
 * allowance.
 *
 * This is the structural heart of the dataset. Schengen membership is not a
 * boolean: Bulgaria and Romania admitted travellers by land and sea before they
 * admitted air arrivals, so a trip in 2024 can count differently from the same
 * trip in 2025 depending on the mode of arrival. Modelling that as a flag throws
 * away exactly the information the product exists to surface.
 */
export const accessBand = defineType({
  name: 'accessBand',
  title: 'Access band',
  type: 'object',
  fields: [
    defineField({
      name: 'window',
      title: 'Window',
      type: 'effectiveWindow',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'counted',
      title: 'Days count against the allowance?',
      type: 'boolean',
      description:
        'True when a day physically present here is charged to the short-stay allowance. False for territories that are outside the area (UK, Ireland, Switzerland) and for in-state carve-outs (the Canary Islands, Ceuta and Melilla, the Azores and Madeira, Svalbard).',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'modes',
      title: 'Arrival modes',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        list: [
          {title: 'Air', value: 'air'},
          {title: 'Land', value: 'land'},
          {title: 'Sea', value: 'sea'},
        ],
        layout: 'grid',
      },
      description:
        'Which arrival modes this band applies to. Omit if the band applies to every mode.',
    }),
    defineField({
      name: 'basis',
      title: 'Basis',
      type: 'string',
      description: 'Short explanation of why the band is counted or exempt.',
    }),
    defineField({
      name: 'sources',
      title: 'Sources',
      type: 'array',
      of: [{type: 'sourceRef'}],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: {from: 'window.from', to: 'window.to', counted: 'counted'},
    prepare: ({from, to, counted}) => ({
      title: `${from ?? '?'} → ${to ?? 'open'}`,
      subtitle: counted ? 'Counts toward allowance' : 'Does not count',
    }),
  },
})