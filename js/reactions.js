// One-tap reactions under a summary. Signed-in members only.
// The bar stays hidden until its data arrives, so it never shows broken
// buttons if the reactions table has not been created yet.
const REACTIONS = [
  { kind: 'like', emoji: '👍', label: 'Like' },
  { kind: 'love', emoji: '❤️', label: 'Love' },
  { kind: 'clap', emoji: '👏', label: 'Well done' },
  { kind: 'insight', emoji: '💡', label: 'Insightful' },
  { kind: 'book', emoji: '📚', label: 'Great read' },
]

// Returns { element, setData(counts, mineSet) }.
function createReactionBar(summaryId, session) {
  const bar = el('div', { class: 'reaction-bar d-none mt-3', role: 'group', 'aria-label': 'Reactions' })
  if (!session) return { element: bar, setData() {} }

  let counts = {}
  let mine = new Set()
  const buttons = new Map()

  function paint() {
    for (const { kind, emoji, label } of REACTIONS) {
      const btn = buttons.get(kind)
      const n = counts[kind] || 0
      const active = mine.has(kind)
      btn.classList.toggle('active', active)
      btn.setAttribute('aria-pressed', String(active))
      btn.title = active ? `${label} (tap to remove)` : label
      btn.textContent = n > 0 ? `${emoji} ${n}` : emoji
    }
  }

  async function toggle(kind) {
    const btn = buttons.get(kind)
    const wasActive = mine.has(kind)
    btn.disabled = true

    // Update straight away, undo if the server refuses.
    if (wasActive) {
      mine.delete(kind)
      counts[kind] = Math.max(0, (counts[kind] || 0) - 1)
    } else {
      mine.add(kind)
      counts[kind] = (counts[kind] || 0) + 1
    }
    paint()

    const request = wasActive
      ? db
          .from('reactions')
          .delete()
          .eq('summary_id', summaryId)
          .eq('user_id', session.user.id)
          .eq('kind', kind)
      : db.from('reactions').insert({ summary_id: summaryId, user_id: session.user.id, kind })
    const { error } = await request

    if (error) {
      if (wasActive) {
        mine.add(kind)
        counts[kind] = (counts[kind] || 0) + 1
      } else {
        mine.delete(kind)
        counts[kind] = Math.max(0, (counts[kind] || 0) - 1)
      }
      paint()
    }
    btn.disabled = false
  }

  for (const { kind } of REACTIONS) {
    const btn = el('button', {
      class: 'reaction-btn',
      type: 'button',
      onclick: () => toggle(kind),
    })
    buttons.set(kind, btn)
    bar.append(btn)
  }
  paint()

  function setData(newCounts, newMine) {
    counts = { ...newCounts }
    mine = new Set(newMine)
    paint()
    bar.classList.remove('d-none')
  }

  return { element: bar, setData }
}
