import {defineField, defineType} from 'sanity'

/**
 * How one kind of presence is charged to the allowance.
 *
 * This is where the interesting disagreements live. An airport transit that never
 * passes border control, an overnight arrival, a day spent inside a city's
 * excluded airport perimeter — official sources phrase these differently, and
 * travellers routinely guess wrong. `disputed` marks the cases where the corpus
 * genuinely conflicts, which is what routes a day to adjudication instead of a
 * silent guess.
 */
export const presenceRule = defineType({
  name: 'presenceRule',
  title: 'Presence rule',
  type: 'document',
  fields: [
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'code',
      title: 'Code',
      type: 'slug',
      options: {source: 'label'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'kind',
      title: 'Presence kind',
      type: 'string',
      options: {
        list: [
          {title: 'Cleared entry (passed border control)', value: 'cleared_entry'},
          {title: 'Airport transit, airside, no border control', value: 'airport_transit'},
          {title: 'Airport transit, landside', value: 'airport_transit_landside'},
          {title: 'Overnight arrival', value: 'overnight_arrival'},
          {title: 'Same-day visit', value: 'same_day'},
          {title: 'Long-stay / permitted presence', value: 'permitted'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'counted',
      title: 'Counts against the allowance?',
      type: 'boolean',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'disputed',
      title: 'Sources disagree?',
      type: 'boolean',
      initialValue: false,
      description:
        'When true, the ledger will not silently classify a day of this kind — it routes the day to an adjudication instead.',
    }),
    defineField({
      name: 'rationale',
      title: 'Rationale',
      type: 'text',
      rows: 3,
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
    select: {label: 'label', counted: 'counted', disputed: 'disputed'},
    prepare: ({label, counted, disputed}) => ({
      title: label,
      subtitle: disputed ? 'Disputed — needs a ruling' : counted ? 'Counts' : 'Does not count',
    }),
  },
})