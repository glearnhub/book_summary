const PAGE_SIZE = 10
const PREVIEW_CHARS = 350

const feed = document.getElementById('feed')
const status = document.getElementById('status')
const loadMore = document.getElementById('load-more')
const searchInput = document.getElementById('search')

let query = ''
let page = 0
let requestId = 0

function summaryCard(row) {
  const author = row.profiles?.display_name || 'Unknown member'
  const isLong = row.summary.length > PREVIEW_CHARS
  const body = el(
    'p',
    { class: 'summary-text mb-0' },
    isLong ? row.summary.slice(0, PREVIEW_CHARS).trimEnd() + '…' : row.summary
  )

  const card = el(
    'article',
    { class: 'card summary-card shadow-sm' },
    el(
      'div',
      { class: 'card-body' },
      el('h2', { class: 'h5 card-title mb-1' }, row.book_title),
      el('p', { class: 'text-muted small mb-3' }, `by ${author} · ${formatDate(row.created_at)}`),
      body
    )
  )

  if (isLong) {
    let expanded = false
    const toggle = el(
      'button',
      {
        class: 'btn btn-link p-0 mt-2',
        type: 'button',
        onclick: () => {
          expanded = !expanded
          body.textContent = expanded
            ? row.summary
            : row.summary.slice(0, PREVIEW_CHARS).trimEnd() + '…'
          toggle.textContent = expanded ? 'Show less' : 'Read more'
        },
      },
      'Read more'
    )
    card.querySelector('.card-body').append(toggle)
  }

  return card
}

async function load(reset) {
  if (!db) {
    status.replaceChildren(notConfiguredNotice())
    return
  }

  if (reset) {
    page = 0
    feed.replaceChildren()
  }

  const thisRequest = ++requestId
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let request = db
    .from('summaries')
    .select('id, book_title, summary, created_at, profiles(display_name)')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (query) {
    const escaped = query.replace(/[\\%_]/g, '\\$&')
    request = request.ilike('book_title', `%${escaped}%`)
  }

  const { data, error } = await request
  if (thisRequest !== requestId) return // a newer search superseded this one

  if (error) {
    showAlert(status, 'Could not load summaries. Please try again.')
    loadMore.classList.add('d-none')
    return
  }

  status.replaceChildren()
  for (const row of data) feed.append(summaryCard(row))

  if (page === 0 && data.length === 0) {
    const message = query
      ? `No summaries found for “${query}”.`
      : 'No summaries yet. Be the first to submit one!'
    showAlert(status, message, 'secondary')
  }

  loadMore.classList.toggle('d-none', data.length < PAGE_SIZE)
}

let debounce
searchInput.addEventListener('input', () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    query = searchInput.value.trim()
    load(true)
  }, 300)
})

document.getElementById('search-form').addEventListener('submit', (e) => {
  e.preventDefault()
  clearTimeout(debounce)
  query = searchInput.value.trim()
  load(true)
})

loadMore.addEventListener('click', () => {
  page += 1
  load(false)
})

renderNav('home')
load(true)
