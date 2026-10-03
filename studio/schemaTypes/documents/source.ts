import {defineField, defineType} from 'sanity'

/**
 * A cited authority — the root of the provenance graph.
 */
export const source = defineType({
  name: 'source',
  title: 'Source',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'publisher',
      title: 'Publisher',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
      validation: (rule) => rule.required().uri({scheme: ['http', 'https']}),
    }),
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: {
        list: [
          {title: 'Legislation', value: 'legislation'},
          {title: 'Official guidance', value: 'guidance'},
          {title: 'Official calculator', value: 'calculator'},
          {title: 'FAQ', value: 'faq'},
          {title: 'Treaty / agreement', value: 'treaty'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'retrievedAt',
      title: 'Retrieved at',
      type: 'datetime',
      description: 'When this content was last read. Staleness is visible, not hidden.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'notes',
      title: 'Notes',
      type: 'text',
      rows: 3,
    }),
  ],
  preview: {
    select: {title: 'title', publisher: 'publisher', kind: 'kind'},
    prepare: ({title, publisher, kind}) => ({title, subtitle: `${publisher} · ${kind}`}),
  },
})