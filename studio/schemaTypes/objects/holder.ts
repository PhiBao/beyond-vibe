import {defineField, defineType} from 'sanity'

/** The person whose history is being counted. */
export const holder = defineType({
  name: 'holder',
  title: 'Holder',
  type: 'object',
  fields: [
    defineField({
      name: 'passport',
      title: 'Passport',
      type: 'string',
      description: 'ISO 3166-1 alpha-2, e.g. IN, US, GB.',
      validation: (rule) => rule.required().uppercase().length(2),
    }),
    defineField({
      name: 'nationalityClass',
      title: 'Nationality class',
      type: 'reference',
      to: [{type: 'nationalityClass'}],
      description: 'Optional override. Left empty, the engine resolves it from the passport.',
    }),
    defineField({
      name: 'permit',
      title: 'Permit or status',
      type: 'reference',
      to: [{type: 'permitExemption'}],
      description: 'Optional. A residence permit changes what the counter is allowed to do.',
    }),
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      description: 'Optional name shown in the UI.',
    }),
  ],
  preview: {
    select: {passport: 'passport', label: 'label'},
    prepare: ({passport, label}) => ({title: label ?? passport, subtitle: passport}),
  },
})