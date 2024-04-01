import * as esbuild from 'esbuild'

let ctx = await esbuild.context({
  entryPoints: ['src/app.jsx'],
  bundle: true,
  outfile: 'www/dist/bundle.js',
})

await ctx.watch()
let { host, port } = await ctx.serve({
  servedir: 'www',
})
console.log('http://' + host + ':' + port)
