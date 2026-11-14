import React from "react";
import { useTheme } from "@mui/material";

// Cloudflare Turnstile widget ("verify you are human"). The token it hands to
// onToken goes to the Worker, which checks it with Siteverify. Tokens are
// single-use, so call reset() after every submit attempt that keeps the page
// open; the widget then produces a fresh token.

/** Turnstile's published always-pass test key, used when no key is configured. */
const TEST_SITE_KEY = "1x00000000000000000000AA";

export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || TEST_SITE_KEY;

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type RenderOptions = {
  sitekey: string;
  action?: string;
  theme?: "light" | "dark" | "auto";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  "timeout-callback"?: () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: RenderOptions) => string | undefined;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

const loadTurnstile = (): Promise<TurnstileApi> => {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not load")));
      script.onerror = () => {
        scriptPromise = null;
        script.remove();
        reject(new Error("Turnstile did not load"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
};

export type TurnstileHandle = { reset: () => void };

type Props = {
  action: string;
  /** a fresh token, or null when the last one expired or the widget failed */
  onToken: (token: string | null) => void;
};

export const Turnstile = React.forwardRef<TurnstileHandle, Props>(({ action, onToken }, ref) => {
  const container = React.useRef<HTMLDivElement>(null);
  const widgetId = React.useRef<string | undefined>(undefined);
  const onTokenRef = React.useRef(onToken);
  onTokenRef.current = onToken;
  const [loadFailed, setLoadFailed] = React.useState(false);
  const mode = useTheme().palette.mode;

  React.useImperativeHandle(ref, () => ({
    reset: () => {
      onTokenRef.current(null);
      if (widgetId.current && window.turnstile) {
        window.turnstile.reset(widgetId.current);
      }
    },
  }));

  React.useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !container.current) {
          return;
        }
        widgetId.current = turnstile.render(container.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          theme: mode,
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
          "timeout-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
      widgetId.current = undefined;
    };
  }, [action, mode]);

  return (
    <div className="turnstile">
      <div ref={container} />
      {loadFailed && (
        <p className="field-error">
          The "verify you are human" check could not load. Check your connection or ad blocker, then reload the page.
        </p>
      )}
    </div>
  );
});
