import {defineField, defineType} from 'sanity'

/**
 * The durable output of an adjudication.
 *
 * Precedents are what the engine actually reads when classifying a day. Each one
 * is scoped, dated, attributed and superseded rather than overwritten, so the
 * chain of decisions stays auditable — the accumulation of human judgement is
 * the asset, not a side effect.
 */
export const precedent = defineType({
  name: 'precedent',
  title: 'Precedent',
  type: 'document',
  fields: [
    defineField({
      name: 'key',
      title: 'Key',
      type: 'string',
      description:
        'Stable lookup key, e.g. "airport_transit" or "presence:airport_transit". The engine reads these.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'subjectKind',
      title: 'Subject kind',
      type: 'string',
      options: {
        list: [
          {title: 'Presence kind', value: 'presence_kind'},
          {title: 'Territory', value: 'territory'},
          {title: 'Nationality class', value: 'nationality_class'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'presenceKind',
      title: 'Presence kind',
      type: 'string',
      hidden: ({parent}) => parent?.subjectKind !== 'presence_kind',
      options: {
        list: [
          {title: 'Cleared entry', value: 'cleared_entry'},
          {title: 'Airport transit, airside', value: 'airport_transit'},
          {title: 'Airport transit, landside', value: 'airport_transit_landside'},
          {title: 'Overnight arrival', value: 'overnight_arrival'},
          {title: 'Same-day visit', value: 'same_day'},
          {title: 'Long-stay / permitted presence', value: 'permitted'},
        ],
      },
    }),
    defineField({
      name: 'counted',
      title: 'Counts against the allowance?',
      type: 'boolean',
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
      name: 'dispute',
      title: 'From dispute',
      type: 'reference',
      to: [{type: 'dispute'}],
    }),
    defineField({
      name: 'window',
      title: 'Effective window',
      type: 'effectiveWindow',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'decidedBy',
      title: 'Decided by',
      type: 'string',
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
          {title: 'This presence kind, going forward', value: 'presence_kind'},
          {title: 'Everywhere, going forward', value: 'global'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          {title: 'Active', value: 'active'},
          {title: 'Superseded', value: 'superseded'},
        ],
        layout: 'radio',
      },
      initialValue: 'active',
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
    select: {label: 'label', counted: 'counted', status: 'status', by: 'decidedBy'},
    prepare: ({label, counted, status, by}) => ({
      title: `${label ?? 'Precedent'}`,
      subtitle: `${counted ? 'counts' : 'does not count'} · ${status ?? 'active'} · ${by ?? ''}`,
    }),
  },
})