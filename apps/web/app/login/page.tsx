import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold">⚖️ Legal Owl</h1>
        <p className="mb-6 text-sm text-gray-500">Case Workflow</p>

        <form className="space-y-3">
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Password (min. 6 chars)"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            formAction={login}
            className="w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
          >
            Sign in
          </button>
          <button
            formAction={signup}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium"
          >
            Create account
          </button>
        </form>
      </div>
    </main>
  );
}
