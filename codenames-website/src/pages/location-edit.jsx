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

  const [sent, setSent] = createSignal(false)

  const save = async () => {
    await axios.post(`http://${baseUrl}/update-locations`, `locations=${encodeURIComponent(JSON.stringify(locations))}`, null);
    setSent(true)
    setTimeout(() => setSent(false), 200)
  }

  onMount(async () => {
    const res = await axios.get(`http://${baseUrl}/get-locations`)
    console.log(res.data)
    setLocations(res.data)
    setLoaded(true)
  })
  return (<>
    <div class="flex justify-between">
      <div class="p-2 space-x-2">
        <button class="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded" onClick={() => setCurrentLocation((i) => Math.max(i - 1, 0))}>{"<"}</button>
        <Switch>
          <Match when={currentLocation() == maxId() - 1}>
            <button class="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded" onClick={() => { setLocations([...locations, { id: maxId() + 1, xy: { x: 0, y: 0 }, code: "", note: "" }]); setCurrentLocation(i => i + 1); }}>{"+"}</button>
          </Match>
          <Match when={true}>
            <button class="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded" onClick={() => setCurrentLocation((i) => Math.min(i + 1, length()))}>{">"}</button>
          </Match>
        </Switch>
      </div>
      <Show when={sent()}>Saved!</Show>
    </div>
    <div class="w-full">
      <div class="w-[900px] mx-auto flex">
        <div class="w-1/2 p-4 flex flex-col">
          <div class="text-[10px] text-gray-200 italic">id: {locations[currentLocation()].id}</div>
          <div class="flex flex-col">
            <span class="text-[10px] text-gray-200 italic">name</span>
            <input onblur={(e) => { setLocations(currentLocation(), "name", e.target.value); save(); }} class="" value={locations[currentLocation()]?.name || ""}>{locations[currentLocation()]?.name || ""}</input>
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] text-gray-200 italic">description</span>
            <input onblur={(e) => { setLocations(currentLocation(), "description", e.target.value); save(); }} class="" value={locations[currentLocation()]?.description || ""}>{locations[currentLocation()]?.description || ""}</input>
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] text-gray-200 italic">code</span>
            <input onblur={(e) => { setLocations(currentLocation(), "code", e.target.value); save(); }} class="" value={locations[currentLocation()]?.code || ""}>{locations[currentLocation()]?.code || ""}</input>
          </div>
        </div>
        <div class="w-1/2 p-4">
          <div class="relative" onClick={(e) => {
            const rect = e.target.getBoundingClientRect()
            const x = (e.clientX - rect.left) / rect.width
            const y = (e.clientY - rect.top) / rect.height

            setLocations(currentLocation(), "xy", { x, y })
            save();
          }}>
            <img src={mapUrl} alt="" />
            <div class="absolute w-2 h-2 -translate-x-1 -translate-y-1 bg-green-500 rounded" style={{ left: `${locations[currentLocation()].xy.x * 100}%`, top: `${locations[currentLocation()].xy.y * 100}%` }} />
          </div>
        </div>
      </div>
      <div class="h-4" />
      <div>
        <pre>
          {JSON.stringify(locations, null, 2)}
        </pre>
      </div>
    </div>
  </>
  )
}