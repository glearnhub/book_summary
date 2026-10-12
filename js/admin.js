const message = document.getElementById('message')
const panel = document.getElementById('panel')
const bookForm = document.getElementById('book-form')
const assignForm = document.getElementById('assign-form')
const bookSelect = document.getElementById('assign-book')
const memberSelect = document.getElementById('assign-member')
const booksList = document.getElementById('books')
const assignmentsList = document.getElementById('assignments')

function row(...children) {
  return el(
    'div',
    { class: 'card' },
    el(
      'div',
      { class: 'card-body d-flex justify-content-between align-items-center gap-3 py-2' },
      ...children
    )
  )
}

function deleteButton(onclick, label = 'Remove') {
  return el(
    'button',
    { class: 'btn btn-outline-danger btn-sm flex-shrink-0', type: 'button', onclick },
    label
  )
}

async function loadBooks() {
  const { data, error } = await db
    .from('books')
    .select('id, title, author, assignments(id)')
    .order('created_at', { ascending: false })

  if (error) {
    showAlert(booksList, 'Could not load books.')
    return
  }

  bookSelect.replaceChildren(
    ...data.map((b) => el('option', { value: b.id }, b.author ? `${b.title} — ${b.author}` : b.title))
  )

  // Only books nobody has been assigned yet are listed here; assigned ones
  // move to the "Assigned books" list below.
  const unassigned = data.filter((b) => b.assignments.length === 0)

  if (unassigned.length === 0) {
    showAlert(
      booksList,
      data.length === 0
        ? 'No books yet. Add the first one.'
        : 'Every book has been assigned.',
      'secondary'
    )
    return
  }

  booksList.replaceChildren(
    ...unassigned.map((b) =>
      row(
        el(
          'div',
          { class: 'text-truncate' },
          el('div', { class: 'fw-semibold text-truncate' }, b.title),
          el('div', { class: 'text-muted small' }, b.author || 'Unknown author')
        ),
        deleteButton(async () => {
          if (!confirm(`Remove “${b.title}”? Its assignments will be removed too.`)) return
          const { error: delError } = await db.from('books').delete().eq('id', b.id)
          if (delError) showAlert(message, 'Could not remove that book.')
          else {
            await loadBooks()
            await loadAssignments()
          }
        })
      )
    )
  )
}

async function loadMembers() {
  const { data, error } = await db
    .from('profiles')
    .select('id, display_name')
    .order('display_name')

  if (error) {
    showAlert(message, 'Could not load members.')
    return
  }
  memberSelect.replaceChildren(
    ...data.map((m) => el('option', { value: m.id }, m.display_name))
  )
}

async function loadAssignments() {
  const { data, error } = await db
    .from('assignments')
    .select('id, due_date, books(title, author), profiles(display_name)')
    .order('created_at', { ascending: false })

  if (error) {
    showAlert(assignmentsList, 'Could not load assignments.')
    return
  }
  if (data.length === 0) {
    showAlert(assignmentsList, 'Nothing assigned yet.', 'secondary')
    return
  }

  assignmentsList.replaceChildren(
    ...data.map((a) =>
      row(
        el(
          'div',
          { class: 'text-truncate' },
          el('div', { class: 'fw-semibold text-truncate' }, a.books?.title || 'Removed book'),
          el(
            'div',
            { class: 'text-muted small' },
            `${a.profiles?.display_name || 'Unknown member'}` +
              (a.due_date ? ` · due ${formatDay(a.due_date)}` : '')
          )
        ),
        deleteButton(async () => {
          const { error: delError } = await db.from('assignments').delete().eq('id', a.id)
          if (delError) showAlert(message, 'Could not remove that assignment.')
          else {
            // The book returns to "Unassigned" if this was its only assignment.
            await Promise.all([loadAssignments(), loadBooks()])
          }
        }, 'Unassign')
      )
    )
  )
}

async function loadMemberTable() {
  const container = document.getElementById('members')
  const { data, error } = await db.rpc('admin_list_members')

  if (error) {
    showAlert(
      container,
      'Could not load the member list. If this is new, run supabase/006_admin_members.sql in the Supabase SQL Editor.',
      'warning'
    )
    return
  }

  document.getElementById('member-count').textContent = data.length

  const header = el(
    'tr',
    {},
    ...['Name', 'Email', 'Joined', 'Last sign-in', 'Summaries'].map((h) => el('th', {}, h))
  )

  const rows = data.map((m) => {
    const nameCell = el('td', {}, m.display_name)
    if (m.role === 'superadmin') {
      nameCell.append(' ', el('span', { class: 'badge text-bg-primary' }, 'Admin'))
    }
    const emailCell = el('td', {}, m.email || '—')
    if (!m.email_confirmed) {
      emailCell.append(' ', el('span', { class: 'badge text-bg-warning' }, 'Unconfirmed'))
    }
    return el(
      'tr',
      {},
      nameCell,
      emailCell,
      el('td', { class: 'text-nowrap' }, formatDate(m.joined_at)),
      el('td', { class: 'text-nowrap' }, m.last_sign_in_at ? formatDate(m.last_sign_in_at) : 'Never'),
      el('td', {}, String(m.summaries))
    )
  })

  container.replaceChildren(
    el(
      'div',
      { class: 'table-responsive card shadow-sm' },
      el(
        'table',
        { class: 'table table-hover align-middle mb-0' },
        el('thead', {}, header),
        el('tbody', {}, ...rows)
      )
    )
  )
}

bookForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const title = document.getElementById('book-title').value.trim()
  const author = document.getElementById('book-author').value.trim()
  if (!title) {
    showAlert(message, 'Please enter the book title.')
    return
  }

  const { error } = await db.from('books').insert({ title, author: author || null })
  if (error) {
    showAlert(message, 'Could not add the book.')
    return
  }
  bookForm.reset()
  message.replaceChildren()
  loadBooks()
})

assignForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const book_id = bookSelect.value
  const user_id = memberSelect.value
  const due_date = document.getElementById('assign-due').value || null

  if (!book_id || !user_id) {
    showAlert(message, 'Pick a book and a member first.')
    return
  }

  const { error } = await db.from('assignments').insert({ book_id, user_id, due_date })
  if (error) {
    showAlert(
      message,
      error.code === '23505'
        ? 'That member already has this book assigned.'
        : 'Could not assign the book.'
    )
    return
  }
  assignForm.reset()
  message.replaceChildren()
  // The book moves from "Unassigned books" to "Assigned books".
  await Promise.all([loadAssignments(), loadBooks()])
})

;(async () => {
  if (!db) {
    await renderNav('admin')
    message.replaceChildren(notConfiguredNotice())
    return
  }

  const session = await renderNav('admin')
  if (!session) {
    window.location.href = 'login.html'
    return
  }
  if (session.role !== 'superadmin') {
    showAlert(message, 'This page is only for the site administrator.', 'warning')
    return
  }

  panel.classList.remove('d-none')
  await Promise.all([loadBooks(), loadMembers()])
  loadAssignments()
  loadMemberTable()
})()
