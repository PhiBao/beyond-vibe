import {defineField, defineType} from 'sanity'

/** One continuous stretch of presence in a single territory. */
export const stay = defineType({
  name: 'stay',
  title: 'Stay',
  type: 'object',
  fields: [
    defineField({
      name: 'territory',
      title: 'Territory',
      type: 'reference',
      to: [{type: 'territory'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'arrive',
      title: 'Arrival date',
      type: 'date',
      description: 'Date you were first present, YYYY-MM-DD.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'depart',
      title: 'Departure date',
      type: 'date',
      description:
        'Date you were last present. For a stay in progress, leave empty — it defaults to today.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'presenceRule',
      title: 'Nature of presence',
      type: 'reference',
      to: [{type: 'presenceRule'}],
      description: 'How this presence should be charged. Defaults to a cleared entry.',
    }),
    defineField({
      name: 'mode',
      title: 'Arrival mode',
      type: 'string',
      options: {
        list: [
          {title: 'Air', value: 'air'},
          {title: 'Land', value: 'land'},
          {title: 'Sea', value: 'sea'},
        ],
        layout: 'radio',
      },
      initialValue: 'land',
      description: 'Used to resolve date-banded access bands.',
    }),
    defineField({
      name: 'note',
      title: 'Note',
      type: 'string',
    }),
  ],
  preview: {
    select: {territory: 'territory.name', arrive: 'arrive', depart: 'depart'},
    prepare: ({territory, arrive, depart}) => ({
      title: territory ?? 'Stay',
      subtitle: `${arrive ?? '?'} → ${depart ?? 'present'}`,
    }),
  },
})