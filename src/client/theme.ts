import { createTheme } from "@mui/material/styles";

/* Block Barons brand tokens: the one place the game's colours and type are set.

   "Night city": navy ink and brass on warm concrete, chosen to move away from
   Monopoly's red, white and green. index.tsx writes every entry below onto
   :root as a CSS variable (--bb-ink, --bb-brass, ...) for the plain CSS files,
   and the MUI theme further down reads the same values, so buttons, dialogs
   and the hand-written CSS always agree.

   Not tokens on purpose: the eight property group colours (board.css), each
   player's colour, the Word on the Street card's own orange palette, the
   leaderboard medals, the Facebook button and the dice. */

export const tokens = {
  // text
  ink: "#1b2333",
  ink2: "#3a4358",
  muted: "#5e6678",
  faint: "#8c92a0",

  // surfaces, lightest first: cards, the page and board squares, the board's
  // middle, chips and tracks
  surface: "#fffdf8",
  paper: "#f8f4ea",
  surface2: "#eee8db",
  surface3: "#e1d9c8",

  // rules
  line: "#e3dccd",
  lineStrong: "#c9bfab",

  // brand: navy for primary actions and links, brass for highlights
  brand: "#1f3a5f",
  brandStrong: "#142844",
  brandSoft: "#e5eaf2",
  brandLine: "#b8c5d8",
  link: "#2a4f7c",
  brass: "#c9971a",
  brassStrong: "#a87b0c",
  brassSoft: "#f6ecd2",
  brassInk: "#7d5c06",

  // gains and losses
  good: "#2e7d32",
  goodSoft: "#e3f0e4",
  goodInk: "#1e5a22",
  bad: "#b42318",
  badSoft: "#fbe5e3",
  badInk: "#8e1c1c",

  fontDisplay: '"Barlow Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif',
  fontBody: '"Public Sans", system-ui, "Segoe UI", Helvetica, Arial, sans-serif',
} as const;

const toVarName = (key: string) => "--bb-" + key.replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase();

/** The tokens as CSS custom properties: { "--bb-ink": "#1b2333", "--bb-line-strong": ... }. */
export const cssVariables: Record<string, string> = Object.fromEntries(
  Object.entries(tokens).map(([key, value]) => [toVarName(key), value]),
);

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: tokens.brand, dark: tokens.brandStrong, contrastText: "#fff" },
    secondary: { main: tokens.brass, dark: tokens.brassStrong, contrastText: tokens.ink },
    success: { main: tokens.good },
    error: { main: tokens.bad },
    warning: { main: tokens.brass, contrastText: tokens.ink },
    text: { primary: tokens.ink, secondary: tokens.muted },
    background: { default: tokens.paper, paper: tokens.surface },
    divider: tokens.line,
  },
  typography: {
    fontFamily: tokens.fontBody,
    h1: { fontFamily: tokens.fontDisplay, fontWeight: 700 },
    h2: { fontFamily: tokens.fontDisplay, fontWeight: 700 },
    h3: { fontFamily: tokens.fontDisplay, fontWeight: 600 },
    h4: { fontFamily: tokens.fontDisplay, fontWeight: 600 },
    h5: { fontFamily: tokens.fontDisplay, fontWeight: 600 },
    h6: { fontFamily: tokens.fontDisplay, fontWeight: 600 },
    button: { fontFamily: tokens.fontDisplay, fontWeight: 600, fontSize: "1rem", letterSpacing: "0.06em" },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontFamily: tokens.fontDisplay, fontWeight: 600, fontSize: "1.5rem" } },
    },
  },
});
