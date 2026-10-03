import {defineField, defineType} from 'sanity'

/**
 * What a nationality class may do inside an allowance, over a time window.
 */
export const visaRegime = defineType({
  name: 'visaRegime',
  title: 'Visa regime',
  type: 'document',
  fields: [
    defineField({
      name: 'nationalityClass',
      title: 'Nationality class',
      type: 'reference',
      to: [{type: 'nationalityClass'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'allowance',
      title: 'Allowance',
      type: 'reference',
      to: [{type: 'allowance'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'window',
      title: 'Window',
      type: 'effectiveWindow',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'visaRequired',
      title: 'Visa required',
      type: 'boolean',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'maxDaysPerEntry',
      title: 'Max days per entry',
      type: 'number',
      description:
        'Days permitted per single entry stamp. Distinct from the rolling allowance.',
      validation: (rule) => rule.integer().positive(),
    }),
    defineField({
      name: 'allowedPurposes',
      title: 'Allowed purposes',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        list: [
          {title: 'Tourism', value: 'tourism'},
          {title: 'Business', value: 'business'},
          {title: 'Visiting family', value: 'family'},
          {title: 'Study', value: 'study'},
          {title: 'Work', value: 'work'},
          {title: 'Transit', value: 'transit'},
        ],
      },
    }),
    defineField({
      name: 'notes',
      title: 'Notes',
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
    select: {
      cls: 'nationalityClass.label',
      allowance: 'allowance.title',
      visaRequired: 'visaRequired',
    },
    prepare: ({cls, allowance, visaRequired}) => ({
      title: `${cls ?? '?'} → ${allowance ?? '?'}`,
      subtitle: visaRequired ? 'Visa required' : 'Visa-free',
    }),
  },
})