# Trevor's Setup Guide — Trace AI Mobile

## Step 1: Accept the Repo Invitation

Check your email (the one tied to your GitHub account). You'll have an invite from nategreat13 to collaborate on trace-ai-mobile. Click **Accept invitation**.

If you can't find the email, go to: https://github.com/nategreat13/trace-ai-mobile and you'll see a banner to accept.

---

## Step 2: Install Expo Go on Your Phone

- **iPhone**: Search "Expo Go" in the App Store and install it
- **Android**: Search "Expo Go" in the Google Play Store and install it
- Create a free Expo account at https://expo.dev/signup — remember your username and password, you'll need them later

---

## Step 3: Open Your Codespace

Click this link:

https://github.com/codespaces/new?repo=nategreat13/trace-ai-mobile&ref=trevor

- Make sure the Branch says **trevor**
- Leave everything else as default
- Click the green **Create codespace** button
- Wait for it to load — this takes 1-2 minutes. You'll see something that looks like a code editor in your browser

---

## Step 4: Set Up the Project (One-Time Only)

At the bottom of the screen, you'll see a Terminal panel. It has a blinking cursor. This is where you type commands.

Click in the terminal and type each of these commands one at a time, pressing Enter after each one. Wait for each to finish before typing the next:

```
yarn install
```
(This downloads everything the app needs. Takes about 30 seconds.)

```
npx expo login
```
(This will ask for your Expo username and password — type them in. Your password won't show as you type — that's normal. Press Enter after each.)

```
npm install -g @anthropic-ai/claude-code
```
(This installs Claude Code — the tool that lets you code with Claude.)

---

## Step 5: Start the Server

In the terminal, type:

```
yarn dev1
```

Wait until you see a line that says:

```
Server running on http://localhost:3001
```

That means the server is ready. **Leave this running!** Don't close the terminal or type anything else in it. The app needs this server to load travel deals.

---

## Step 6: Start the App

You need a second terminal. Look at the terminal panel at the bottom of the screen:

- Click the **+** button (it's near the top-right of the terminal panel, next to the word "bash")
- This opens a new terminal tab

In this new terminal, type:

```
yarn dev2 -- --tunnel
```

Wait about 15-20 seconds. You'll see a QR code made of squares appear in the terminal, and a line that says something like:

```
› Metro: exp://u.expo.dev/...
```

On your phone:
- **iPhone**: Open your normal Camera app and point it at the QR code on your computer screen. A notification will pop up — tap it and it will open in Expo Go
- **Android**: Open the Expo Go app and tap "Scan QR code", then point at the QR code

The app will load on your phone. This first load takes about 30-60 seconds — be patient.

**Leave this terminal running!** Don't close it or type anything else in it.

---

## Step 7: Open Claude Code

You need a third terminal. Click the **+** button again to open another terminal tab.

In this new terminal, type:

```
claude
```

Claude will start up. The first time, it will ask you to log in — follow the prompts (it'll open a browser tab where you sign in with your Claude/Anthropic account).

---

## Step 8: Make Changes with Claude

Now you're talking to Claude in the terminal. Just type what you want in plain English. Examples:

- "Change the background color of the swipe screen to dark blue"
- "Make the deal cards show the airline name in bold"
- "Add a heart emoji next to saved deals"
- "Fix the text on the upgrade screen to say 'Start Your Free Trial'"

Claude will edit the code files for you. After each change, look at your phone — the app will automatically update within a few seconds (it hot-reloads).

If the app doesn't update, shake your phone and tap "Reload" in the menu that appears.

---

## Step 9: Save Your Work (Push to GitHub)

When you're happy with your changes and want to save them, type this to Claude:

```
Commit all my changes and push to the trevor branch
```

Claude will handle everything — staging files, writing a commit message, and pushing to GitHub. You'll see it run several commands automatically.

That's it! Nate will be able to see your changes and merge them in.

---

## Cheat Sheet — Commands You'll Use

| What you want to do | What to type and where |
|---|---|
| Start the server | `yarn dev1` (Terminal 1) |
| Start the app | `yarn dev2 -- --tunnel` (Terminal 2) |
| Start Claude | `claude` (Terminal 3) |
| Stop the server | Press `Ctrl + C` in Terminal 1 |
| Stop the app | Press `Ctrl + C` in Terminal 2 |
| Exit Claude | Type `/exit` in Terminal 3 |
| Restart everything | Stop all three, then start them again in order |

---

## Troubleshooting

**"The app won't load on my phone"**
- Make sure your phone has internet (WiFi or cellular)
- Make sure Terminal 2 is still running (you should see the QR code)
- Try closing Expo Go on your phone completely and scanning the QR code again

**"Deals aren't loading / the app shows empty screens"**
- Make sure Terminal 1 is still running (you should see "Server running on http://localhost:3001")
- If it's not running, click Terminal 1 and type `yarn dev1` again

**"The app froze / shows an error screen"**
- Shake your phone and tap "Reload"
- If that doesn't work, tell Claude: "I'm seeing an error on the app, can you check what's wrong?"

**"The terminal says something went wrong"**
- Copy the error message and paste it to Claude — Claude can usually fix it

**"My Codespace disappeared"**
- Go to https://github.com/codespaces and you'll see your existing Codespace — click on it to reopen. You do NOT need to redo Step 4. Just start from Step 5.

**"Claude is asking me to approve something"**
- If Claude asks permission to run a command or edit a file, type `y` and press Enter

---

## Important Rules

1. **Don't close Terminal 1 or Terminal 2** while you're working — Terminal 1 runs the server, Terminal 2 runs the app on your phone
2. Always use **Terminal 3** (the third tab) to talk to Claude
3. Always **push your changes** before closing the Codespace so your work is saved
4. Only work on the **trevor** branch — don't switch branches
