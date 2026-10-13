// One-tap reactions under a summary. Signed-in members only.
// A member has at most ONE reaction per summary: tapping another emoji replaces
// it, tapping the same one again removes it.
// The bar stays hidden until its data arrives, so it never shows broken
// buttons if the reactions table has not been created yet.
const REACTIONS = [
  { kind: 'like', emoji: '👍', label: 'Like' },
  { kind: 'love', emoji: '❤️', label: 'Love' },
  { kind: 'clap', emoji: '👏', label: 'Well done' },
  { kind: 'insight', emoji: '💡', label: 'Insightful' },
  { kind: 'book', emoji: '📚', label: 'Great read' },
]

// Returns { element, setData(counts, mineKinds) }.
function createReactionBar(summaryId, session) {
  const bar = el('div', { class: 'reaction-bar d-none mt-3', role: 'group', 'aria-label': 'Reactions' })
  if (!session) return { element: bar, setData() {} }

  let counts = {}
  let mineKind = null
  let busy = false
  const buttons = new Map()

  function paint() {
    for (const { kind, emoji, label } of REACTIONS) {
      const btn = buttons.get(kind)
      const n = counts[kind] || 0
      const active = mineKind === kind
      btn.classList.toggle('active', active)
      btn.setAttribute('aria-pressed', String(active))
      btn.title = active ? `${label} (tap to remove)` : label
      btn.textContent = n > 0 ? `${emoji} ${n}` : emoji
      btn.disabled = busy
    }
  }

  function bump(kind, delta) {
    counts[kind] = Math.max(0, (counts[kind] || 0) + delta)
  }

  const reactionRow = () =>
    db.from('reactions').delete().eq('summary_id', summaryId).eq('user_id', session.user.id)

  async function choose(kind) {
    if (busy) return
    busy = true

    const before = { counts: { ...counts }, mineKind }

    // Show the change straight away; undo it if the server refuses.
    if (mineKind === kind) {
      bump(kind, -1)
      mineKind = null
    } else {
      if (mineKind) bump(mineKind, -1)
      bump(kind, +1)
      mineKind = kind
    }
    paint()

    let error = null
    if (before.mineKind) {
      // Remove the old reaction first (the table allows only one per member).
      ;({ error } = await reactionRow())
    }
    if (!error && mineKind) {
      ;({ error } = await db
        .from('reactions')
        .insert({ summary_id: summaryId, user_id: session.user.id, kind: mineKind }))
      if (error && before.mineKind) {
        // The old one is already gone, so show that truthfully.
        counts = { ...before.counts }
        bump(before.mineKind, -1)
        mineKind = null
        busy = false
        paint()
        return
      }
    }

    if (error) {
      counts = before.counts
      mineKind = before.mineKind
    }
    busy = false
    paint()
  }

  for (const { kind } of REACTIONS) {
    const btn = el('button', {
      class: 'reaction-btn',
      type: 'button',
      onclick: () => choose(kind),
    })
    buttons.set(kind, btn)
    bar.append(btn)
  }
  paint()

  function setData(newCounts, mineKinds) {
    counts = { ...newCounts }
    mineKind = [...mineKinds][0] || null
    paint()
    bar.classList.remove('d-none')
  }

  return { element: bar, setData }
}
