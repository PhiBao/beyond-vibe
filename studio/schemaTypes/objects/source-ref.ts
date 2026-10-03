import {defineField, defineType} from 'sanity'

/**
 * A pointer to a cited authority.
 *
 * Every rule, band and regime in this schema carries at least one of these. The
 * engine refuses to emit an unverified classification, so a rule without a
 * source is a bug, not a stylistic choice.
 */
export const sourceRef = defineType({
  name: 'sourceRef',
  title: 'Source',
  type: 'object',
  fields: [
    defineField({
      name: 'source',
      title: 'Authority',
      type: 'reference',
      to: [{type: 'source'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'locator',
      title: 'Locator',
      type: 'string',
      description: 'Where inside the source this claim lives (article, section, page, heading).',
    }),
    defineField({
      name: 'quote',
      title: 'Quote',
      type: 'text',
      rows: 3,
      description: 'Verbatim text that supports the claim.',
    }),
    defineField({
      name: 'stance',
      title: 'Stance',
      type: 'string',
      options: {
        list: [
          {title: 'Primary law', value: 'primary'},
          {title: 'Official guidance', value: 'guidance'},
          {title: 'Calculator / derived', value: 'derived'},
          {title: 'Secondary commentary', value: 'secondary'},
        ],
        layout: 'radio',
        direction: 'horizontal',
      },
      initialValue: 'guidance',
    }),
  ],
  preview: {
    select: {title: 'source.title', stance: 'stance'},
    prepare: ({title, stance}) => ({title: title ?? 'Source', subtitle: stance}),
  },
})