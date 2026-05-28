# Contributing to Chuma

## Running the app

```bash
npm install
npx expo start
```

Press `a` for Android emulator, `i` for iOS simulator, or scan the QR code with Expo Go.

## Folder structure

```
src/
├── components/
│   ├── charts/        # Reusable chart primitives (LineChart, BarChart)
│   ├── common/        # Shared screen-level components (ScreenHeader, TransactionRow)
│   └── ui/            # Atomic UI elements (Button, Card, Avatar, Input, etc.)
├── constants/
│   └── index.ts       # App-wide constants (APP_NAME, currency, thresholds)
├── contexts/          # React context providers
│   ├── AuthContext.tsx # Auth state (userId, token, login, logout)
│   └── RoleContext.tsx # Demo role switcher with permission checks
├── data/
│   └── mock/          # Mock data split by domain (groups, loans, transactions, …)
├── hooks/             # Thin re-export hooks (useAuth, useRole, useTheme)
├── services/          # Async data-access layer (currently backed by mock data)
│   ├── approvals.ts
│   ├── auth.ts
│   ├── groups.ts
│   ├── loans.ts
│   └── transactions.ts
├── theme/             # ThemeContext + colour tokens
├── types/
│   └── index.ts       # All shared TypeScript interfaces and types
└── utils/
    ├── currency.ts    # formatZMW, CURRENCY_CODE, CURRENCY_SYMBOL
    └── storage/       # Platform-agnostic AsyncStorage wrapper
```

## Conventions for adding new screens

1. **Route file** — add a file under `app/` following Expo Router conventions (e.g. `app/(modals)/my-screen.tsx`).
2. **Types first** — define any new interfaces in `src/types/index.ts` before using them.
3. **Service layer** — add data-fetching functions in the relevant `src/services/*.ts` file. Functions must be `async` and return typed results. Wire up to real API calls there; screens should never import from `src/data/mock` directly in production code.
4. **Components** — put reusable screen chrome in `src/components/common/`, atomic UI in `src/components/ui/`.
5. **Constants** — add app-wide magic values to `src/constants/index.ts`, not inline.
6. **Currency** — always use `formatZMW` from `src/utils/currency` for display; never hard-code `"K "` prefixes.
7. **Permissions** — use `useRole().can("permission.key")` to guard role-restricted UI; don't duplicate role logic inline.
