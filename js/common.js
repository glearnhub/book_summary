const isConfigured =
  /^https:\/\/.+\.supabase\.co/.test(window.SUPABASE_URL || '') &&
  !!window.SUPABASE_ANON_KEY &&
  window.SUPABASE_ANON_KEY !== 'YOUR-ANON-KEY'

const db = isConfigured
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
  : null

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value)
    else node.setAttribute(key, value)
  }
  for (const child of children) {
    node.append(child instanceof Node ? child : document.createTextNode(child))
  }
  return node
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Date-only values (YYYY-MM-DD) parsed as local time so they never shift a day.
function formatDay(day) {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

async function fetchRole(userId) {
  const { data } = await db.from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role || 'member'
}

function showAlert(container, message, type = 'danger') {
  container.replaceChildren(
    el('div', { class: `alert alert-${type} mb-0`, role: 'alert' }, message)
  )
}

async function getSession() {
  if (!db) return null
  const { data } = await db.auth.getSession()
  return data.session
}

function displayNameOf(session) {
  const meta = session.user.user_metadata || {}
  return meta.display_name || session.user.email.split('@')[0]
}

async function renderNav(active) {
  const session = await getSession()
  if (session) session.role = await fetchRole(session.user.id)

  const links = [{ href: 'index.html', label: 'Summaries', key: 'home' }]
  if (session) links.push({ href: 'books.html', label: 'Books', key: 'books' })
  if (session) links.push({ href: 'submit.html', label: 'Submit a summary', key: 'submit' })
  if (session?.role === 'superadmin') links.push({ href: 'admin.html', label: 'Admin', key: 'admin' })

  const list = el('ul', { class: 'navbar-nav ms-auto align-items-lg-center gap-lg-2' })
  for (const link of links) {
    list.append(
      el(
        'li',
        { class: 'nav-item' },
        el(
          'a',
          { class: `nav-link${active === link.key ? ' active' : ''}`, href: link.href },
          link.label
        )
      )
    )
  }

  if (session) {
    list.append(
      el('li', { class: 'nav-item' }, el('span', { class: 'navbar-text me-lg-2' }, displayNameOf(session)))
    )
    list.append(
      el(
        'li',
        { class: 'nav-item' },
        el(
          'button',
          {
            class: 'btn btn-outline-light btn-sm',
            type: 'button',
            onclick: async () => {
              await db.auth.signOut()
              window.location.href = 'index.html'
            },
          },
          'Sign out'
        )
      )
    )
  } else {
    list.append(
      el(
        'li',
        { class: 'nav-item' },
        el('a', { class: 'btn btn-light btn-sm', href: 'login.html' }, 'Sign in / Sign up')
      )
    )
  }

  const nav = el(
    'nav',
    { class: 'navbar navbar-expand-lg navbar-dark site-nav' },
    el(
      'div',
      { class: 'container' },
      el('a', { class: 'navbar-brand fw-semibold', href: 'index.html' }, 'Book Circle'),
      el(
        'button',
        {
          class: 'navbar-toggler',
          type: 'button',
          'data-bs-toggle': 'collapse',
          'data-bs-target': '#navMenu',
          'aria-controls': 'navMenu',
          'aria-expanded': 'false',
          'aria-label': 'Toggle navigation',
        },
        el('span', { class: 'navbar-toggler-icon' })
      ),
      el('div', { class: 'collapse navbar-collapse', id: 'navMenu' }, list)
    )
  )

  document.getElementById('site-nav').replaceChildren(nav)
  return session
}

function renderFooter() {
  const footer = el(
    'footer',
    { class: 'site-footer text-center small py-4' },
    el(
      'div',
      { class: 'container' },
      `© ${new Date().getFullYear()} Book Circle. All rights reserved.`,
      el('br'),
      'Design by Gideon Kiplangat'
    )
  )
  document.body.append(footer)
}

renderFooter()

function notConfiguredNotice() {
  return el(
    'div',
    { class: 'alert alert-warning' },
    el('strong', {}, 'Supabase is not connected yet. '),
    'Open js/config.js and paste your project URL and anon key (see README.md).'
  )
}
