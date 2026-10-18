const PAGE_SIZE = 10
const PREVIEW_CHARS = 350

const feed = document.getElementById('feed')
const status = document.getElementById('status')
const loadMore = document.getElementById('load-more')
const searchInput = document.getElementById('search')

let query = ''
let page = 0
let requestId = 0
let isAdmin = false
let currentSession = null

// summary id -> its comment section / reaction bar, so counts can be filled in
// after the feed has loaded
const commentSections = new Map()
const reactionBars = new Map()

async function loadReactions(rows) {
  if (!currentSession || rows.length === 0) return
  const ids = rows.map((r) => r.id)
  const { data, error } = await db
    .from('reactions')
    .select('summary_id, user_id, kind')
    .in('summary_id', ids)
  if (error) return // reactions not set up yet: the bars simply stay hidden

  const counts = new Map(ids.map((id) => [id, {}]))
  const mine = new Map(ids.map((id) => [id, new Set()]))
  for (const r of data) {
    const c = counts.get(r.summary_id)
    if (!c) continue
    c[r.kind] = (c[r.kind] || 0) + 1
    if (r.user_id === currentSession.user.id) mine.get(r.summary_id).add(r.kind)
  }
  for (const id of ids) reactionBars.get(id)?.setData(counts.get(id), mine.get(id))
}

async function loadCommentCounts(rows) {
  if (!currentSession || rows.length === 0) return
  const ids = rows.map((r) => r.id)
  const { data, error } = await db.from('comments').select('summary_id').in('summary_id', ids)
  if (error) return // comments not set up yet: buttons simply keep the plain "Comments" label

  const counts = new Map(ids.map((id) => [id, 0]))
  for (const c of data) counts.set(c.summary_id, (counts.get(c.summary_id) || 0) + 1)
  for (const [id, n] of counts) commentSections.get(id)?.setCount(n)
}

function summaryCard(row) {
  const author = row.profiles?.display_name || 'Unknown member'
  const isLong = row.summary.length > PREVIEW_CHARS
  const body = el('p', { class: 'summary-text mb-0' })
  renderFormatted(body, isLong ? formattedPreview(row.summary, PREVIEW_CHARS) : row.summary)

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
          renderFormatted(body, expanded ? row.summary : formattedPreview(row.summary, PREVIEW_CHARS))
          toggle.textContent = expanded ? 'Show less' : 'Read more'
        },
      },
      'Read more'
    )
    card.querySelector('.card-body').append(toggle)
  }

  const reactions = createReactionBar(row.id, currentSession)
  reactionBars.set(row.id, reactions)
  const thread = createCommentSection(row.id, currentSession, isAdmin)
  commentSections.set(row.id, thread)
  card.querySelector('.card-body').append(reactions.element, thread.element)

  if (isAdmin) {
    const remove = el(
      'button',
      {
        class: 'btn btn-outline-danger btn-sm',
        type: 'button',
        onclick: async () => {
          if (!confirm(`Delete “${row.book_title}” by ${author}? This cannot be undone.`)) return
          remove.disabled = true
          const { error } = await db.from('summaries').delete().eq('id', row.id)
          if (error) {
            remove.disabled = false
            showAlert(status, 'Could not delete that summary.')
            return
          }
          card.remove()
          if (feed.children.length === 0) load(true)
        },
      },
      'Delete (admin)'
    )
    card.querySelector('.card-body').append(el('div', { class: 'mt-3' }, remove))
  }

  return card
}

let searchFilter = ''

// Characters that are special inside a PostgREST filter value are swapped for "_",
// which matches any single character, so a search can never break the query.
function safeTerm(text) {
  return text.replace(/[\\%*"(),]/g, '_')
}

// Matches summaries whose book title contains the text, OR that were written by a
// member whose name contains the text.
async function buildSearchFilter(term) {
  const safe = safeTerm(term)
  const clauses = [`book_title.ilike."*${safe}*"`]

  const { data } = await db
    .from('profiles')
    .select('id')
    .ilike('display_name', `%${safe}%`)
    .limit(100)
  const ids = (data || []).map((p) => p.id)
  if (ids.length > 0) clauses.push(`user_id.in.(${ids.join(',')})`)

  return clauses.join(',')
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

  // Work out which members match the search once per search, not on every "Load more".
  if (reset) {
    searchFilter = query ? await buildSearchFilter(query) : ''
    if (thisRequest !== requestId) return
  }

  let request = db
    .from('summaries')
    // The explicit relationship name matters: comments and reactions also link
    // summaries to members, so a bare "profiles" would be ambiguous.
    .select('id, book_title, summary, created_at, profiles!summaries_user_id_fkey(display_name)')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (searchFilter) request = request.or(searchFilter)

  const { data, error } = await request
  if (thisRequest !== requestId) return // a newer search superseded this one

  if (error) {
    showAlert(status, 'Could not load summaries. Please try again.')
    loadMore.classList.add('d-none')
    return
  }

  status.replaceChildren()
  for (const row of data) feed.append(summaryCard(row))
  loadCommentCounts(data)
  loadReactions(data)

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

;(async () => {
  const session = await renderNav('home')
  currentSession = session
  isAdmin = session?.role === 'superadmin'
  load(true)
})()
