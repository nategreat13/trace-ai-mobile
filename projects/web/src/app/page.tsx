// Root. Middleware handles all the routing:
//   - Authed users hitting "/" get redirected to /analytics
//   - Unauthed users hitting "/" get redirected to /login
// This file exists so Next has SOMETHING to render if middleware ever
// short-circuits; in practice the redirect above always wins.

export default function RootPage() {
  return null;
}
