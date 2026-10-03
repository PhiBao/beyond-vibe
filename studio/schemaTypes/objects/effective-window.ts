import {defineField, defineType} from 'sanity'

/**
 * A half-open date interval [from, to).
 *
 * `to` omitted means "still in force". Used for every time-conditional fact in
 * the dataset — Schengen access bands, visa regimes, precedent rulings.
 */
export const effectiveWindow = defineType({
  name: 'effectiveWindow',
  title: 'Effective window',
  type: 'object',
  fields: [
    defineField({
      name: 'from',
      title: 'From',
      type: 'date',
      description: 'Inclusive start date (YYYY-MM-DD).',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'to',
      title: 'To',
      type: 'date',
      description: 'Exclusive end date. Leave empty if still in force.',
    }),
    defineField({
      name: 'note',
      title: 'Note',
      type: 'string',
    }),
  ],
  preview: {
    select: {from: 'from', to: 'to'},
    prepare: ({from, to}) => ({
      title: `${from ?? '?'} → ${to ?? 'open'}`,
      subtitle: 'Effective window',
    }),
  },
})