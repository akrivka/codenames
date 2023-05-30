import { useNavigate, useParams } from "@solidjs/router"
import { Team, Role } from "..";
import { BackButton } from "../index.jsx"
import Game from "./game";

function RoleButton({ team, role }) {
  const navigate = useNavigate();
  const params = useParams();
  const color = team == Team.RED ? "bg-red-500" : "bg-blue-500"
  const hoverColor = team == Team.RED ? "hover:bg-red-400" : "hover:bg-blue-400"

  const chooseRole = () => {
    localStorage.roomName = params.roomName
    localStorage.team = team
    localStorage.role = role

    location.reload()
  }

  return <div><button class={`px-2 py-1 rounded ${color} ${hoverColor}`} onClick={() => chooseRole()}>{role}</button></div>
}

export default function Lobby() {
  if (localStorage.roomName == useParams().roomName) {
    return <Game team={localStorage.team} role={localStorage.role} />
  }
  return <>
    <BackButton />
    <div class="w-full">
      <div class="w-[400px] mx-auto mt-16 flex flex-col items-center space-y-4">
        <div> Room: {useParams().roomName}
        </div>
        <div class="text-gray-100 text-[10px] italic">Join as...</div>
        <div class="w-full flex">
          <div class="w-1/2 my-4 mx-6 p-2 rounded space-y-2 bg-red-700 flex flex-col items-center">
            <div>RED</div>
            <RoleButton team={Team.RED} role={Role.OPERATIVE} />
            <RoleButton team={Team.RED} role={Role.SPYMASTER} />
          </div>
          <div class="w-1/2 my-4 mx-6 p-2 rounded space-y-2 bg-blue-700 flex flex-col items-center">
            <div>BLUE</div>
            <RoleButton team={Team.BLUE} role={Role.OPERATIVE} />
            <RoleButton team={Team.BLUE} role={Role.SPYMASTER} />
          </div>
        </div>
      </div>
    </div>
  </>
}