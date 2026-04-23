# Mac Setup Guide — Trace AI Mobile

Zero-to-running guide for developing Trace natively on a Mac with an iOS simulator and Claude Code. Targeted at a non-developer — every step assumes nothing.

If you'd rather develop in GitHub Codespaces on a real phone via Expo Go instead, see `README.md`. This guide is the fully-local alternative.

**Estimated time:** 1.5–2 hours, mostly waiting on downloads. Plan for an afternoon.

---

## Part 0: Prerequisite — Upgrade macOS

Xcode 16 (which we need) requires macOS 14 Sonoma or newer. If macOS says it needs to upgrade when you try to install Xcode, do this first.

1. (Optional but recommended) Back up your Mac:
   - Plug in an external drive
   - System Settings → General → Time Machine → set it up
   - Starts a full backup in the background

2. Upgrade macOS:
   - System Settings → **General** → **Software Update**
   - Upgrade to macOS Sequoia (or whatever the latest offered version is)
   - Plug in the charger
   - Takes ~45 minutes + 1–2 restarts

---

## Part 1: Install developer tools

### 1. Install Xcode (stable, from the App Store)

- Open the **App Store** → search **Xcode** → Install
- ~12 GB, 30+ min. Start this first and let it run in the background
- Use the **App Store version**, not the Xcode from developer.apple.com
- After install, open Xcode once to accept the license agreement
- Xcode → **Settings** → **Accounts** → sign in with your Apple ID

### 2. Install Xcode command-line tools

Open **Terminal** (Cmd+Space, type "Terminal", Enter):

```
xcode-select --install
```

Click through the dialog. ~5 min.

### 3. Install iOS simulator runtime

- Xcode → **Settings** → **Components**
- Find **iOS 18.x** (or the latest version offered) → click **Get**
- ~8 GB, 10–20 min

### 4. Install Homebrew

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

At the end, the installer prints 2 lines to add brew to your shell path. **Copy and paste those exactly** into Terminal.

### 5. Install Node.js via nvm

```
brew install nvm
mkdir -p ~/.nvm
```

Open the shell config:

```
open -e ~/.zshrc
```

Add these lines at the bottom and save:

```
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"
```

Close and reopen Terminal, then:

```
nvm install 20
nvm use 20
nvm alias default 20
```

### 6. Install yarn

```
npm install -g yarn
```

### 7. Verify git

```
git --version
```

Should print a version number. If it says "command not found":

```
brew install git
```

### 8. Configure git identity

```
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

Use the same email you'll use for GitHub in the next part.

---

## Part 2: Repo access

### 9. Create a GitHub account

Go to **github.com** → Sign up with the email from step 8.

### 10. Accept the collaborator invitation

Nate will invite you as a collaborator. Check email for the invite from **nategreat13** and click **Accept invitation**. If you can't find the email, go to `https://github.com/nategreat13/trace-ai-mobile` directly — you'll see a banner to accept there too.

### 11. Generate an SSH key for GitHub

```
ssh-keygen -t ed25519 -C "your-email@example.com"
```

Press Enter through all prompts (no passphrase is fine for simplicity).

Copy the public key to the clipboard:

```
pbcopy < ~/.ssh/id_ed25519.pub
```

On GitHub → Profile picture → **Settings** → **SSH and GPG keys** → **New SSH key** → paste into the "Key" field → save.

### 12. Clone the repo

```
cd ~/Documents
git clone git@github.com:nategreat13/trace-ai-mobile.git
cd trace-ai-mobile
```

### 13. Install all project dependencies

```
yarn install
```

First time: 3–5 min.

---

## Part 3: Claude Code

### 14. Install Claude Code

```
curl -fsSL https://claude.ai/install.sh | sh
```

### 15. Sign in

From the repo root:

```
cd ~/Documents/trace-ai-mobile
claude
```

It opens a browser to authenticate. You'll need a **Claude Pro** or **Claude Max** subscription (or an Anthropic API key with credits) for Claude Code to work.

---

## Part 4: Running the app

The project uses two commands:

- **`yarn dev1`** — runs the backend API locally (only needed for server work)
- **`yarn dev2`** — runs the Expo dev server for the app (always needed)

For frontend-only work, `dev2` alone is enough because the app hits the deployed production API by default.

### 16. Start the Expo dev server

From the repo root:

```
yarn dev2
```

A QR code + menu appears in Terminal. Leave this tab running.

### 17. First native build + install on simulator

In a **new** Terminal tab (Cmd+T):

```
cd ~/Documents/trace-ai-mobile/projects/app
npx expo run:ios
```

- First time: 10–20 min (Xcode compiles everything)
- Subsequent runs: seconds (just reload the app in the simulator)
- iOS Simulator opens automatically with the Trace app

### 18. If simulator selection fails

List available simulators:

```
xcrun simctl list devices available
```

Pick an iPhone name (e.g. "iPhone 16 Pro"), then:

