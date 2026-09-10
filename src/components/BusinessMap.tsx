import { useMemo, useRef, useState } from "react";
import { APIProvider, Map, Marker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { LocateFixed, Search } from "lucide-react";
import type { Customer, Job } from "../types/business";

type Props = { customers: Customer[]; jobs: Job[]; onJob: (job: Job) => void };
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";

function MapContents({ customers, jobs, onJob }: Props) {
  const map = useMap();
  const library = useMapsLibrary("geocoding");
  const geocoder = useMemo(() => library ? new library.Geocoder() : null, [library]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Job | null>(null);
  const [point, setPoint] = useState<google.maps.LatLngLiteral | null>(null);
  const [location, setLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const request = useRef(0);
  const matches = query.trim() ? jobs.filter(job => `${customers.find(c => c.id === job.customerId)?.name ?? ""} ${job.address}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : [];

  async function find(address: string, job: Job | null = null) {
    if (!geocoder || !map || !address.trim()) return;
    const id = ++request.current;
    setBusy(true); setError("");
    try {
      const result = await geocoder.geocode({ address: address.trim() });
      if (id !== request.current) return;
      const hit = result.results[0];
      if (!hit) throw new Error("No matching address found.");
      const position = hit.geometry.location.toJSON();
      setPoint(position); setSelected(job); setQuery("");
      map.panTo(position); map.setZoom(17);
    } catch {
      if (id === request.current) setError("Address lookup failed. Try a full address including city, or check the Google Maps key and Geocoding API.");
    } finally { if (id === request.current) setBusy(false); }
  }

  function locate() {
    if (!navigator.geolocation) { setError("Location is unavailable in this browser."); return; }
    const id = ++request.current;
    setBusy(true); setError("");
    navigator.geolocation.getCurrentPosition(position => {
      if (id !== request.current) return;
      const next = { lat: position.coords.latitude, lng: position.coords.longitude };
      setLocation(next); map?.panTo(next); map?.setZoom(16); setBusy(false);
    }, () => { if (id === request.current) { setError("Unable to get location. Check your browser location permission."); setBusy(false); } }, { timeout: 15000, maximumAge: 60000 });
  }

  return <>
    {point && <Marker position={point} title={selected?.address ?? "Searched address"} onClick={() => selected && onJob(selected)} />}
    {location && <Marker position={location} label="You" title="Your location when requested" />}
    <div className="absolute left-3 right-3 top-3 z-10 max-w-lg">
      <form className="flex min-w-0 gap-2 rounded-lg bg-white p-2 shadow-md dark:bg-slate-900" onSubmit={event => { event.preventDefault(); void find(query); }}>
        <input aria-label="Search jobs or addresses" placeholder="Name or address" value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-ink dark:bg-slate-950 dark:text-white" />
        <button className="icon-button shrink-0" type="submit" title="Search address" aria-label="Search address" disabled={busy || !geocoder || !query.trim()}><Search size={20} /></button>
        <button className="icon-button shrink-0" type="button" title="Find my location" aria-label="Find my location" disabled={busy || !map} onClick={locate}><LocateFixed size={20} /></button>
      </form>
      {matches.length > 0 && <div className="mt-1 max-h-64 overflow-y-auto rounded-lg bg-white shadow-md dark:bg-slate-900">{matches.map(job => <button type="button" key={job.id} disabled={busy || !geocoder} className="block w-full border-b border-slate-200 p-3 text-left text-sm text-ink dark:text-white" onClick={() => void find(job.address, job)}><strong className="block break-words">{customers.find(c => c.id === job.customerId)?.name ?? "Customer"}</strong><span className="block break-words">{job.address} · {job.date || "Unscheduled"}</span></button>)}</div>}
      {busy && <p role="status" className="mt-2 rounded-lg bg-white p-3 text-sm text-ink">Finding location...</p>}
      {error && <p role="alert" className="mt-2 rounded-lg bg-white p-3 text-sm text-rose-700">{error}</p>}
      {selected && !query && <button type="button" onClick={() => onJob(selected)} className="mt-2 w-full rounded-lg bg-white p-3 text-left text-sm text-ink shadow-md"><strong className="block">{customers.find(c => c.id === selected.customerId)?.name ?? "Customer"}</strong>{selected.address} · {selected.date || "Unscheduled"}</button>}
    </div>
  </>;
}

export function BusinessMap(props: Props) {
  const [loadError, setLoadError] = useState(false);
  if (!apiKey || loadError) return <div role="status" className="py-12"><h2 className="text-xl font-bold">{loadError ? "Google Maps could not load" : "Google Maps needs an API key"}</h2><p className="mt-3 break-words">{loadError ? "Check the Google Maps key and allowed website addresses, then reload." : "Set VITE_GOOGLE_MAPS_API_KEY in Render and rebuild the website to enable the map."}</p></div>;
  return <APIProvider apiKey={apiKey} onError={() => setLoadError(true)}><div className="relative h-[65dvh] min-h-[420px] w-full min-w-0 overflow-hidden rounded-lg"><Map defaultCenter={{ lat: 39.8283, lng: -98.5795 }} defaultZoom={4} gestureHandling="cooperative" disableDefaultUI zoomControl><MapContents {...props} /></Map></div></APIProvider>;
}
