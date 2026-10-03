import {defineField, defineType} from 'sanity'

/**
 * A contested question about how a day should be charged.
 *
 * Raised automatically when a day's classification depends on a presence rule
 * the dataset marks as disputed, and resolvable exactly once. The status field
 * mirrors the workflow stages so a document and its workflow instance never
 * disagree about what is happening.
 */
export const dispute = defineType({
  name: 'dispute',
  title: 'Dispute',
  type: 'document',
  fields: [
    defineField({
      name: 'question',
      title: 'Question',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'subjectKind',
      title: 'Subject',
      type: 'string',
      options: {
        list: [
          {title: 'Presence kind', value: 'presence_kind'},
          {title: 'Territory', value: 'territory'},
          {title: 'Allowance', value: 'allowance'},
          {title: 'Nationality class', value: 'nationality_class'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'presenceRule',
      title: 'Presence rule',
      type: 'reference',
      to: [{type: 'presenceRule'}],
      hidden: ({parent}) => parent?.subjectKind !== 'presence_kind',
    }),
    defineField({
      name: 'territory',
      title: 'Territory',
      type: 'reference',
      to: [{type: 'territory'}],
      hidden: ({parent}) => parent?.subjectKind !== 'territory',
    }),
    defineField({
      name: 'itinerary',
      title: 'Raised against itinerary',
      type: 'reference',
      to: [{type: 'itinerary'}],
      description: 'The concrete trip that made this matter.',
    }),
    defineField({
      name: 'competingClaims',
      title: 'Competing claims',
      type: 'array',
      of: [{type: 'competingClaim'}],
      validation: (rule) => rule.required().min(2),
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          {title: 'Open', value: 'open'},
          {title: 'Under review', value: 'review'},
          {title: 'Adjudicated', value: 'adjudicated'},
          {title: 'Withdrawn', value: 'withdrawn'},
        ],
      },
      initialValue: 'open',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'ruling',
      title: 'Ruling',
      type: 'ruling',
      hidden: ({parent}) => parent?.status !== 'adjudicated',
    }),
    defineField({
      name: 'precedent',
      title: 'Precedent produced',
      type: 'reference',
      to: [{type: 'precedent'}],
      readOnly: true,
      description: 'Written when the dispute is adjudicated.',
    }),
  ],
  preview: {
    select: {question: 'question', status: 'status', subject: 'subjectKind'},
    prepare: ({question, status, subject}) => ({
      title: question,
      subtitle: `${status ?? 'open'} · ${subject ?? ''}`,
    }),
  },
})