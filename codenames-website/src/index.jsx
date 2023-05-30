/* @refresh reload */
import Lobby from './pages/lobby';
import Game from './pages/game';
import { render } from 'solid-js/web';
import { Router, Route, Routes, useNavigate } from "@solidjs/router";
import axios from "axios";
import './index.css';

export const CardType = {
    RED: "red",
    BLUE: "blue",
    NEUTRAL: "neutral",
    ASSASSIN: "assassin"
}

export const CardColor = {
    [CardType.RED]: "bg-red-500",
    [CardType.BLUE]: "bg-blue-500",
    [CardType.NEUTRAL]: "bg-gray-500",
    [CardType.ASSASSIN]: "bg-black",
  }
  

export const Team = {
    RED: "red",
    BLUE: "blue"
}

export const Role = {
    OPERATIVE: "operative",
    SPYMASTER: "spymaster"
}

export const baseUrl = "localhost:8000"


function Codenames() {
    const navigate = useNavigate()

    const join = async () => {
        const roomName = document.getElementById("roomName").value;
        await axios.post(`http://${baseUrl}/create-room`, null, { params: { roomName } })
        navigate(`/${roomName}`);
    }

    return <div class="w-full flex flex-col items-center justify-center space-y-4 pt-16">
        <h1 class="font-['SkyFall_Done_Regular'] text-[32px]">CODENAMES</h1>
        <div class="text-gray-100 text-[10px] italic">Enter a room name to join a room. If the room doesn't exist it'll be created.</div>
        <div class="space-x-2">
            <input class="px-2 py-1 rounded text-black" type="text" id="roomName" onKeyDown={(e) => e.key === "Enter" && join()} />
            <button class="primary-button" onClick={join}>
                Join room
            </button>
        </div>
    </div>
}

export function BackButton() {
    const navigate = useNavigate()

    const leaveRoom = () => {
        localStorage.roomName = null
        localStorage.team = null
        localStorage.role = null

        navigate("/")
    }    
    // always in top left corner of screen
    return <div class="absolute top-0 left-0">
        <button class="text-orange-600 text-[8px] pl-1" onClick={() => leaveRoom()}>
            LEAVE ROOM
        </button>
    </div>
}

function Index() {
    var user = document.getElementById("username")?.value

    return (
        <Router>
            <Routes>
                <Route path="/" component={Codenames} />
                <Route path="/:roomName" component={Lobby} />
                <Route path="/:roomName/red-operative" element={<Game team={Team.RED} role={Role.OPERATIVE} />} />
                <Route path="/:roomName/red-spymaster" element={<Game team={Team.RED} role={Role.SPYMASTER} />} />
                <Route path="/:roomName/blue-operative" element={<Game team={Team.BLUE} role={Role.OPERATIVE} />} />
                <Route path="/:roomName/blue-spymaster" element={<Game team={Team.BLUE} role={Role.SPYMASTER} />} />
            </Routes>
        </Router>
    )
}

render(() => <Index />, document.getElementById('root'));
