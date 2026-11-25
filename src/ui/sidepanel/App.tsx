import { useCallback, useEffect, useState } from 'preact/hooks';
import type { PageAccount } from '../../shared/messages';
import { lastAccount, openAccount } from '../lib/accounts';
import { getFlag, setFlag } from '../lib/chromeApi';
import { clearThumbCache } from './components/Thumb';
import { Toast, useToast, type ToastApi } from './components/Toast';
import { Cleanup } from './screens/Cleanup';
import { Home } from './screens/Home';
import { Review } from './screens/Review';
import { Welcome } from './screens/Welcome';
import { useVault } from './useVault';

type Screen =
  | { name: 'loading' }
  | { name: 'welcome' }
  | { name: 'home' }
  | { name: 'review'; categoryId: string }
  | { name: 'cleanup' };

const WELCOMED = 'welcomed';

/**
 * Each Google account has its own results. The panel opens on the account it showed last and
 * starts over (fresh state, that account's saved results) when the Google Photos tab turns out
 * to be signed in to another one.
 */
export function App() {
  const toast = useToast();
  /** null while loading. */
  const [account, setAccount] = useState<{ value: PageAccount | null } | null>(null);

  useEffect(() => {
    void (async () => {
      const last = await lastAccount();
      if (last) await openAccount(last);
      setAccount({ value: last });
    })();
  }, []);

  const onAccount = useCallback(
    (next: PageAccount) => {
      void (async () => {
        await openAccount(next);
        clearThumbCache();
        toast.hide(); // its Undo belongs to the other account
        setAccount({ value: next });
      })();
    },
    [toast],
  );

  if (!account) return null;
  return (
    <VaultApp
      key={account.value?.id ?? 'none'}
      account={account.value}
      onAccount={onAccount}
      toast={toast}
    />
  );
}

function VaultApp({
  account,
  onAccount,
  toast,
}: {
  account: PageAccount | null;
  onAccount: (account: PageAccount) => void;
  toast: ToastApi;
}) {
  const vault = useVault(account, onAccount);
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });
  const home = () => setScreen({ name: 'home' });

  useEffect(() => {
    void getFlag(WELCOMED).then((seen) => setScreen(seen ? { name: 'home' } : { name: 'welcome' }));
  }, []);

  // Each screen starts at the top, with focus on its heading so keyboard and screen-reader
  // users are not dropped back to the start of the page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.querySelector<HTMLElement>('main h1, main h2')?.focus({ preventScroll: true });
  }, [screen]);

  let content;
  switch (screen.name) {
    case 'loading':
      content = null;
      break;
    case 'welcome':
      content = (
        <Welcome
          onStart={() => {
            void setFlag(WELCOMED, true);
            home();
          }}
        />
      );
      break;
    case 'home':
      content = (
        <Home
          vault={vault}
          onReview={(categoryId) => setScreen({ name: 'review', categoryId })}
          onCleanup={() => setScreen({ name: 'cleanup' })}
        />
      );
      break;
    case 'review':
      content = (
        <Review
          vault={vault}
          toast={toast}
          categoryId={screen.categoryId}
          group={vault.groups.find((g) => g.categoryId === screen.categoryId)}
          onBack={home}
        />
      );
      break;
    case 'cleanup':
      content = <Cleanup vault={vault} toast={toast} onBack={home} />;
      break;
  }

  return (
    <>
      {content}
      <Toast state={toast} />
    </>
  );
}
