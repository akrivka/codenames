import mapUrl from '../assets/map.png'
import { Team, Role, CardBgColor, CardTextColor, BackButton, CardType } from "../index.jsx";
import { createSignal, onMount, For, Show, Switch, createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import { baseUrl } from "../index.jsx";
import axios from "axios";

const ConnectionStatus = {
  CONNECTED: "connected",
  CONNECTING: "connecting",
  ERROR: "error",
  DISCONNECTED: "disconnected",
}

function logEntryToText({ type, team, data }) {
  switch (type) {
    case "submit-code":
      return `${team}'s operatives revealed ${data.word}`
    case "submit-hint":
      return `${team}'s spymaster submitted hint ${data.clue} ${data.number}`
  }
}

function MapCard(props) {
  if (!props.card.location) return null

  const role = props.role
  const card = () => props.card

  const colorClass = () => CardBgColor[card().type]
  console.log(props.card)

  const roleClasses = () => role == Role.SPYMASTER ?
    `cursor-default ${colorClass()}`
    : `cursor-pointer hover:outline-white ${card().revealed ? colorClass() : "bg-gray-400"}`

  return <div class={`absolute -translate-x-1 rounded ${roleClasses()}`} style={{ left: `${card().location.xy.x * 100}%`, top: `${card().location.xy.y * 100}%` }}
  >{card().word}</div>
}

function Card(props) {
  const colorClass = () => ((props.role == Role.SPYMASTER) || props.card.revealed) ? CardBgColor[props.card.type] : "bg-gray-400"

  return <div class={`relative w-full h-12 py-1.5 px-1 rounded-sm shadow ${colorClass()} ${props.selected && "outline outline-orange-500"}`}
    onClick={props.select}>
    <span class="font-semibold tracking-wider text-[10px] break-words">{props.card.word}</span>
    <Show when={props.role == Role.SPYMASTER && props.card.revealed}>
      <div class="absolute left-0 top-0 w-full h-full bg-gray-700/80 z-10 "></div>
    </Show>
  </div>
}

function CardInfo(props) {
  const colorClass = () => props.card.revealed ? CardTextColor[props.card.type] : "text-gray-400"
  return <div class="border rounded p-2 bg-rose-900">
    <div class="flex">
      <div class="w-2/3">
        <div class="text-[10px] italic text-gray-300">Word</div>
        <div class="font-bold">{props.card.word}</div>
        <div class="h-4" />
        <div class="text-[10px] italic text-gray-300">Location</div>
        <div class="text-sm">{props.card.location.name}</div>
        <div class="h-2" />
        <div class="text-[10px] italic text-gray-300">Description</div>
        <div class="text-xs">{props.card.location.description}</div>
        <div class="h-1" />
      </div>
      <div class="relative w-1/3" onclick={() => props.mapBlowup()}>
        <img src={mapUrl} alt="" />
        <div class={`absolute w-12 h-12 -translate-x-6 -translate-y-12 ${colorClass()}`}
          style={{ left: `${props.card.location.xy.x * 100}%`, top: `${props.card.location.xy.y * 100}%` }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" strokeWidth={1.5} stroke="currentColor" className={`w-12 h-12`}>
            <g
              fill="currentColor" stroke="none">

              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </g>
            <g
              fill="white" stroke="none">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            </g>
          </svg>
        </div>
      </div>
    </div>
    <div class="mt-1 w-full text-[9px] italic text-gray-300 text-right">Click on map to enlarge</div>
  </div>
}

function NumberChooser({ number, setNumber }) {
  const [custom, setCustom] = createSignal(false)

  const Number = ({ i }) => (
    <button class={`w-8 h-8 text-sm flex justify-center items-center bg-gray-600 rounded ${i == number() && !custom() && "bg-orange-500"}`}
      onClick={() => { setNumber(i); setCustom(false); }}>
      {i}
    </button>)

  return <div class="flex space-x-2 relative">
    <Number i={1} />
    <Number i={2} />
    <Number i={3} />
    <button class={`w-10 h-8 text-sm flex justify-center items-center bg-gray-600 rounded ${custom() && "bg-orange-500"}`} onClick={() => { setCustom(true); setNumber(4) }}>4...</button>
    <Show when={custom()}>
      <input type="number" id="number" value={number()} onInput={(e) => setNumber(e.target.value)}
        class="w-12 h-8" />
    </Show>
  </div>
}

function MapFullscreen(props) {
  const colorClass = () => props.card.revealed ? CardTextColor[props.card.type] : "text-gray-400"

  return <div class="flex">
    <div class="relative">
      <img src={mapUrl} alt="" />
      <div class={`absolute w-12 h-12 -translate-x-6 -translate-y-12 ${colorClass()}`}
        style={{ left: `${props.card.location.xy.x * 100}%`, top: `${props.card.location.xy.y * 100}%` }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" strokeWidth={1.5} stroke="currentColor" className={`w-12 h-12`}>
          <g
            fill="currentColor" stroke="none">

            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </g>
          <g
            fill="white" stroke="none">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          </g>
        </svg>
      </div>
      <button class="primary-button shadow absolute right-8 top-8" onclick={props.goBack}>go back</button>
    </div>
  </div>
}

const primaryColor = {
  "red": "bg-red-500",
  "blue": "bg-blue-500"
}

const secondaryColor = {
  "red": "bg-red-700",
  "blue": "bg-blue-700"
}

function HintTable(props) {
  const otherTeam = props.team == Team.RED ? Team.BLUE : Team.RED;
  return <div>
    <div class="w-full bg-gray-400 text-center">clues</div>
    <div class="flex">
      <div class="w-1/2">
        <For each={props.hints[props.team]}>
          {({ clue, number }, i) => <div class={`pl-1 ${i() % 2 == 0 ? primaryColor[props.team] : secondaryColor[props.team]}`}>{clue} {number}</div>}
        </For>
      </div>
      <div class="w-1/2">
        <For each={props.hints[otherTeam]}>
          {({ clue, number }, i) => <div class={`pl-1 ${i() % 2 == 0 ? primaryColor[otherTeam] : secondaryColor[otherTeam]}`}>{clue} {number}</div>}
        </For>
      </div>
    </div>
  </div>
}

export default function Game(props) {
  // MAIN GAME IDENTIFIERS
  const roomName = props.user.roomName
  const team = props.user.team
  const role = props.user.role
  console.log(roomName, team, role)
  let roomId = null

  // GAME STATE
  const [stateLoaded, setStateLoaded] = createSignal(false)
  const [cards, setCards] = createStore([])
  const [turn, setTurn] = createStore({})
  const [hints, setHints] = createStore([])
  const [log, setLog] = createStore([])
  const [winner, setWinner] = createSignal(null)

  // DERIVED GAME STATE
  const teamCards = (team) => cards.filter((c) => (c.type == team && c.revealed) || (c.type == CardType.WILD && c.revealed == team)).length
  const teamScore = (team) => teamCards(team) - hints[team].length

  // GAME ACTIONS

  // WEBSOCKET
  var ws;
  const [connectionStatus, setConnectionStatus] = createSignal(ConnectionStatus.CONNECTING)

  async function connectToWebSocket() {
    if (ws) {
      ws.close();
    }
    setConnectionStatus(ConnectionStatus.CONNECTING)
    ws = new WebSocket(`ws://${baseUrl}/join-room/${roomName}?team=${team}}`)

    ws.onopen = function (m) {
      console.log("websocket connection open")
      setConnectionStatus(ConnectionStatus.CONNECTED)
    };
    ws.onerror = async function (m) {
      console.log("websocket error", m)
      setConnectionStatus(ConnectionStatus.ERROR)
    };
    ws.onmessage = async function (m) {
      const message = JSON.parse(m.data)
      const { type, data } = message;

      console.log("received", type, data)

      switch (type) {
        case "update-state":
          const state = JSON.parse(data.state)

          setCards(state.cards)
          setTurn(state.turn)
          setHints(state.hints);
          setLog(state.log)
          setWinner((state.winner && state.winner != null) ? state.winner : null)
          console.log(state)
          setStateLoaded(true)
          if (data.roomId) roomId = data.roomId
          break;
        case "error":
          console.log("error", data)
          break;
      }
    };
  }

  const send = async (type, data) => {
    // if connection closed
    if (ws.readyState == 3) {
      connectToWebSocket();
      await delay(20)
    }
    console.log("sending", type, roomId, data)
    ws.send(JSON.stringify({ type, roomId, team, ...(data || {}) }));
  }

  // SERVER TO USER ACTIONS

  // USER TO SERVER ACTIONS
  const submitHint = async () => {
    await send("submit-hint", { clue: clue(), number: number() })

    // clear
    setClue("")
    setNumber(1)
    document.getElementById("code").value = ""
  }
  const submitCode = async () => {
    const code = document.getElementById("code").value
    await send("submit-code", { code })
    // clear
    document.getElementById("code").value = ""
  }

  onMount(async () => {
    document.addEventListener("visibilitychange", () =>
      document.visibilityState == "visible" && connectToWebSocket());

    await connectToWebSocket()
  })

  // UI STATE
  const [clue, setClue] = createSignal("")
  const [number, setNumber] = createSignal(1)
  const [view, setView] = createSignal("board")
  const [selected, setSelected] = createSignal(null)
  const [mapFullscreen, setMapFullscreen] = createSignal(false);

  return <Show when={stateLoaded()} fallback="Loading...">
    <Show when={!mapFullscreen()} fallback={<MapFullscreen goBack={() => setMapFullscreen(false)} card={selected()} />}>
      <BackButton back={props.back} />
      <div class="pt-8 px-1">
        <div class="flex justify-between items-center">
          <div>
            Room name: {roomName}
            <div class="uppercase text-lg pr-2">
              {team} {role}
            </div>
            <div class="flex space-x-2">
              <button class={`px-2 py-1 ${view() == "board" ? "bg-orange-500" : "bg-gray-400"}`} onclick={() => setView("board")}>board</button>
              <button class={`px-2 py-1 ${view() == "map" ? "bg-orange-500" : "bg-gray-400"}`} onclick={() => setView("map")}>map</button>
            </div>
          </div>
          <div class="flex flex-col items-center justify-center mr-4 px-4 py-1 rounded bg-rose-900">
            <div class="text-[16px]">CARDS/HINTS</div>
            <div class="text-[32px] font-semibold">
              <span class="text-red-600">{teamCards(Team.RED)}/{hints[Team.RED].length}</span> : <span class="text-blue-600">{teamCards(Team.BLUE)}/{hints[Team.BLUE].length}</span>
            </div>
            <div class="text-gray-300 italic text-[10px]">Lowest number of hints to 10 cards wins</div>
          </div>
        </div>
        <div class="px-6 my-2 h-[1px] w-full bg-gray-300" />
        <Switch>
          <Match when={view() == "board"}>
            <div class="grid grid-cols-5 gap-1.5">
              <For each={cards}>{(card) => <Card card={card} role={role} select={() => setSelected(card)} selected={selected() && selected().word == card.word} />}</For>
            </div>
            <div class="text-gray-300 italic text-[9px]">Click on a card to view additional information</div>
            <div class="h-4" />
            <Switch>
              <Match when={winner()}>
                <div class="w-full text-center font-bold h-16 text-[24px]">
                  {winner() == "draw" ? "Game ended in a draw." : winner() == team ? "Game ended. You won!" : "Game ended. You lost."}
                </div>
              </Match>
              <Match when={teamCards(team) >= 10}>
                <div class="w-full text-center font-bold h-16 text-[24px]">
                  Waiting for the other team to reach 10 cards.
                </div>
              </Match>
              <Match when={role == Role.OPERATIVE}>
                <div class="flex justify-center space-x-1">
                  <input type="text" id="code" placeholder="code" class="w-24" />
                  <button class="primary-button" onClick={() => submitCode()}>submit</button>
                </div>
              </Match>
              <Match when={role == Role.SPYMASTER}>
                <div class="w-full p-1 flex">
                  <div class="w-1/2 flex flex-col items-center space-y-2">
                    <input id="clue" class="w-36" type="text" onKeyUp={(e) => {
                      if (e.key === "Enter") submitHint()
                      else setClue(e.target.value)
                    }} placeholder="Clue..." />
                    <NumberChooser number={number} setNumber={setNumber} />
                  </div>
                  <div class="w-1/2 flex flex-col items-center space-y-2">
                    <div class="h-6 font-extrabold text-xl">
                      <Show when={clue() != ""} fallback={<div class="h-6"></div>}>
                        {clue()} {number()}
                      </Show>
                    </div>
                    <button class="primary-button w-28" onClick={() => submitHint()}>submit hint</button>
                  </div>
                </div>
              </Match>
            </Switch>
            <div class="h-4" />
            <div class="min-h-full h-56 space-y-1">
              <div class="w-full flex">
                <div class="w-1/2 px-1">
                  <HintTable hints={hints} team={team} />
                </div>
                <div class="w-1/2 px-1">
                  {selected() && <CardInfo card={selected()} mapBlowup={() => setMapFullscreen(true)} />}
                </div>
              </div>
            </div>

            <div class="h-2"></div>
            <div class="min-h-full h-56 ml-4">
              <h2 class="text-sm font-gray-200">game log</h2>
              <For each={log}>{(entry) => (<div class="text-[8px] font-gray-400">
                {logEntryToText(entry)}
              </div>)}</For>
            </div>
          </Match>
          <Match when={view() == "map"}>
            <div class="w-full">
              <div class="mx-auto max-w-[600px] relative">
                <img src={mapUrl} alt="" />
                <For each={cards}>{(card) => <MapCard card={card} role={role} />}</For>
              </div>
            </div>
          </Match>
        </Switch>
      </div >
    </Show>
  </Show >
}