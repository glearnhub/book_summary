// A comment thread shown under a summary. Only signed-in members can read or write.
// Returns { element, setCount }.
function createCommentSection(summaryId, session, isAdmin) {
  const wrapper = el('div', { class: 'mt-3' })

  if (!session) {
    wrapper.append(
      el('a', { class: 'btn btn-outline-secondary btn-sm', href: 'login.html' }, 'Sign in to comment')
    )
    return { element: wrapper, setCount() {} }
  }

  const toggle = el('button', { class: 'btn btn-outline-secondary btn-sm', type: 'button' }, 'Comments')
  const list = el('div', { class: 'vstack gap-3 mb-3' })
  const formMessage = el('div', { class: 'mb-2' })
  const input = el('textarea', {
    class: 'form-control',
    rows: '2',
    maxlength: '1000',
    placeholder: 'Write a comment…',
    'aria-label': 'Write a comment',
  })
  const postBtn = el('button', { class: 'btn btn-primary btn-sm mt-2', type: 'submit' }, 'Post comment')
  const form = el('form', { novalidate: '' }, formMessage, input, postBtn)
  const panel = el('div', { class: 'comment-panel d-none mt-3' }, list, form)
  wrapper.append(toggle, panel)

  let loaded = false

  function setCount(n) {
    toggle.textContent = `Comments (${n})`
  }

  function commentItem(c) {
    const name = c.profiles?.display_name || 'Unknown member'
    const header = el(
      'div',
      { class: 'd-flex justify-content-between align-items-start gap-2' },
      el('div', { class: 'small text-muted' }, `${name} · ${formatDate(c.created_at)}`)
    )

    if (c.user_id === session.user.id || isAdmin) {
      header.append(
        el(
          'button',
          {
            class: 'btn btn-link btn-sm text-danger p-0',
            type: 'button',
            onclick: async () => {
              if (!confirm('Delete this comment?')) return
              const { error } = await db.from('comments').delete().eq('id', c.id)
              if (error) showAlert(formMessage, 'Could not delete that comment.')
              else loadThread()
            },
          },
          'Delete'
        )
      )
    }

    return el('div', { class: 'comment' }, header, el('p', { class: 'summary-text mb-0' }, c.body))
  }

  async function loadThread() {
    const { data, error } = await db
      .from('comments')
      .select('id, body, created_at, user_id, profiles(display_name)')
      .eq('summary_id', summaryId)
      .order('created_at', { ascending: true })

    if (error) {
      showAlert(list, 'Comments could not be loaded right now.', 'warning')
      return
    }

    loaded = true
    setCount(data.length)
    if (data.length === 0) {
      list.replaceChildren(el('div', { class: 'small text-muted' }, 'No comments yet. Start the conversation.'))
    } else {
      list.replaceChildren(...data.map(commentItem))
    }
  }

  toggle.addEventListener('click', () => {
    const opening = panel.classList.contains('d-none')
    panel.classList.toggle('d-none', !opening)
    if (opening && !loaded) loadThread()
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const body = input.value.trim()
    if (!body) return

    postBtn.disabled = true
    const { error } = await db
      .from('comments')
      .insert({ summary_id: summaryId, user_id: session.user.id, body })
    postBtn.disabled = false

    if (error) {
      showAlert(formMessage, 'Could not post your comment. Please try again.')
      return
    }

    input.value = ''
    formMessage.replaceChildren()
    loadThread()
  })

  return { element: wrapper, setCount }
}
