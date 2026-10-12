const form = document.getElementById('summary-form')
const message = document.getElementById('message')
const titleInput = document.getElementById('book-title')
const summaryInput = document.getElementById('summary')
const count = document.getElementById('count')
const submitBtn = document.getElementById('submit-btn')
const mine = document.getElementById('mine')

let session = null

summaryInput.addEventListener('input', () => {
  count.textContent = summaryInput.value.length
})

async function loadMine() {
  const { data, error } = await db
    .from('summaries')
    .select('id, book_title, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    showAlert(mine, 'Could not load your summaries.')
    return
  }
  if (data.length === 0) {
    showAlert(mine, 'You have not submitted anything yet.', 'secondary')
    return
  }

  mine.replaceChildren(
    ...data.map((row) =>
      el(
        'div',
        { class: 'card' },
        el(
          'div',
          { class: 'card-body d-flex justify-content-between align-items-center gap-3 py-2' },
          el(
            'div',
            { class: 'text-truncate' },
            el('div', { class: 'fw-semibold text-truncate' }, row.book_title),
            el('div', { class: 'text-muted small' }, formatDate(row.created_at))
          ),
          el(
            'button',
            {
              class: 'btn btn-outline-danger btn-sm flex-shrink-0',
              type: 'button',
              onclick: async () => {
                if (!confirm(`Delete your summary of “${row.book_title}”?`)) return
                const { error: delError } = await db.from('summaries').delete().eq('id', row.id)
                if (delError) showAlert(message, 'Could not delete that summary.')
                else loadMine()
              },
            },
            'Delete'
          )
        )
      )
    )
  )
}

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const book_title = titleInput.value.trim()
  const summary = summaryInput.value.trim()

  if (!book_title || !summary) {
    showAlert(message, 'Please enter both the book title and your summary.')
    return
  }

  submitBtn.disabled = true
  const { error } = await db
    .from('summaries')
    .insert({ user_id: session.user.id, book_title, summary })
  submitBtn.disabled = false

  if (error) {
    showAlert(message, 'Could not publish your summary. Please try again.')
    return
  }

  form.reset()
  count.textContent = '0'
  message.replaceChildren(
    el(
      'div',
      { class: 'alert alert-success mb-0' },
      'Published! ',
      el('a', { href: 'index.html', class: 'alert-link' }, 'See it on the home page')
    )
  )
  loadMine()
})

;(async () => {
  if (!db) {
    await renderNav('submit')
    message.replaceChildren(notConfiguredNotice())
    form.querySelectorAll('input, textarea, button').forEach((node) => (node.disabled = true))
    return
  }
  session = await renderNav('submit')
  if (!session) {
    window.location.href = 'login.html'
    return
  }
  loadMine()
})()
