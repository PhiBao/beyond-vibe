import {defineField, defineType} from 'sanity'

/** One side of a genuine disagreement between authorities. */
export const competingClaim = defineType({
  name: 'competingClaim',
  title: 'Competing claim',
  type: 'object',
  fields: [
    defineField({
      name: 'claim',
      title: 'Claim',
      type: 'string',
      description: 'What this source says, in one sentence.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'outcome',
      title: 'If accepted, the day counts?',
      type: 'boolean',
      validation: (rule) => rule.required(),
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
    select: {claim: 'claim', outcome: 'outcome'},
    prepare: ({claim, outcome}) => ({
      title: claim,
      subtitle: outcome ? '→ day counts' : '→ day does not count',
    }),
  },
})