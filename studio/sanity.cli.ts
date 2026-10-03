import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'jvgi63fz',
    dataset: 'production',
  },
  deployment: {
    /**
     * The hosted Studio, at https://beyond-vibe.sanity.studio
     *
     * Deploying this is not a convenience. Sanity Context refuses to serve a
     * dataset whose Studio has never been deployed, so until this is live the
     * Context MCP endpoint answers with "Only datasets with deployed Studio
     * applications are supported" no matter how the request is authorised.
     */
    appId: 'nlfj4dwp39pputhldklk360a',
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/studio/latest-version-of-sanity#k47faf43faf56
     */
    autoUpdates: true,
  },
  typegen: {
    enabled: true,
    path: '../web/src/**/*.{ts,tsx,js,jsx}',
    schema: 'schema.json',
    generates: '../web/sanity.types.ts',
    overloadClientMethods: true,
  },
})