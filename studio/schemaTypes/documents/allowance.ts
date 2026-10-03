import {defineField, defineType} from 'sanity'

/**
 * A short-stay allowance regime: "N days in any rolling M-day window".
 *
 * Kept generic on purpose. Schengen 90/180 is the regime we ship, but the
 * engine reads only limitDays / windowDays, so adding another regime is a
 * content change rather than a code change.
 */
export const allowance = defineType({
  name: 'allowance',
  title: 'Allowance',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'code',
      title: 'Code',
      type: 'slug',
      options: {source: 'title'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'windowDays',
      title: 'Window (days)',
      type: 'number',
      description: 'Length of the rolling window. 180 for Schengen.',
      validation: (rule) => rule.required().integer().positive(),
    }),
    defineField({
      name: 'limitDays',
      title: 'Limit (days)',
      type: 'number',
      description: 'Days permitted inside the window. 90 for Schengen short stays.',
      validation: (rule) => rule.required().integer().positive(),
    }),
    defineField({
      name: 'countingBasis',
      title: 'Counting basis',
      type: 'string',
      options: {
        list: [
          {
            title: 'Day of arrival counts, day of departure does not',
            value: 'arrival_inclusive',
          },
          {title: 'Every calendar day touched counts', value: 'any_touch'},
          {title: 'Departure day counts, arrival does not', value: 'departure_inclusive'},
        ],
      },
      initialValue: 'arrival_inclusive',
      validation: (rule) => rule.required(),
      description:
        'How partial days at the edges of a stay are treated. Schengen counts the day of arrival and not the day of departure.',
    }),
    defineField({
      name: 'consequences',
      title: 'Consequences of exceeding',
      type: 'array',
      of: [{type: 'string'}],
      description: 'Shown to the user. Kept qualitative on purpose — this product does not give advice.',
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
    select: {title: 'title', limit: 'limitDays', window: 'windowDays'},
    prepare: ({title, limit, window}) => ({title, subtitle: `${limit} in any ${window} days`}),
  },
})