"use server";

import { redirect } from "next/navigation";
import { adminSignIn, adminSignOut } from "@/lib/server/admin";

export async function signIn(form: FormData) {
  const ok = await adminSignIn(String(form.get("password") ?? ""));
  redirect(ok ? "/admin" : "/admin?wrong=1");
}

export async function signOut() {
  await adminSignOut();
  redirect("/admin");
}
