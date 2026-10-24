import { applyTheme, currentTheme, restoreTheme, Theme } from 'demo-shared';
import { ReactElement, useLayoutEffect, useState } from 'react';

/** Light/dark switch. Follows the OS until clicked; the choice is shared with the other apps. */
export function ThemeToggle(): ReactElement {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  useLayoutEffect(() => {
    restoreTheme();
  }, []);

  const toggle = () => {
    applyTheme(next);
    setTheme(next);
  };

  return (
    <button type="button" className="ghost" aria-label={`Switch to ${next} theme`} onClick={toggle}>
      {next === 'dark' ? 'Dark' : 'Light'}
    </button>
  );
}
