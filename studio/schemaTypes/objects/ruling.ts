import {defineField, defineType} from 'sanity'

/**
 * A human decision about a contested question, and the precedent it creates.
 *
 * Stored with its source, its date and its scope, because the whole point is
 * that the ruling outlives the conversation that produced it and is visible to
 * whoever makes the next call.
 */
export const ruling = defineType({
  name: 'ruling',
  title: 'Ruling',
  type: 'object',
  fields: [
    defineField({
      name: 'outcome',
      title: 'Outcome',
      type: 'string',
      options: {
        list: [
          {title: 'The day counts', value: 'counts'},
          {title: 'The day does not count', value: 'does_not_count'},
          {title: 'Unresolved — refuse to classify', value: 'unresolved'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'rationale',
      title: 'Rationale',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'decidedBy',
      title: 'Decided by',
      type: 'string',
      description: 'Who took responsibility for this call.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'decidedAt',
      title: 'Decided at',
      type: 'datetime',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'scope',
      title: 'Scope',
      type: 'string',
      options: {
        list: [
          {title: 'Only this itinerary', value: 'itinerary'},
          {title: 'This presence kind, going forward', value: 'presence_kind'},
          {title: 'Everywhere, going forward', value: 'global'},
        ],
        layout: 'radio',
      },
      initialValue: 'presence_kind',
      description:
        'How far the ruling travels. This is the mechanism by which one person\u2019s judgement becomes reusable.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'supersedes',
      title: 'Supersedes',
      type: 'reference',
      to: [{type: 'precedent'}],
      description: 'An earlier precedent this ruling replaces.',
    }),
  ],
  preview: {
    select: {outcome: 'outcome', decidedBy: 'decidedBy', scope: 'scope'},
    prepare: ({outcome, decidedBy, scope}) => ({
      title: outcome ?? 'Ruling',
      subtitle: `${decidedBy ?? 'unattributed'} · scope: ${scope ?? '?'}`,
    }),
  },
})