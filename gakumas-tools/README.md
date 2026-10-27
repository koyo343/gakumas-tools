# Gakumas Tools

A collection of tools for playing Gakuen Idolmaster.

## Prerequisites

- [Node.js](https://nodejs.org/) (runtime environment)
- [pnpm](https://pnpm.io/) (package manager — install via `corepack enable`)

## Usage

Clone the repository
```
git clone git@github.com:gakumas-tools/gakumas-tools.git
```

Enter the project directory and install dependencies:
```
cd gakumas-tools && pnpm install
```

Run the project in dev mode  
**in pnpm ver 12.15.0** (This is a temporary measure.)
```diff
- pnpm dev
+ pnpm_config_pm_on_fail=ignore pnpm dev
```

Open `http://localhost:3000` to view the app.