```
npx expo run:ios --device "iPhone 16 Pro"
```

### 19. Verify the app runs

The Landing page should appear with a deal carousel and airport picker. If yes, you're set up.

### 20. (Optional) Start the backend locally

Only needed if editing server code in `projects/server`. In a **separate** Terminal tab from the repo root:

```
yarn dev1
```

This builds `@trace/shared`, runs a TypeScript watcher on the server, and starts the server on `http://localhost:3001` with hot reload.

**For the app to actually hit this local server**, temporarily edit `projects/app/src/lib/constants.ts`:

```ts
export const API_BASE_URL = "http://localhost:3001";
```

Revert this before committing — the app ships with the production URL.

---

## Part 5: Daily workflow

### 21. Starting a session

**Tab 1 — pull latest + Expo dev server:**

```
cd ~/Documents/trace-ai-mobile
git pull
yarn dev2
```

**Tab 2 — simulator** (only first time or after native changes):

```
cd ~/Documents/trace-ai-mobile/projects/app
npx expo run:ios
```

After the initial run, just reload the app in the simulator with Cmd+R instead of re-running.

**Tab 3 — Claude Code:**

```
cd ~/Documents/trace-ai-mobile
claude
```

Ask in plain English:
- "Change the welcome text on the landing page to say 'Welcome to Trace'"
- "Make the deal cards show the airline name in bold"
- "Add a heart icon next to saved deals"

**Tab 4 (only for server work) — backend:**

```
cd ~/Documents/trace-ai-mobile
yarn dev1
```

### 22. Hot reload

The Expo dev server (`yarn dev2`) watches files and auto-reloads the simulator on any JS change. No restart needed for most edits.

### 23. Saving changes to GitHub

```
git status
git diff
git add .
git commit -m "Brief description of the change"
git push
```

Or just tell Claude Code: "Commit all my changes and push to the trevor branch" and it handles the whole thing.

### 24. Pulling Nate's changes

```
git pull
```

If `package.json` changed:

```
yarn install
```

If native code changed (rare — like a new native library):

```
cd projects/app
npx expo run:ios
```

Otherwise just Cmd+R in the simulator.

---

## Part 6: Edge cases

### 25. Running on a real iPhone

Plug in via USB, trust the Mac on the phone, then from `projects/app`:

```
npx expo run:ios --device
```

### 26. Signing in for testing

The app uses Firebase Auth. Either use an existing test account shared by Nate, or create a new one via the signup flow.

### 27. Paywall shows "Subscriptions unavailable"

Expected in sandbox if Apple's In-App Purchases aren't resolving on the simulator (they often don't — StoreKit is finicky on simulator). Not a concern for everyday dev work unless you're working on the paywall specifically. Real devices work correctly.

---

## Part 7: Troubleshooting

### 28. "Command not found"

Close and reopen Terminal. Most shell changes only apply in new sessions.

### 29. Simulator won't launch

Open **Simulator.app** manually (Cmd+Space → "Simulator"). From its menu: **File → Open Simulator → iOS 18.x → iPhone 16 Pro**.

### 30. Xcode build fails

Open the Xcode project to see the real error:

```
open projects/app/ios/traceaimobile.xcworkspace
```

Hit the ▶ Play button in Xcode. Errors are much more readable in Xcode's UI than in Terminal.

### 31. Metro cache issues

If changes aren't showing up in the simulator:

```
yarn dev2 --clear
```

### 32. Node version mismatch

```
cd ~/Documents/trace-ai-mobile
nvm use 20
```

### 33. `dev1` fails with "port 3001 in use"

Another server instance is running. Kill it:

```
lsof -ti:3001 | xargs kill
```

### 34. Claude is asking permission to run a command or edit a file

Type `y` and press Enter. Claude Code defaults to asking before making changes.

### 35. Something went wrong I can't diagnose

Copy the error and paste it to Claude Code in Terminal. It can usually fix shell errors and code errors directly.

---

## Cheat sheet

| What you want to do | What to type and where |
|---|---|
| Start Expo dev server | `yarn dev2` (Tab 1) |
| Build + launch simulator | `npx expo run:ios` (Tab 2, first time only) |
| Start Claude Code | `claude` (Tab 3) |
| Reload app in simulator | Cmd+R in Simulator |
| Start backend | `yarn dev1` (Tab 4, only for server work) |
| Pull latest code | `git pull` |
| Save + push changes | `git add . && git commit -m "msg" && git push` |
| Stop any server | Ctrl+C in its Terminal tab |
| Exit Claude Code | Type `/exit` |

---

## Rules

1. **Don't close the Expo dev server (`yarn dev2`)** while you're working — the app needs it for hot reload
2. Always commit and push your changes before closing Terminal so your work is saved to GitHub
3. Work on the **trevor** branch only unless told otherwise
4. If in doubt, ask Claude Code in Terminal
