export enum GameEvent {
  CONNECT = "connect",
  DISCONNECT = "disconnect",
  GET_LATENCY = "getLatency",
  JOINED_GAME = "joinedGame",
  JOIN_GAME_ROOM = "joinGameRoom",
  LEAVE_GAME = "leaveGame",
  UPDATE_GAME_STATE = "updateGameState",
  ROLL_DICE = "rollDiceEvent",
  ANIMATE_DICE = "animateDice",

  AUCTION_BID = "auctionBid",
  AUCTION_UPDATE = "auctionUpdate",

  LOTTO_UPDATE = "lottoUpdate",

  SHOW_SNACK_MSG = "showSnackMsg",

  SEND_TRADE_OFFER = "sendTradeOffer",
}
