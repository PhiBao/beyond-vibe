import {defineField, defineType} from 'sanity'

/**
 * A named journey. The unit a person plans against and the unit the demo loads.
 */
export const itinerary = defineType({
  name: 'itinerary',
  title: 'Itinerary',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'title'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'holder',
      title: 'Holder',
      type: 'holder',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'allowance',
      title: 'Allowance',
      type: 'reference',
      to: [{type: 'allowance'}],
      description: 'Left empty, the engine resolves the regime from the holder.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'summary',
      title: 'Summary',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'demo',
      title: 'Demo itinerary',
      type: 'boolean',
      initialValue: false,
      description: 'Marks the itineraries surfaced in the public demo.',
    }),
  ],
  preview: {
    select: {title: 'title', passport: 'holder.passport', demo: 'demo'},
    prepare: ({title, passport, demo}) => ({
      title: demo ? `▶ ${title}` : title,
      subtitle: passport ? `Passport ${passport}` : undefined,
    }),
  },
})