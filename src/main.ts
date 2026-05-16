import { initErrorReporter } from './error-reporter'

initErrorReporter()

const app = document.querySelector<HTMLDivElement>('#app')

if (app) {
  const main = document.createElement('main')
  main.setAttribute(
    'style',
    'font-family: system-ui, -apple-system, sans-serif; max-width: 42rem; margin: 4rem auto; padding: 0 1.25rem; line-height: 1.6;',
  )

  const h1 = document.createElement('h1')
  h1.style.marginBottom = '0.25rem'
  h1.textContent = '缤果软件 · binguo-app'

  const tagline = document.createElement('p')
  tagline.setAttribute('style', 'color:#555; margin-top:0;')
  tagline.textContent = '一个人 + 一群智能体 · 把软件能力变成可持续现金流'

  const status = document.createElement('p')
  status.textContent = '✅ Hello, world — dev foundation pipeline is live.'

  const note = document.createElement('p')
  note.setAttribute('style', 'color:#666; font-size:0.9rem;')
  note.textContent =
    'Built with Vite + TypeScript · deployed via GitHub Actions → GitHub Pages. ' +
    'This is the company app foundation; product MVPs start from here.'

  main.append(h1, tagline, status, note)
  app.replaceChildren(main)
}
