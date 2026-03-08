import { reactivateAccountAction } from './actions'

/**
 * AC3: Shown to users whose account is in the 30-day grace period.
 * AC4: Provides a reactivation button that restores the account.
 */
export default function ReactivatePage() {
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-bold text-white">Your account is pending deletion</h1>
      <p className="text-gray-400">
        You requested account deletion. Your data will be permanently removed after the 30-day
        grace period.
      </p>
      <p className="text-gray-400">
        You can reactivate your account now to cancel the deletion.
      </p>
      <form action={reactivateAccountAction}>
        <button
          type="submit"
          className="rounded bg-purple-600 px-6 py-2 font-semibold text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          Reactivate my account
        </button>
      </form>
      <p className="text-sm text-gray-500">
        If you meant to delete your account,{' '}
        <a href="/" className="text-gray-400 underline hover:text-white">
          return to the homepage
        </a>
        .
      </p>
    </div>
  )
}
