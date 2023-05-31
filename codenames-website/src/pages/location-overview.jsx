import mapUrl from '../assets/map.png'
import { baseUrl } from "../index.jsx"
import { createSignal, onMount } from 'solid-js'
import { createStore } from 'solid-js/store'
import axios from "axios";

export default function LocationOverview() {
  const [locations, setLocations] = createStore([])
  const [loaded, setLoaded] = createSignal(false);

  onMount(async () => {
    const res = await axios.get(`http://${baseUrl}/get-locations`)
    console.log(res.data)
    setLocations(res.data)
    setLoaded(true)
  })
  return (
    <Show when={loaded()} fallback="Loading...">
      <For each={locations}>{(location) => <div>{location.name} | {location.description} | {location.code}</div>}</For>
    </Show>
  )
}