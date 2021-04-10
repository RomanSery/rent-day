export enum GameEvent {
  CONNECT = "connect",
  DISCONNECT = "disconnect",
  JOINED_GAME = "joinedGame",
  JOIN_GAME_ROOM = "joinGameRoom",
  LEAVE_GAME = "leaveGame",
  UPDATE_GAME_STATE = "updateGameState",
  ROLL_DICE = "rollDiceEvent",
  ANIMATE_DICE = "animateDice",
  STOP_ANIMATE_DICE = "stopAnimateDice",

  AUCTION_BID = "auctionBid",
  AUCTION_UPDATE = "auctionUpdate",

  LOTTO_UPDATE = "lottoUpdate",

  SHOW_SNACK_MSG = "showSnackMsg",

  SEND_TRADE_OFFER = "sendTradeOffer",
  TRADE_OFFER_REVIEWED = "tradeOfferReviewed",

  SEND_CHAT_MSG = "sendChatMsg",
  NEW_CHAT_MSG = "newChatMsg",

  SHOW_MSG_FROM_SERVER = "showMsgFromServerEvent",

  SEND_CHANCE_EVENT = "showChanceEvent",
}
