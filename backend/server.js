import ws, { WebSocketServer } from "ws";
import { randomUUID } from "crypto"
const wss = new WebSocketServer({port : 8080});

const playerToSocket = new Map();
const socketToPlayer = new Map();
const rooms = new Map();
const playerToRoom = new Map();
const roomHosts = new Map();
const readyPlayers = new Map();
const roomState = new Map();
const gameData = new Map();
const gameTimers = new Map();
function endGame(roomId,winner){
  const game = gameData.get(roomId);
  if(!game || game.status !== "playing"){
    return ; 
  }
  game.status = "finished";
  roomState.set(roomId,"finished");
  const timer = gameTimers.get(roomId);
  if(timer){
    clearTimeout(timer);
    gameTimers.delete(roomId);
  }
  const roomMembers = rooms.get(roomId);
  if(!roomMembers){
    return;
  }
  for(const memberId of roomMembers){
    const memberSocket = playerToSocket.get(memberId);
    if(memberSocket && memberSocket.readyState === 1){
      memberSocket.send(JSON.stringify({
        type : "Game Over!",
        data : {
          winner,
          remainingHiders : game.remainingHiders,
          message : winner === "hunters" ? "Hunters Win!" : "Hiders Win!"
        }
      }));
    }
  }
}
function hunterNum(size) {
  if(size >= 2 && size <= 5){
    return 1;
  }
  if(size >= 3 && size <= 9){
    return 2;
  }
  return 0;
}
function shufflePlayers(playerIds){
  const shuffled = [...playerIds];

  for(let i = shuffled.length - 1;i >= 0;i--){
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i] ,shuffled[j]] = [shuffled[j] , shuffled[i]];
  }
  return shuffled;
}

