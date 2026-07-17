// Global stylesheet import. Next.js requires app-wide CSS to be imported here
// (not via styled-jsx with external CSS variables, which failed to hash and
// dropped all styling — see styles/globals.css).
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
