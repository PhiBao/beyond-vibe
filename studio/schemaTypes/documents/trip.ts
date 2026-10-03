import {defineField, defineType} from 'sanity'

/** A journey, with each stretch of presence attributed to a territory. */
export const trip = defineType({
  name: 'trip',
  title: 'Trip',
  type: 'document',
  fields: [
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'itinerary',
      title: 'Itinerary',
      type: 'reference',
      to: [{type: 'itinerary'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'stays',
      title: 'Stays',
      type: 'array',
      of: [{type: 'stay'}],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'notes',
      title: 'Notes',
      type: 'text',
      rows: 2,
    }),
  ],
  preview: {
    select: {label: 'label', itinerary: 'itinerary.title', stays: 'stays'},
    prepare: ({label, itinerary, stays}) => ({
      title: label,
      subtitle: `${stays?.length ?? 0} stay(s) · ${itinerary ?? ''}`,
    }),
  },
})