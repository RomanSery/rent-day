import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { GameContext } from "../../core/types/GameContext";
import { GameState } from "../../core/types/GameState";
import { getGameContextFromUrl } from "../api";
import API from '../api';
import { Player } from "../../core/types/Player";
import { useForm, SubmitHandler } from "react-hook-form";
import { PieceType } from "../../core/enums/PieceType";
import { SocketService } from "../sockets/SocketService";


interface Props {

}

type Inputs = {
  playerName: string;
  piece: PieceType;
};

export const JoinGame: React.FC<Props> = () => {

  const location = useLocation();
  const context: GameContext = getGameContextFromUrl(location.search);

  const [gameState, setGameState] = useState<GameState>();

  useEffect(() => {
    getGameState();
  }, [context.gameId, context.playerId]);

  useEffect(() => {
    const socket = new SocketService();
    socket.init();

    socket.send({ author: "roman", message: "im connected" });

    return () => socket.disconnect();
  }, []);


  const { register, handleSubmit, errors } = useForm<Inputs>();

  const getGameState = () => {
    API.post("getGame", { gameId: context.gameId })
      .then(function (response) {
        setGameState(response.data.game);
      })
      .catch(function (error) {
        console.log(error);
      });
  };


  const onJoinGame: SubmitHandler<Inputs> = (data) => {

    API.post("joinGame", { gameId: context.gameId, name: data.playerName, piece: data.piece })
      .then(function (response) {
        console.log(response.data);
        getGameState();
      })
      .catch(function (error) {
        console.log(error);
      });

  };

  return (
    <React.Fragment>
      <div>
        <p>
          name: {gameState?.name}
        </p>
        <p>
          max players: {gameState?.numPlayers}
        </p>
        <p>
          num joined: {gameState?.players.length}
        </p>
        <div className="players-display">
          {gameState?.players.map((p: Player, index) => {
            return (<p>player: {p.name}</p>)
          })}
        </div>


        <form onSubmit={handleSubmit(onJoinGame)}>
          <label>Name</label>
          <input
            name="playerName"
            ref={register({ required: true, maxLength: 10, minLength: 4 })}
          />
          {errors.playerName && <p>This field is required</p>}

          <label>Piece Type</label>
          <select name="piece" ref={register({ required: true })}>
            <option value="1">Pawn</option>
            <option value="2">Hat</option>
            <option value="3">Car</option>
            <option value="4">Bicycle</option>
            <option value="5">Cat</option>
            <option value="6">Dog</option>
          </select>
          {errors.piece && <p>This field is required</p>}

          <input type="submit" value="Join" />
        </form>

      </div>

    </React.Fragment>
  );
}
