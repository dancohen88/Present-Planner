import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Db } from '../data/supabase.ts'

interface Props {
  db: Db
}

/**
 * Two steps: send a 6-digit code by email, then type it in. A code rather
 * than a link, because a link tapped in a mail app opens the phone's
 * browser instead of the installed app.
 */
export function SignIn({ db }: Props) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode(event?: FormEvent) {
    event?.preventDefault()
    const address = email.trim()
    if (!address) return
    setBusy(true)
    setError(null)
    const { error: sendError } = await db.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true },
    })
    setBusy(false)
    if (sendError) {
      if (sendError.code === 'over_email_send_rate_limit') {
        // The server's own wording ("For security purposes…") is unclear.
        const seconds = Number(/(\d+) seconds?/.exec(sendError.message)?.[1])
        setError(
          seconds > 1
            ? `A code was sent moments ago. You can ask for another in ${seconds} seconds.`
            : 'A code was sent moments ago. Wait a second and try again.',
        )
      } else {
        setError(
          "Couldn't send the code. Check the address and your connection.",
        )
      }
      return
    }
    setCode('')
    setStep('code')
  }

  async function verify(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error: verifyError } = await db.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    // On success the session listener in useSession takes over.
    if (verifyError) {
      setError("That code didn't work. Check it, or send a new one.")
    }
  }

  return (
    <main className="gate">
      <div className="gate-card">
        <p className="brand">
          <span aria-hidden="true">🎁</span> Present Planner
        </p>
        {step === 'email' ? (
          <form className="stack" onSubmit={sendCode}>
            <h1>Sign in</h1>
            <p className="muted">
              We'll email you a 6-digit code. No password needed.
            </p>
            <label className="field">
              <span>Email</span>
              <input
                id="sign-in-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
          </form>
        ) : (
          <form className="stack" onSubmit={verify}>
            <h1>Check your email</h1>
            <p className="muted">
              Enter the code we sent to <strong>{email.trim()}</strong>.
            </p>
            <label className="field">
              <span>6-digit code</span>
              <input
                id="sign-in-code"
                className="code-input"
                // one-time-code lets the phone offer the code from the email.
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
              />
            </label>
            <button type="submit" disabled={busy || code.length !== 6}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <div className="row-links">
              <button
                type="button"
                className="link"
                disabled={busy}
                onClick={() => void sendCode()}
              >
                Send a new code
              </button>
              <button
                type="button"
                className="link"
                onClick={() => {
                  setStep('email')
                  setError(null)
                }}
              >
                Use a different email
              </button>
            </div>
          </form>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
