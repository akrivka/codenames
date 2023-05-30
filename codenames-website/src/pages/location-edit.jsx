import mapUrl from '../assets/map.png'
import { baseUrl } from "../index.jsx"
import { createSignal, onMount } from 'solid-js'
import { createStore } from 'solid-js/store'
import axios from "axios";

export default function LocationEdit() {
  const [locations, setLocations] = createStore([])
  const [currentLocation, setCurrentLocation] = createSignal(0)
  const [loaded, setLoaded] = createSignal(false);

  const maxId = () => Math.max(...locations.map((l) => l.id))
  const length = () => locations.length

  onMount(async () => {
    const res = await axios.get(`http://${baseUrl}/get-locations`)
    console.log(res.data)
    setLocations(res.data)

    setLoaded(true)
  })
  return (
    <Show when={loaded()} fallback="Loading...">
      <div class="p-2 space-x-2">
        <button class="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded" onClick={() => setCurrentLocation((i) => Math.max(i - 1, 0))}>{"<"}</button>
        <Switch>
          <Match when={currentLocation() == length() - 1}>
            <button class="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded" onClick={() => { setLocations([...locations, { id: maxId() + 1 }]); setCurrentLocation(i => i + 1); }}>{"+"}</button>
          </Match>
          <Match when={true}>
            <button class="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded" onClick={() => setCurrentLocation((i) => Math.min(i + 1, length()))}>{">"}</button>
          </Match>
        </Switch>
      </div>
      <div class="w-full">
        <div class="w-[900px] mx-auto flex">
          <div class="w-1/2 p-4 flex flex-col">
            <div class="text-[10px] text-gray-200 italic">id: {locations[currentLocation()].id}</div>
            <div class="flex flex-col">
              <span class="text-[10px] text-gray-200 italic">gps</span>
              <input onblur={(e) => setLocations(currentLocation(), "gps", e.target.value)} class="" value={locations[currentLocation()]?.gps}>{locations[currentLocation()]?.gps}</input>
            </div>
            <div class="flex flex-col">
              <span class="text-[10px] text-gray-200 italic">note</span>
              <input onblur={(e) => setLocations(currentLocation(), "note", e.target.value)} class="" value={locations[currentLocation()]?.note}>{locations[currentLocation()]?.note}</input>
            </div>
            <div class="flex flex-col">
              <span class="text-[10px] text-gray-200 italic">code</span>
              <input onblur={(e) => setLocations(currentLocation(), "code", e.target.value)} class="" value={locations[currentLocation()]?.code}>{locations[currentLocation()]?.code}</input>
            </div>
            <div class="flex flex-col">
              <span class="text-[10px] text-gray-200 italic">active</span>
              <input type="checkbox" onchange={(e) => setLocations(currentLocation(), "active", e.target.checked)} class="" value={locations[currentLocation()]?.active}>{locations[currentLocation()]?.active}</input>
            </div>
          </div>
          <div class="w-1/2 p-4">
            <div class="relative" onClick={(e) => {
              const rect = e.target.getBoundingClientRect()
              const x = e.clientX - rect.left
              const y = e.clientY - rect.top

              setLocations(currentLocation(), "xy", { x, y })
            }}>
              <img src={mapUrl} alt="" />
              <div class="absolute w-2 h-2 -translate-x-1 -translate-y-1 bg-green-500 rounded" style={{ left: `${locations[currentLocation()].xy.x}px`, top: `${locations[currentLocation()].xy.y}px` }} />
            </div>
          </div>
        </div>
        <div>
          <button class="primary-button" onClick={() => axios.post(`http://${baseUrl}/update-locations`, `locations=${encodeURIComponent(JSON.stringify(locations))}`, null)}>Save/send</button>
          <div>JSON to be sent</div>
          <pre>
            {JSON.stringify(locations, null, 2)}
          </pre>
        </div>
      </div>
    </Show>
  )
}