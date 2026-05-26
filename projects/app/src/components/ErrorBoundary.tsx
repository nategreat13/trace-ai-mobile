import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";

/**
 * Generic render-error boundary.
 *
 * React error boundaries MUST be class components — there is no hook
 * equivalent for `componentDidCatch` / `getDerivedStateFromError`.
 *
 * When a wrapped subtree throws during render, instead of the error
 * propagating up and unmounting the whole React tree (blank screen /
 * apparent "crash"), this catches it and renders the error text on
 * screen. That does two things:
 *   1. The app stays alive — the user can read the error and back out.
 *   2. The actual error message + stack is visible, so a crash that
 *      only reproduces on a release device can finally be diagnosed
 *      without a cabled-up Mac.
 *
 * NOTE: this only catches JavaScript render errors. A true native
 * crash (missing native module, UIKit-level fault) terminates the
 * process before React sees anything — the boundary can't help there.
 * So: if the boundary's fallback shows, it's a JS bug and the text
 * tells you what. If the app still hard-crashes, it's native.
 */

interface Props {
  children: React.ReactNode;
  /** Optional label shown in the fallback header, e.g. "Diagnostics". */
  label?: string;
  /** Optional callback for a "Close" button in the fallback. */
  onClose?: () => void;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Also log so it shows up in `adb logcat` / Console.app even if
    // the user doesn't read the on-screen text.
    console.error(
      `[ErrorBoundary${this.props.label ? " " + this.props.label : ""}]`,
      error?.message,
      info?.componentStack
    );
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: "#0a0a0f" }}
        contentContainerStyle={{ padding: 24, paddingTop: 64 }}
      >
        <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 4 }}>
          {this.props.label ?? "Screen"} crashed
        </Text>
        <Text style={{ fontSize: 13, color: "#a1a1aa", marginBottom: 16 }}>
          This is the JavaScript error that took the screen down. Screenshot
          this and send it over.
        </Text>

        <Text style={{ fontSize: 12, fontWeight: "700", color: "#f59e0b", marginBottom: 4 }}>
          ERROR
        </Text>
        <Text
          selectable
          style={{ fontSize: 13, color: "#fff", fontFamily: "monospace", marginBottom: 16 }}
        >
          {String(error?.name ?? "Error")}: {String(error?.message ?? "(no message)")}
        </Text>

        <Text style={{ fontSize: 12, fontWeight: "700", color: "#f59e0b", marginBottom: 4 }}>
          STACK
        </Text>
        <Text
          selectable
          style={{ fontSize: 11, color: "#a1a1aa", fontFamily: "monospace", marginBottom: 24 }}
        >
          {String(error?.stack ?? "(no stack)")
            .split("\n")
            .slice(0, 16)
            .join("\n")}
        </Text>

        {this.props.onClose && (
          <Pressable
            onPress={this.props.onClose}
            style={{
              paddingVertical: 14,
              borderRadius: 10,
              backgroundColor: "#27272e",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Close</Text>
          </Pressable>
        )}
      </ScrollView>
    );
  }
}
