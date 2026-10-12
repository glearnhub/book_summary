const form = document.getElementById('auth-form')
const message = document.getElementById('message')
const nameGroup = document.getElementById('name-group')
const passwordHint = document.getElementById('password-hint')
const submitBtn = document.getElementById('submit-btn')
const tabs = document.querySelectorAll('#mode-tabs button')

let mode = 'signin'

function setMode(next) {
  mode = next
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.mode === mode))
  const signup = mode === 'signup'
  nameGroup.classList.toggle('d-none', !signup)
  passwordHint.classList.toggle('d-none', !signup)
  document.getElementById('password').autocomplete = signup ? 'new-password' : 'current-password'
  submitBtn.textContent = signup ? 'Create account' : 'Sign in'
  message.replaceChildren()
}

tabs.forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode)))

function friendlyError(error) {
  const text = (error.message || '').toLowerCase()
  if (text.includes('invalid login')) return 'Wrong email or password.'
  if (text.includes('already registered')) return 'That email already has an account. Try signing in.'
  if (text.includes('email not confirmed')) return 'Please confirm your email first, then sign in.'
  if (text.includes('rate limit')) return 'Too many attempts. Please wait a bit and try again.'
  return error.message || 'Something went wrong. Please try again.'
}

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  if (!db) {
    message.replaceChildren(notConfiguredNotice())
    return
  }

  const email = document.getElementById('email').value.trim()
  const password = document.getElementById('password').value
  const displayName = document.getElementById('display-name').value.trim()

  if (!email || !password) {
    showAlert(message, 'Please enter your email and password.')
    return
  }
  if (mode === 'signup') {
    if (!displayName) {
      showAlert(message, 'Please enter the name to show with your summaries.')
      return
    }
    if (password.length < 6) {
      showAlert(message, 'Password must be at least 6 characters.')
      return
    }
  }

  submitBtn.disabled = true
  try {
    if (mode === 'signup') {
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      })
      if (error) throw error
      if (!data.session) {
        setMode('signin')
        showAlert(message, 'Account created. Check your email to confirm it, then sign in.', 'success')
        return
      }
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password })
      if (error) throw error
    }
    window.location.href = 'submit.html'
  } catch (error) {
    showAlert(message, friendlyError(error))
  } finally {
    submitBtn.disabled = false
  }
})

;(async () => {
  const session = await renderNav('')
  if (session) window.location.href = 'submit.html'
  if (!db) message.replaceChildren(notConfiguredNotice())
})()
