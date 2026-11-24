export function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <main class="screen welcome">
      <h1 tabIndex={-1}>Tidy your Google Photos, safely</h1>
      <p class="muted">
        Vault Tidy looks through your Google Photos on this computer and suggests photos you might
        not need. It never deletes anything.
      </p>
      <ul class="promises">
        <li>Runs on this computer</li>
        <li>Only suggests</li>
        <li>You decide</li>
      </ul>
      <button class="primary" onClick={onStart}>
        Get started
      </button>
    </main>
  );
}
