import { useEffect, useState } from 'preact/hooks';
import { getFlag, setFlag } from '../lib/chromeApi';
import { Toast, useToast } from './components/Toast';
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

export function App() {
  const vault = useVault();
  const toast = useToast();
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
