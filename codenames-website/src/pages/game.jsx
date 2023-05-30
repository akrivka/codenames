import { Team, Role, CardColor, BackButton } from "../index.jsx";
import { createSignal, onMount, For, Show, Switch } from "solid-js";
import { createStore } from "solid-js/store";
import { useParams } from "@solidjs/router"
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
    case "reveal-card":
      return `${team}'s operatives revealed ${data.word}`
    case "submit-hint":
      return `${team}'s spymaster submitted hint ${data.clue} ${data.number}`
  }
}

function Card(props) {
  const role = props.role
  const card = () => props.card
  const enabled = () => props.enabled

  const colorClass = () => CardColor[card().type]

  const roleClasses = () => role == Role.SPYMASTER ?
    `cursor-default ${colorClass()}`
    : `cursor-pointer hover:outline-white ${card().revealed ? colorClass() : "bg-gray-400"}`



  return <div class={`relative w-full h-12 p-1.5 rounded-sm shadow ${roleClasses()}`}
    onClick={() => role == Role.OPERATIVE && enabled() && props.reveal()
    }>
    <div
      class="font-semibold tracking-wider">{card().word}
    </div>
    <Show when={card().revealed && role == Role.SPYMASTER}>
      <div
        class={`absolute left-0 top-0 w-full h-full bg-gray-700/80 z-10 `}>
      </div>
    </Show>
  </div >
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

export default function Game(props) {
  // MAIN GAME IDENTIFIERS
  const roomName = useParams().roomName
  const team = props.team
  const role = props.role
  const user = document.getElementById("username")?.value
  let roomId = null

  // GAME STATE
  const [stateLoaded, setStateLoaded] = createSignal(false)
  const [cards, setCards] = createStore([])
  const [turn, setTurn] = createStore({})
  const [hints, setHints] = createStore([])
  const [log, setLog] = createStore([])

  // DERIVED GAME STATE
  const currentHint = () => hints[team][hints[team].length - 1]

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
  }
  const revealCard = async (card) => {
    await send("reveal-card", { word: card.word })
  }
  const endTurn = async () => {
    await send("end-turn")
  }


  onMount(async () => {
    document.addEventListener("visibilitychange", () =>
      document.visibilityState == "visible" && connectToWebSocket());

    await connectToWebSocket()
  })

  // UI STATE
  const [clue, setClue] = createSignal("")
  const [number, setNumber] = createSignal(1)

  return (<>
    <BackButton />
    <div class="pt-8 px-1">
      <Show when={stateLoaded()}>
        <div class="grid grid-cols-5 gap-4">
          <For each={cards}>{(card) => <Card card={card} role={role} enabled={turn.team == team} reveal={() => revealCard(card)} />}</For>
        </div>
        <div class="h-4" />
        <div class="h-36 flex flex-col items-center space-y-1">
          <Switch>
            <Match when={turn.team != team}>
              <div class="text-[10px] italic text-gray-100">Waiting for other team</div>
            </Match>
            <Match when={turn.role != role}>
              <div class="text-[10px] italic text-gray-100">Waiting for your {turn.role}</div>
            </Match>
            <Match when={role == Role.OPERATIVE}>
              <div class="h-6 font-extrabold text-xl">
                {currentHint()?.clue} {currentHint()?.number}
              </div>
              <div class="h-6 text-[10px] text-gray-100 italic">Remaining guesses: {turn.param}</div>
              <button class="primary-button" onclick={() => endTurn()}>End turn</button>
            </Match>
            <Match when={role == Role.SPYMASTER}>
              <div class="space-y-2">
                <input class="w-56" type="text" onKeyUp={(e) => {
                  if (e.key === "Enter") submitHint()
                  else setClue(e.target.value)
                }} placeholder="Clue..." />
                <NumberChooser number={number} setNumber={setNumber} />
              </div>
              <div class="h-4" />

              <div class="h-6 font-extrabold text-xl">
                <Show when={clue() != ""} fallback={<div class="h-6"></div>}>
                  {clue()} {number()}
                </Show>
              </div>
              <div class="h-2" />
              <button class="primary-button" onClick={() => submitHint()}>submit hint</button>
            </Match>
          </Switch>
        </div>

        <div class="h-56 ml-4">
          <h2 class="text-lg">Game log</h2>
          <For each={log}>{(entry) => (<div class="text-[8px] font-gray-400">
                {logEntryToText(entry)}
          </div>)}</For>
        </div>
      </Show>
    </div >
  </>
  )
}