// Page animations: circular loader between pages and scroll-linked zoom on cards.
// Loaded in <head> so the loader covers the page before it first paints.
// Does nothing for visitors who prefer reduced motion.
;(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const root = document.documentElement
  root.classList.add('anim')

  // ---- Page loader (circular progress ring) ------------------------------
  const LEAVE_MS = 450
  const MIN_SHOW_MS = 450

  const loader = document.createElement('div')
  loader.className = 'page-loader is-running'
  loader.setAttribute('aria-hidden', 'true')
  loader.innerHTML =
    '<div class="loader-ring">' +
    '<svg viewBox="0 0 80 80"><circle class="track" cx="40" cy="40" r="34"></circle>' +
    '<circle class="progress" cx="40" cy="40" r="34"></circle></svg>' +
    '<img src="favicon.svg" alt="" width="34" height="34">' +
    '</div>'
  root.append(loader)

  const startedAt = performance.now()
  let leaving = false

  function hideLoader() {
    leaving = false
    loader.style.animation = 'none' // take over from the CSS failsafe
    loader.classList.add('is-hidden')
  }

  window.addEventListener('load', () => {
    const wait = Math.max(0, MIN_SHOW_MS - (performance.now() - startedAt))
    setTimeout(hideLoader, wait)
  })

  // Back/forward cache restores the page with the loader still showing.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) hideLoader()
  })

  function leaveTo(href) {
    if (leaving) return
    leaving = true
    loader.style.animation = 'none'
    loader.classList.remove('is-hidden', 'is-running')
    void loader.offsetWidth // restart the ring animation
    loader.classList.add('is-running')
    setTimeout(() => {
      window.location.href = href
    }, LEAVE_MS)
  }

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const link = e.target.closest && e.target.closest('a[href]')
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return

    let url
    try {
      url = new URL(link.href, window.location.href)
    } catch {
      return
    }
    if (url.origin !== window.location.origin) return
    if (url.pathname === window.location.pathname && url.search === window.location.search) return

    e.preventDefault()
    leaveTo(url.href)
  })

  // ---- Scroll-linked zoom on cards ---------------------------------------
  // --p goes 0 -> 1 as a card scrolls into view and back to 0 as it leaves,
  // so cards zoom in on the way in and zoom out on the way out, in both
  // scroll directions.
  const SELECTOR = '.summary-card, main .card'
  const cards = new Set()

  function progressOf(rect, viewportHeight) {
    if (rect.height <= 0) return 1 // hidden or not laid out yet
    const visible = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
    // Tall cards never fit fully, so measure against what can fit on screen.
    const needed = Math.min(rect.height, viewportHeight * 0.6)
    return Math.max(0, Math.min(1, visible / needed))
  }

  function update() {
    ticking = false
    const vh = window.innerHeight || document.documentElement.clientHeight
    const updates = []
    // Read every position first, then write, to avoid layout thrashing.
    for (const node of cards) {
      if (!node.isConnected) {
        cards.delete(node)
        continue
      }
      updates.push([node, progressOf(node.getBoundingClientRect(), vh)])
    }
    for (const [node, p] of updates) node.style.setProperty('--p', p.toFixed(3))
  }

  let ticking = false
  function requestUpdate() {
    if (!ticking) {
      ticking = true
      requestAnimationFrame(update)
    }
  }

  function register(node) {
    if (cards.has(node)) return
    cards.add(node)
    node.classList.add('reveal')
    requestUpdate()
  }

  function scan(node) {
    if (node.nodeType !== 1) return
    if (node.matches(SELECTOR)) register(node)
    node.querySelectorAll(SELECTOR).forEach(register)
  }

  window.addEventListener('scroll', requestUpdate, { passive: true })
  window.addEventListener('resize', requestUpdate)

  document.addEventListener('DOMContentLoaded', () => {
    scan(document.body)
    update() // set the starting state before the first paint where possible
    // Cards are rendered later by the page scripts, so watch for new ones.
    new MutationObserver((mutations) => {
      for (const m of mutations) m.addedNodes.forEach(scan)
    }).observe(document.body, { childList: true, subtree: true })
  })
})()
