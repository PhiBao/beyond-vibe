import {defineField, defineType} from 'sanity'

/**
 * A passport class treated alike under the visa rules.
 *
 * The engine never reasons about individual nationalities. It resolves a
 * nationality to a class, and the class resolves to regimes. If a class is
 * missing from the dataset the product refuses to answer rather than guessing —
 * an absent fact and a permissive fact must never look the same.
 */
export const nationalityClass = defineType({
  name: 'nationalityClass',
  title: 'Nationality class',
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
      name: 'passports',
      title: 'Passport codes',
      type: 'array',
      of: [{type: 'string'}],
      options: {layout: 'tags'},
      description: 'ISO 3166-1 alpha-2 codes included in this class.',
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'summary',
      title: 'Summary',
      type: 'text',
      rows: 2,
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
    select: {label: 'label', passports: 'passports'},
    prepare: ({label, passports}) => ({
      title: label,
      subtitle: passports?.length ? `${passports.length} passport(s)` : undefined,
    }),
  },
})