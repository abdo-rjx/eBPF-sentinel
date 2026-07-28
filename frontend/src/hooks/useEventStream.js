import { useEffect, useRef, useState } from 'react';

export function useEventStream(url, token) {
  const [windows, setWindows] = useState([]);
  const esRef = useRef(null);

  useEffect(() => {
    const es = new EventSource(`${url}?token=${encodeURIComponent(token)}`);
    esRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setWindows((prev) => [data, ...prev].slice(0, 200));
    };

    es.onerror = () => {
      console.warn('SSE connection error, browser will auto-reconnect');
    };

    return () => es.close();
  }, [url, token]);

  return windows;
}
