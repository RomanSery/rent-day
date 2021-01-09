import React, { useEffect, useState } from "react";
import { TreasureState } from "../../core/types/TreasureState";
import { GameContext } from "../../core/types/GameContext";
import { GameState } from "../../core/types/GameState";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getMyUserId, getObjectIdAsHexString } from "../helpers";
import { SocketService } from "../sockets/SocketService";
import API from '../api';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import { Button, Container, TextField } from "@material-ui/core";
import { Bidder } from "../../core/types/Bidder";
import { faCheckSquare, faQuestion } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { GameEvent } from "../../core/types/GameEvent";
import { CircleLoader } from "./CircleLoader";
import { useIsMountedRef } from "./useIsMountedRef";


interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
}

export const DisplayTreasure: React.FC<Props> = ({ gameInfo, socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const [treasureState, setTreasureState] = useState<TreasureState>();
  const isMountedRef = useIsMountedRef();

  useEffect(() => {
    getAuctionState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isMountedRef.current) {
      socketService.listenForEvent(GameEvent.AUCTION_UPDATE, (data: AuctionState) => {
        setAuctionState(data);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getAuctionState = () => {
    if (!isMountedRef.current) {
      return;
    }
    API.post("getAuction", { auctionId: gameInfo?.auctionId, context })
      .then(function (response) {
        setAuctionState(response.data.auction);
      })
      .catch(function (error) {
        console.log(error);
      });
  };

  const isMe = (bidder: Bidder) => {
    const uid = getMyUserId();
    return areObjectIdsEqual(bidder._id, uid);
  }

  const isAuctionFinished = () => {
    return auctionState?.finished;
  }

  const alreadySubmittedBid = () => {
    const uid = getMyUserId();
    if (uid) {
      const myBid = auctionState?.bidders.find(b => areObjectIdsEqual(b._id, uid));
      return myBid && myBid.bid;
    }
    return false;
  }


  const getAuctionHeader = () => {
    const squareId = auctionState?.squareId;
    if (gameInfo && gameInfo.theme && squareId) {
      return "Auction - " + gameInfo.theme[squareId].name;
    }
    return "Auction";
  };

  const getSubHeader = () => {
    if (auctionState?.finished) {
      if (auctionState.isTie) {
        return "It's a tie, you all lose";
      }

      if (auctionState.winnerId) {
        const winner = auctionState.bidders.find(
          (b: Bidder) => areObjectIdsEqual(b._id, auctionState.winnerId)
        );
        return winner?.name + " wins!";
      }
      return "";
    }
    return "The player to bid the highest wins and pays the 2nd highest bid. In the event of a tie, no one wins";
  };

  const getNameStyle = (bidder: Bidder): React.CSSProperties => {
    return { color: bidder.color };
  };

  const onSubmitBid = async () => {
    API.post("actions/bid", { bid: myBid, context })
      .then(function (response) {
        if (socketService) {
          socketService.socket.emit(GameEvent.AUCTION_BID, context.gameId, auctionState?._id);
        }
      })
      .catch(function (error) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          alert(error.response.data);
        } else if (error.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          console.log(error.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          console.log('Error', error.message);
        }
      });

  };

  return (
    <React.Fragment>
      <Container maxWidth="sm" className="auction-container">
        <div className="auction-header">
          {getAuctionHeader()}
        </div>
        <div className="auction-sub-header">
          {getSubHeader()}
        </div>

        <TableContainer component={Paper} className="bid-table">
          <Table size="small" aria-label="a dense table">
            <TableBody>
              {auctionState?.bidders.map((row) => (
                <TableRow key={getObjectIdAsHexString(row._id)}>
                  <TableCell component="th" scope="row" style={getNameStyle(row)}>
                    {row.name}
                  </TableCell>
                  <TableCell align="right">
                    {isMe(row) && !isAuctionFinished() ? getInputField() : getBidderIcon(row)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {alreadySubmittedBid() ? null : <Button color="primary" variant="contained" onClick={onSubmitBid}>Submit Bid</Button>}

        {isAuctionFinished() ? <CircleLoader socketService={socketService} /> : null}
      </Container>

    </React.Fragment>
  );

};
