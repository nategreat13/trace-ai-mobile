/**
 * One-shot hand-off from onboarding to the sign-in form.
 *
 * Onboarding runs on an anonymous session, so the sign-in screen (which only
 * exists in the signed-out stack) can't be pushed from it. "Already have an
 * account?" signs the anonymous session out and sets this flag; the Landing
 * screen that mounts next consumes it and opens Login in sign-in mode, so the
 * user lands on the form rather than back on the start screen.
 *
 * Module state on purpose: it only has to survive the stack swap, never an
 * app restart.
 */
let pending = false;

export function requestSignInAfterSignOut(): void {
  pending = true;
}

export function consumePendingSignIn(): boolean {
  const was = pending;
  pending = false;
  return was;
}
