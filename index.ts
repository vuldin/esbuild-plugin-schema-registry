import type { OnLoadResult, Plugin, PluginBuild } from 'esbuild'

const pluginSchemaRegistry: Plugin = {
  name: 'schema-registry',
  setup(build: PluginBuild) {
    const https = require('https')
    const http = require('http')

    build.onResolve({ filter: /^https?:\/\// }, (args) => ({
      path: args.path,
      namespace: 'schema-registry',
    }))

    build.onLoad({ filter: /.*/, namespace: 'schema-registry' }, async (args) => {
      const contents = await new Promise((resolve, reject) => {
        function fetch(url: string) {
          const lib = url.startsWith('https') ? https : http
          const req = lib
            .get(
              url,
              (res: {
                statusCode: number
                headers: { location: string | URL }
                on: (arg0: string, arg1: (chunk: any) => void) => void
              }) => {
                if ([301, 302, 307].includes(res.statusCode)) {
                  fetch(new URL(res.headers.location, url).toString())
                  req.destroy()
                } else if (res.statusCode === 200) {
                  let chunks: any[] = []
                  res.on('data', (chunk) => chunks.push(chunk))
                  res.on('end', () => {
                    const buffer = Buffer.concat(chunks)
                    const text = buffer.toString()
                    const json = JSON.parse(text)
                    const escapedText = <string>json.schema
                    resolve(escapedText)
                  })
                } else {
                  reject(new Error(`GET ${url} failed: status ${res.statusCode}`))
                }
              }
            )
            .on('error', reject)
        }
        fetch(args.path)
      })
      return <OnLoadResult>{ contents, loader: 'text' }
    })
  },
}

export default pluginSchemaRegistry
