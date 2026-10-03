import {defineField, defineType} from 'sanity'

/**
 * A status that removes its holder from the rolling day counter.
 *
 * Holding a residence permit or a long-stay visa does not mean you may stay
 * forever on the same stamp — it means you are no longer counted against the
 * 90/180 allowance for the covered territories. That distinction is the single
 * most common source of confidently wrong answers in this domain.
 */
export const permitExemption = defineType({
  name: 'permitExemption',
  title: 'Permit exemption',
  type: 'document',
  fields: [
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: {
        list: [
          {title: 'Residence permit', value: 'residence_permit'},
          {title: 'Long-stay visa (type D)', value: 'long_stay_visa'},
          {title: 'Free movement (EU/EEA/Swiss citizen)', value: 'free_movement'},
          {title: 'Permanent residence', value: 'permanent_residence'},
          {title: 'Pending application', value: 'pending_application'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'exemptsFromAllowance',
      title: 'Exempt from the allowance?',
      type: 'boolean',
      description:
        'True when days covered by this status are not charged to the rolling counter. False for pending applications, which commonly do not exempt.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'scopeTerritories',
      title: 'Scope',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'territory'}]}],
      description:
        'Territories this exemption covers. Omit to cover the whole allowance area.',
    }),
    defineField({
      name: 'conditions',
      title: 'Conditions',
      type: 'text',
      rows: 3,
      description: 'What must hold for the exemption to apply.',
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
    select: {label: 'label', kind: 'kind', exempts: 'exemptsFromAllowance'},
    prepare: ({label, kind, exempts}) => ({
      title: label,
      subtitle: `${kind} · ${exempts ? 'exempt' : 'not exempt'}`,
    }),
  },
})