function assignRoles(playerIds){
  const shuffledPlayers = shufflePlayers(playerIds);
  const totalHunters = hunterNum(playerIds.length);
  const roles = new Map();
  for(let i = 0;i < shuffledPlayers.length;i++){
    if(i < totalHunters){
      roles.set(shuffledPlayers[i],"hunter");
    } else{
      roles.set(shuffledPlayers[i],"hider");
    }
  }
  return {
    roles,
    totalHunters : totalHunters,
    remainingHiders : playerIds.length - totalHunters,
    caughtHiders : new Set(),
    removedHiders : new Set(),
    removedHunters : new Set(),
    startedAt : Date.now(),
    status : "playing",
    phase : "hiding",
  };
}
wss.on('connection', (socket) => {
  //1. Create Player Identity //
  const playerId = randomUUID();
  //  Store both Direction
  playerToSocket.set(playerId,socket);
  socketToPlayer.set(socket,playerId);
  console.log("Player Connected",playerId);


  // 2. Send Connected Message //
  const connectedMessage = {
    type : "connected",
    data : {
      playerId : playerId
    }
  };
  socket.send(JSON.stringify(connectedMessage));

  //  3. Handle Incoming Message //
  socket.on('message',(message) => {
    const playerId = socketToPlayer.get(socket);
    console.log("Message Received from :", playerId);
    const rawMessage = message.toString();
    let payload;
    //   4. Parse JSON ///
    try{
    payload = JSON.parse(rawMessage);
  }catch(error){
    socket.send(JSON.stringify({
      type : "error",
      data : {
        message : "Invalid JSON"
      }
    }));
    return;
  }
   // 5. Validate Message Structure //
    if (
           typeof payload !== "object" ||
            payload === null ||
            Array.isArray(payload) ||
            typeof payload.type !== "string" ||
            typeof payload.data !== "object" ||
            payload.data === null ||
            Array.isArray(payload.data)
        ) {

            socket.send(JSON.stringify({
                type: "error",
                data: {
                    message: "Invalid message format"
                }
            }));

            return;
        }

    // 6. Handle Message Type //
    if(payload.type == "echo"){
      if(typeof payload.data.message != "string"){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "Echo must be a string"
          }
        }));
        return;
      }
      console.log(`Player ${playerId} says :`,payload.data.message);
      // Send Response

      const response = {
        type : "echo-response",
        data :{
          message : payload.data.message
        }
      };
      socket.send(JSON.stringify(response));
      return;
    }
    if(payload.type == "create-room"){
      const playerId = socketToPlayer.get(socket);

      if(playerToRoom.has(playerId)){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "You already in a room"
          }
        }));
        return ;
      }
      const roomId = randomUUID();
      
      rooms.set(roomId , new Set([playerId]));
      readyPlayers.set(roomId, new Set());
      roomHosts.set(roomId,playerId);
      playerToRoom.set(playerId,roomId);
      roomState.set(roomId,"lobby");
      socket.send(JSON.stringify({
        type : "room-created",
        data : {
          roomId : roomId
        }
      }))
      return;
    }
    if(payload.type === "join-room"){
      const playerId = socketToPlayer.get(socket);
      const roomId = payload.data.roomId;
      
      if(typeof roomId !== "string" || roomId.trim() === ""){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "Invalid Room Id"
          }
        }));
        return;
      }
      if(playerToRoom.has(playerId)){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "You already in a room"
          }
        }));
        return;
      }
      const roomMembers = rooms.get(roomId);
      if(!roomMembers){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "Room not Found"
          }
        }));
        return;
      }
      const state = roomState.get(roomId);
      if(state !== "lobby"){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "Can not join room that has already started"
          }
        }));
        return;
      }
      roomMembers.add(playerId);
      playerToRoom.set(playerId,roomId);
      for(const memberId of roomMembers){
        const memberSocket = playerToSocket.get(memberId);
        if(memberSocket != socket){
          memberSocket.send(JSON.stringify({
            type : "player-joined",
            data : {
              playerId : playerId
            }
          }));
        }
      }
      socket.send(JSON.stringify({
        type : "room-joined",
        data : {
          roomId : roomId
        }
      }));
      return;
    }
     if(payload.type === "leave-room"){
        const playerId = socketToPlayer.get(socket);
        const roomId = playerToRoom.get(playerId);
        if(!roomId){
          socket.send(JSON.stringify({
            type : "error",
            data : {
              message : "You are not in a room"
            }
          }))
          return;
        }
        const readyState = readyPlayers.get(roomId);
        if(readyState){
        readyState.delete(playerId);
        }
        const roomMembers = rooms.get(roomId);

        roomMembers.delete(playerId);
        playerToRoom.delete(playerId);
         for(const memberId of roomMembers){
        const memberSocket = playerToSocket.get(memberId);
        if(memberSocket){
          memberSocket.send(JSON.stringify({
            type : "player-left",
            data : {
              playerId : playerId
            }
          }));
        }
      }
        if(roomMembers.size === 0){
          const timer = gameTimers.get(roomId);
          if(timer){
            clearTimeout(timer);
            gameTimers.delete(timer);
          }
          rooms.delete(roomId);
          roomHosts.delete(roomId);
          readyPlayers.delete(roomId);
        }else{
        const hostId = roomHosts.get(roomId);
        console.log("Current host",hostId);
        if(hostId === playerId){
          const newHostId = roomMembers.values().next().value;
          roomHosts.set(roomId,newHostId);
          for(const memberId of roomMembers){
          const memberSocket = playerToSocket.get(memberId);
          if(memberSocket){
          memberSocket.send(JSON.stringify({
          type : "host-changed",
          data : {
            hostId : newHostId,
          }
        }));
      }
      }
      console.log("New Host",newHostId);
      }
      }
        socket.send(JSON.stringify({
          type : "room-left",
          data : {
            playerId : playerId
          }
        }))
        return;
      }
    if(payload.type === "set-ready"){
        const playerId = socketToPlayer.get(socket);
        const roomId = playerToRoom.get(playerId);
        if(!roomId){
          socket.send(JSON.stringify({
            type : "error",
            data : {
              message : "You're not in a room"
            }
          }));
          return;
        }
        if(typeof payload.data?.ready !== "boolean"){
          socket.send(JSON.stringify({
            type : "error",
            data : {
              message : "Invalid Data!"
            }
          }));
          return;
        }
        const ready = payload.data.ready;
        if(typeof ready !== "boolean"){
          socket.send(JSON.stringify({
            type : "error",
            data : {
              message : "Invalid Format",
            }
          }))
          return;
        }
        const readyState = readyPlayers.get(roomId);
        console.log("Ready players:", [...readyState]);
        const roomMembers = rooms.get(roomId);
        if(!readyState || !roomMembers || !roomMembers.has(playerId)){
          socket.send(JSON.stringify({
            type : "error",
            data : {
              message : "No room members or room membership found!"
            }
          }));
          return;
        }
        if(roomState.get(roomId) !== "lobby"){
          socket.send(JSON.stringify({
            type : "error",
            data : {
              message : "You can not change readiness after game starts!"
            }
          }));
          return;
        }
        if(ready){
          readyState.add(playerId);
        }else{
          readyState.delete(playerId);
        }
        for(const memberId of roomMembers){
            const memberSocket = playerToSocket.get(memberId);
            if(memberSocket){
            memberSocket.send(JSON.stringify({
              type : "player-ready-changed",
              data : {
                playerId : playerId,
                ready : payload.data.ready
              }
            }));
          }
          }
         const roomMembersArr = [...roomMembers];
         const allReady = roomMembersArr.length > 0 && roomMembersArr.every(memberId => readyState.has(memberId));
         const readyCount = roomMembersArr.filter(memberId => readyState.has(memberId)).length;
         const totalPlayers = roomMembers.size;
         console.log("Room members:", [...roomMembers]);
         console.log("Ready players:", [...readyState]);
         console.log("Ready count:", readyCount);
         console.log("Total players:", totalPlayers);
         console.log("All ready:", allReady);
          for(const memberId of roomMembers){
            const memberSocket = playerToSocket.get(memberId);
            if(memberSocket){
              memberSocket.send(JSON.stringify({
                type : "lobby-status",
                data :{
                  readyCount : readyCount,
                  totalPlayers : totalPlayers,
                  allReady : allReady, 
                }
              }))
            }
          }
        return;
      }
    if(payload.type === "start-game"){
      const playerId = socketToPlayer.get(socket);
      const roomId = playerToRoom.get(playerId);
      if(!roomId || !playerId){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "You're not in a room"
          }
        }))
        return;
      }
      const roomMembers = rooms.get(roomId);
      if(!roomMembers || !roomMembers.has(playerId)){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "No room members or room membership found!"
          }
        }));
        return;
      }
      const state = roomState.get(roomId);
      if(state !== "lobby"){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "Game already started"
          }
        }));
        return;
      }
      const hostId = roomHosts.get(roomId);
      if(hostId !== playerId){
        socket.send(JSON.stringify({
          type : "error",
          data : {
             message : "You're not host"
          }
        }));
        return;
      }
      const readyState = readyPlayers.get(roomId);
      if(!readyState){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "No ready state found!"
          }
        }));
        return;
      }
      const roomMembersArr = [...roomMembers];
      const allReady = roomMembersArr.length > 0 && roomMembersArr.every(memberId => readyState.has(memberId));
      if(!allReady){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "All players not ready"
          }
        }));
        return;
      }

    if(roomMembersArr.length < 2) {
    socket.send(JSON.stringify({
        type: "error",
        data: {
            message: "At least 2 players are required"
        }
     }));
     return;
     }
      const game = assignRoles(roomMembersArr);
      gameData.set(roomId,game);
      roomState.set(roomId,"playing");
      const hideTimer = setTimeout(() => {
        const currentGame = gameData.get(roomId);
        if(!currentGame && currentGame !== "playing"){
          return;
        }
        currentGame.phase = "hunting";
        for(const memberId of roomMembers){
          const memberSocket = playerToSocket.get(memberId);
          if(memberSocket && memberSocket.readyState === 1){
            memberSocket.send(JSON.stringify({
              type : "hunting-started",
              data : {
                message : "Hunting Started!"
              }
            }));
          }
        }
        console.log("Hiding phase ended. Hunting started:", roomId);
        const hunterTimer = setTimeout(() => {
           const activeGame = gameData.get(roomId);
           if(activeGame && activeGame.status === "playing"){
           console.log("Ending game. Hiders win.");
            endGame(roomId,"hiders");
            }
      },60 * 1000);
        gameTimers.set(roomId,hunterTimer);
      },5 * 1000);
      gameTimers.set(roomId,hideTimer);
      console.log("Timer stored:", gameTimers.has(roomId));
      for(const memberId of roomMembers){
        const memberSocket = playerToSocket.get(memberId);
        if(memberSocket){
        memberSocket.send(JSON.stringify({
          type : "game-started",
          data : {
            roomId : roomId,
            hostId : playerId,
            role : game.roles.get(memberId),
            startedAt : game.startedAt
          }
        }));
      }
      }
    return;
    }

    if(payload.type === "catch-player"){
      const playerId = socketToPlayer.get(socket);
      const roomId = playerToRoom.get(playerId);
      if(!playerId || !roomId){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "You're not in a room!"
          }
        }));
        return;
      }
      const roomMembers = rooms.get(roomId);
      if(roomMembers.size === 0 || !roomMembers){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "Room members not found!"
          }
        }));
        return;
      }
      const roomMembersArr = [...roomMembers];
      if(!roomMembersArr.includes(playerId)){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "You're not part of the room!"
          }
        }));
        return;
      }
      const state = roomState.get(roomId);
      const gameState = gameData.get(roomId);
      if(!gameState){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "Game Data Not Found!"
          }
        }));
        return;
      }
      if(state !== "playing" || gameState.status !== "playing"){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "Game is not in playing State!"
          }
        }));
        return;
      }
      if(gameState.phase !== "hunting"){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "Hunting not Started!"
          }
        }));
        return;
      }
      const targetId = payload.data.targetId;
      if(!roomMembersArr.includes(targetId)){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "You're not in a same room"
          }
        }));
        return;
      }
      const isHunter = gameState.roles.get(playerId);
      const isHider = gameState.roles.get(targetId);
      if(isHunter !== "hunter" || isHider !== "hider"){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "Incorrect Request!"
          }
        }));
        return;
      }
      
      if(gameState.caughtHiders.has(targetId)){
        socket.send(JSON.stringify({
          type : "error",
          data : {
            message : "Player Already caughted!!"
          }
        }));
        return;
      }
      gameState.caughtHiders.add(targetId);
      gameState.remainingHiders -= 1;
      for(const memberId of roomMembers){
        const memberSocket = playerToSocket.get(memberId);
        if(memberSocket){
          memberSocket.send(JSON.stringify({
            type : "player-caught",
            data : {
              message : "Player Caught!",
              hunter : playerId,
              hider : targetId,
              remainingHiders : gameState.remainingHiders
            }
          }));
        }
      }
      if(gameState.remainingHiders === 0){
        endGame(roomId,"hunters");
      }
      return;
    }
    // 7. Unknown Message Type //
    socket.send(JSON.stringify({
      type : "error",
      data : {
        message : `Unknown Message Type : ${payload.type}`
      }
    }));

  });


  socket.on('close', () => {
    const playerId = socketToPlayer.get(socket);
    console.log("Player Disconnected :",playerId);
    const roomId = playerToRoom.get(playerId);
    const game = gameData.get(roomId);
    if(roomId){
      const roomMembers = rooms.get(roomId);
      const readyState = readyPlayers.get(roomId);
      if(roomMembers){
        playerToRoom.delete(playerId);
        roomMembers.delete(playerId);
        if(readyState){
        readyState.delete(playerId);
        }
        if(game && game.status === "playing"){
         const role = game.roles.get(playerId);
         if(role === "hider" && !game.caughtHiders.has(playerId) && !game.removedHiders.has(playerId)){
         game.removedHiders.add(playerId);
         game.remainingHiders -= 1;
         }
         if(role === "hunter" && !game.removedHunters.has(playerId)){
           game.removedHunters.add(playerId);
           game.totalHunters -= 1;
           if(game.totalHunters === 0){
            endGame(roomId,"hiders");
           }
         }
        }
        for(const memberId of roomMembers){
          const memberSocket = playerToSocket.get(memberId);
          if(memberSocket && memberSocket.readyState === 1){
          memberSocket.send(JSON.stringify({
            type : "player-disconnected",
            data : {
              playerId : playerId,
              remainingHiders : game?.remainingHiders ?? null,
            }
          }));
        }
        }
        if(game && game.status === "playing" && game.remainingHiders === 0){
          endGame(roomId,"hunters");
        }
        if(roomMembers.size === 0){
          const timer = gameTimers.get(roomId);
          if(timer){
            clearTimeout(timer);
            gameTimers.delete(timer);
          }
          gameData.delete(roomId);
          rooms.delete(roomId);
          roomHosts.delete(roomId);
          readyPlayers.delete(roomId);
          roomState.delete(roomId);
        }
        else{
        const hostId = roomHosts.get(roomId);
        if(hostId === playerId){
          const newHostId = roomMembers.values().next().value;
          roomHosts.set(roomId,newHostId);
          for(const memberId of roomMembers){
            const memberSocket = playerToSocket.get(memberId);
            if(memberSocket && memberSocket.readyState === 1){
            memberSocket.send(JSON.stringify({
              type : "host-changed",
              data : {
                hostId : newHostId,
              }
            }));
          }
          }
          console.log("New Host :",newHostId);
        }
      }
    }
  } 
    
    playerToSocket.delete(playerId);
    socketToPlayer.delete(socket);
    console.log("Client Disconnected");
  });

  socket.on('error',(err) => {
    console.log("Websocket Error:",err)
  });
});

console.log("Websocket Server is running on ws://localhost:8080")