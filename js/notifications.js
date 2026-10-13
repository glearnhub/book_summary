const message = document.getElementById('message')
const list = document.getElementById('list')

function notificationItem(n) {
  const actor = n.profiles?.display_name || 'A member'
  const title = n.summaries?.book_title || 'your book summary'
  const unread = !n.read_at

  const text = el(
    'div',
    {},
    el('strong', {}, actor),
    ' commented on your book summary ',
    el('span', { class: 'fw-semibold' }, `“${title}”`)
  )

  const item = el(
    'a',
    {
      class: `notification card text-decoration-none text-reset${unread ? ' notification-unread' : ''}`,
      // The home page can open straight to a search, so this lands on the summary.
      href: `index.html?q=${encodeURIComponent(title)}`,
    },
    el(
      'div',
      { class: 'card-body py-3 d-flex justify-content-between align-items-start gap-3' },
      el(
        'div',
        {},
        text,
        el('div', { class: 'small text-muted mt-1' }, formatDate(n.created_at))
      ),
      unread ? el('span', { class: 'badge text-bg-primary flex-shrink-0' }, 'New') : ''
    )
  )
  return item
}

async function load(session) {
  const { data, error } = await db
    .from('notifications')
    .select(
      'id, read_at, created_at, ' +
        'summaries!notifications_summary_id_fkey(book_title), ' +
        'profiles!notifications_actor_id_fkey(display_name)'
    )
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    showAlert(message, 'Notifications could not be loaded right now.', 'warning')
    return
  }
  if (data.length === 0) {
    showAlert(list, 'No notifications yet. You will see a message here when someone comments on your summary.', 'secondary')
    return
  }

  list.replaceChildren(...data.map(notificationItem))

  // Opening this page counts as reading them. They stay marked "New" in this view.
  if (data.some((n) => !n.read_at)) {
    const { error: markError } = await db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
    if (!markError) document.querySelectorAll('.nav-badge').forEach((b) => b.remove())
  }
}

;(async () => {
  if (!db) {
    await renderNav('notifications')
    message.replaceChildren(notConfiguredNotice())
    return
  }
  const session = await renderNav('notifications')
  if (!session) {
    window.location.href = 'login.html'
    return
  }
  load(session)
})()
