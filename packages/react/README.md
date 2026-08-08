# @whorlid/react

A React hook for [@whorlid/whorlid](https://github.com/WhorlID/WhorlID): a visitor id for
the current browser, computed locally with no backend.

```bash
npm install @whorlid/react
```

```jsx
import { useVisitorId } from '@whorlid/react';

function Example() {
  const { visitorId, confidence, isLoading, error } = useVisitorId();

  if (isLoading) return <p>Identifying…</p>;
  if (error) return <p>Could not identify this browser.</p>;
  return <p>{visitorId} ({confidence})</p>;
}
```

Collection runs once per mount, not on every render, and passing a fresh options
object each render does not re-trigger it.

To use server-side matching instead of a local hash, pass a key:

```jsx
const { visitorId, data } = useVisitorId({ publicKey: 'pk_live_…' });
// data.similarity, data.isReturning, data.requestId
```

`react >= 17` is a peer dependency. Full documentation, the signal list, and the
honest limits of a locally computed id are in the
[main README](https://github.com/WhorlID/WhorlID#readme).

MIT licensed.
