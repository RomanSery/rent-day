import { Manager, Socket } from "socket.io-client";
import { PageType } from "../../core/enums/PageType";
import { GameEvent } from "../../core/types/GameEvent";
import { getMyPlayerName, getMyUserId, hasJoinedGame } from "../helpers";

interface GameClientSocket extends Socket {
  playerName?: string;
  userId?: string;
  gameId?: string;
}

export class SocketService {
  private pageType: PageType;
  private manager: Manager;
  public socket: GameClientSocket;

  private gameId: string | null;

  constructor(type: PageType, gameId: string | null, uri: string) {
    console.log("initiating socket service: " + uri);
    this.gameId = gameId;

    this.manager = new Manager(uri, {
      withCredentials: true,
      rememberUpgrade: true,
    });
    this.socket = this.manager.socket("/");
    this.pageType = type;

    if (this.pageType === PageType.Join) {
      if (
        hasJoinedGame() &&
        getMyPlayerName() !== null &&
        getMyUserId() !== null
      ) {
        this.socket.emit(GameEvent.JOINED_GAME, {
          playerName: getMyPlayerName()!,
          userId: getMyUserId()!,
          gameId: this.gameId,
          allJoined: false,
        });
      }
    }

    if (this.gameId && this.gameId !== null) {
      this.socket.emit(
        GameEvent.JOIN_GAME_ROOM,
        this.gameId,
        getMyUserId(),
        getMyPlayerName()
      );
    }
  }

  public listenForEvent(event: GameEvent, fn: Function): void {
    this.socket.on(event, fn);
  }

  // disconnect - used when unmounting
  public disconnect(): void {
    this.socket.disconnect();
  }
}
