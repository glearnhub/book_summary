const form = document.getElementById('summary-form')
const message = document.getElementById('message')
const titleInput = document.getElementById('book-title')
const summaryInput = document.getElementById('summary')
const count = document.getElementById('count')
const submitBtn = document.getElementById('submit-btn')
const mine = document.getElementById('mine')
const assigned = document.getElementById('assigned')
const bookOptions = document.getElementById('book-options')

const formTitle = document.getElementById('form-title')
const cancelBtn = document.getElementById('cancel-btn')

let session = null
let editingId = null

function enterEditMode(row) {
  editingId = row.id
  titleInput.value = row.book_title
  summaryInput.value = row.summary
  count.textContent = row.summary.length
  formTitle.textContent = 'Edit your summary'
  submitBtn.textContent = 'Save changes'
  cancelBtn.classList.remove('d-none')
  message.replaceChildren()
  form.scrollIntoView({ behavior: 'smooth', block: 'start' })
  summaryInput.focus()
}

function leaveEditMode() {
  editingId = null
  form.reset()
  count.textContent = '0'
  formTitle.textContent = 'Submit a book summary'
  submitBtn.textContent = 'Publish summary'
  cancelBtn.classList.add('d-none')
}

cancelBtn.addEventListener('click', () => {
  leaveEditMode()
  message.replaceChildren()
})

async function loadAssigned() {
  const { data, error } = await db
    .from('assignments')
    .select('id, due_date, books(title, author)')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    showAlert(assigned, 'Could not load your assigned books.')
    return
  }
  if (data.length === 0) {
    showAlert(assigned, 'No books have been assigned to you yet.', 'secondary')
    return
  }

  assigned.replaceChildren(
    ...data.map((a) => {
      const title = a.books?.title || 'Removed book'
      const sub = [a.books?.author, a.due_date ? `due ${formatDay(a.due_date)}` : null]
        .filter(Boolean)
        .join(' · ')
      return el(
        'div',
        { class: 'card' },
        el(
          'div',
          { class: 'card-body d-flex justify-content-between align-items-center gap-3 py-2' },
          el(
            'div',
            { class: 'text-truncate' },
            el('div', { class: 'fw-semibold text-truncate' }, title),
            sub ? el('div', { class: 'text-muted small' }, sub) : ''
          ),
          el(
            'button',
            {
              class: 'btn btn-outline-primary btn-sm flex-shrink-0',
              type: 'button',
              onclick: () => {
                titleInput.value = title
                summaryInput.focus()
              },
            },
            'Write summary'
          )
        )
      )
    })
  )
}

async function loadCatalog() {
  const { data } = await db.from('books').select('title').order('title')
  bookOptions.replaceChildren(...(data || []).map((b) => el('option', { value: b.title })))
}

summaryInput.addEventListener('input', () => {
  count.textContent = summaryInput.value.length
})

async function loadMine() {
  const { data, error } = await db
    .from('summaries')
    .select('id, book_title, summary, created_at')
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
            'div',
            { class: 'd-flex gap-2 flex-shrink-0' },
            el(
              'button',
              {
                class: 'btn btn-outline-primary btn-sm',
                type: 'button',
                onclick: () => enterEditMode(row),
              },
              'Edit'
            ),
            el(
              'button',
              {
                class: 'btn btn-outline-danger btn-sm',
                type: 'button',
                onclick: async () => {
                  if (!confirm(`Delete your summary of “${row.book_title}”?`)) return
                  const { error: delError } = await db.from('summaries').delete().eq('id', row.id)
                  if (delError) {
                    showAlert(message, 'Could not delete that summary.')
                    return
                  }
                  if (editingId === row.id) leaveEditMode()
                  loadMine()
                },
              },
              'Delete'
            )
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

  const wasEditing = editingId !== null
  submitBtn.disabled = true
  let error
  if (wasEditing) {
    // Rely on row-level security for ownership; .select() lets us detect a no-op update.
    const result = await db
      .from('summaries')
      .update({ book_title, summary })
      .eq('id', editingId)
      .select('id')
    error = result.error || (result.data.length === 0 ? new Error('not updated') : null)
  } else {
    const result = await db
      .from('summaries')
      .insert({ user_id: session.user.id, book_title, summary })
    error = result.error
  }
  submitBtn.disabled = false

  if (error) {
    showAlert(
      message,
      wasEditing
        ? 'Could not save your changes. Please try again.'
        : 'Could not publish your summary. Please try again.'
    )
    return
  }

  leaveEditMode()
  message.replaceChildren(
    el(
      'div',
      { class: 'alert alert-success mb-0' },
      wasEditing ? 'Changes saved! ' : 'Published! ',
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
  loadAssigned()
  loadCatalog()
})()
