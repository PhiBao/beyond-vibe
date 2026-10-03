import type {StructureResolver} from 'sanity/structure'

/**
 * The desk is ordered the way a verdict is resolved, not alphabetically.
 *
 * An editor opening this Studio should read top to bottom as the argument the
 * engine makes: what are we standing on, what is the rule, where does it apply,
 * who is asking, what did they do, and what did we decide about the ambiguity.
 */
export const structure: StructureResolver = (S) =>
  S.list()
    .title('Ninety')
    .items([
      S.listItem()
        .title('The regime')
        .child(
          S.list()
            .title('The regime')
            .items([
              S.listItem().title('Allowances').schemaType('allowance').child(S.documentTypeList('allowance')),
              S.listItem()
                .title('Presence rules')
                .schemaType('presenceRule')
                .child(S.documentTypeList('presenceRule')),
              S.listItem()
                .title('Visa regimes')
                .schemaType('visaRegime')
                .child(S.documentTypeList('visaRegime')),
              S.listItem()
                .title('Permit exemptions')
                .schemaType('permitExemption')
                .child(S.documentTypeList('permitExemption')),
            ]),
        ),
      S.listItem()
        .title('Geography')
        .child(
          S.list()
            .title('Geography')
            .items([
              S.listItem().title('Territories').schemaType('territory').child(S.documentTypeList('territory')),
              S.listItem()
                .title('Nationality classes')
                .schemaType('nationalityClass')
                .child(S.documentTypeList('nationalityClass')),
            ]),
        ),
      S.listItem()
        .title('Adjudication')
        .child(
          S.list()
            .title('Adjudication')
            .items([
              S.divider(),
              S.documentTypeListItem('dispute')
                .title('Open disputes')
                .child(
                  S.documentList()
                    .title('Open disputes')
                    .schemaType('dispute')
                    .filter('_type == "dispute" && status != "adjudicated"'),
                ),
              S.documentTypeListItem('dispute')
                .title('Adjudicated')
                .child(
                  S.documentList()
                    .title('Adjudicated')
                    .schemaType('dispute')
                    .filter('_type == "dispute" && status == "adjudicated"'),
                ),
              S.divider(),
              S.documentTypeListItem('precedent').title('Precedent'),
            ]),
        ),
      S.listItem()
        .title('Travellers')
        .child(
          S.list()
            .title('Travellers')
            .items([
              S.documentTypeListItem('itinerary').title('Itineraries'),
              S.divider(),
              S.documentTypeListItem('trip').title('Trips'),
            ]),
        ),
      S.divider(),
      S.documentTypeListItem('source').title('Sources'),
    ])