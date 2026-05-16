import { defineConfig } from 'vite'

// Served as a GitHub Pages project site at
// https://binguosoft65.github.io/binguo-app/ — so assets must resolve
// under the "/binguo-app/" base path. When a custom domain is added
// (CEO spend decision), switch base back to "/".
export default defineConfig({
  base: '/binguo-app/',
})
