const message = document.getElementById('message')
const panel = document.getElementById('panel')
const unassignedList = document.getElementById('unassigned')
const assignedList = document.getElementById('assigned')

function bookCard(book, ...extra) {
  return el(
    'div',
    { class: 'card' },
    el(
      'div',
      { class: 'card-body py-3' },
      el('div', { class: 'fw-semibold' }, book.title),
      el('div', { class: 'text-muted small' }, book.author || 'Unknown author'),
      ...extra
    )
  )
}

function assigneeLine(assignment, myId) {
  const name = assignment.profiles?.display_name || 'Unknown member'
  const mine = assignment.user_id === myId
  const due = assignment.due_date ? ` · due ${formatDay(assignment.due_date)}` : ''
  return el(
    'div',
    { class: 'small mt-2' },
    mine ? el('span', { class: 'badge text-bg-primary me-2' }, 'You') : '',
    `${mine ? 'Assigned to you' : `Assigned to ${name}`}${due}`
  )
}

async function load(session) {
  const { data, error } = await db
    .from('books')
    .select('id, title, author, assignments(user_id, due_date, profiles(display_name))')
    .order('title')

  if (error) {
    showAlert(message, 'Could not load the books. Please try again.')
    return
  }

  const unassigned = data.filter((b) => b.assignments.length === 0)
  const assigned = data.filter((b) => b.assignments.length > 0)

  document.getElementById('unassigned-count').textContent = unassigned.length
  document.getElementById('assigned-count').textContent = assigned.length

  if (unassigned.length === 0) {
    showAlert(unassignedList, 'No unassigned books right now.', 'secondary')
  } else {
    unassignedList.replaceChildren(...unassigned.map((b) => bookCard(b)))
  }

  if (assigned.length === 0) {
    showAlert(assignedList, 'No books have been assigned yet.', 'secondary')
  } else {
    assignedList.replaceChildren(
      ...assigned.map((b) =>
        bookCard(b, ...b.assignments.map((a) => assigneeLine(a, session.user.id)))
      )
    )
  }

  panel.classList.remove('d-none')
}

;(async () => {
  if (!db) {
    await renderNav('books')
    message.replaceChildren(notConfiguredNotice())
    return
  }
  const session = await renderNav('books')
  if (!session) {
    window.location.href = 'login.html'
    return
  }
  load(session)
})()
