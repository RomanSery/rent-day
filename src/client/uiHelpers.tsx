
import React from "react";
import { withStyles, Theme } from '@material-ui/core/styles';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';

import { SkillType } from "../core/enums/SkillType";
import {
  corruptionAdjustment,
  luckAdjustment,
  negotiationAdjustment,
} from "../core/constants";
import { PlayerClass } from "../core/enums/PlayerClass";
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import { faThumbsUp, faThumbsDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Player } from "../core/types/Player";
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import { TableHead } from "@material-ui/core";
import { GameState } from "../core/types/GameState";
import { SquareConfigDataMap } from "../core/config/SquareData";
import { BoardSection } from "../core/enums/BoardSection";
import { PlayerState } from "../core/enums/PlayerState";
import { PiecePosition } from "../core/types/PiecePosition";


const HtmlTooltip = withStyles((theme: Theme) => ({
  tooltip: {
    backgroundColor: '#f5f5f9',
    color: 'rgba(0, 0, 0, 0.87)',
    fontSize: theme.typography.pxToRem(14),
    border: '1px solid #dadde9',
    maxWidth: 'none'
  },
}))(Tooltip);


const getElectricityBreakdownTable = (game: GameState | undefined, electricityTooltip: string): JSX.Element => {
  if (electricityTooltip.length === 0 || !game) {
    return (
      <React.Fragment>
      </React.Fragment>
    );
  }

  if (electricityTooltip.indexOf(",") === -1 || electricityTooltip.indexOf("have to pay for") > 0) {
    return (
      <React.Fragment>{electricityTooltip}
      </React.Fragment>
    );
  }

  const rows = electricityTooltip.split(';');
  if (!rows || rows.length === 0 || electricityTooltip.indexOf(',') === -1) {
    return (
      <React.Fragment>{electricityTooltip}
      </React.Fragment>
    );
  }

  return (
    <TableContainer component={Paper} className="other-info">
      <Table size="small" aria-label="a dense table">
        <TableHead>
          <TableRow>
            <TableCell></TableCell>
            <TableCell align="right">Electricity</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.split(',')[0]}>
              <TableCell component="th" scope="row">
                {getSquareName(row, game)}
              </TableCell>
              <TableCell align="right">{row.split(',')[1]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};


export const getElectricityTooltip = (game: GameState | undefined, player: Player | undefined, amount: string) => {
  if (!player) {
    return amount;
  }
  return (<HtmlTooltip
    title={
      <React.Fragment>
        <Typography color="inherit"><strong>Electricity per Turn</strong></Typography>
        {getElectricityBreakdownTable(game, player.electricityTooltip)}
      </React.Fragment>
    }
  >
    <span>{amount}</span>
  </HtmlTooltip>);
}

export const getTaxTooltip = (game: GameState | undefined, player: Player | undefined, amount: string) => {
  if (!player) {
    return amount;
  }
  return (<HtmlTooltip
    title={
      <React.Fragment>
        <Typography color="inherit"><strong>Tax per Turn</strong></Typography>
        {getTaxBreakdownTable(game, player.taxTooltip)}
      </React.Fragment>
    }
  >
    <span>{amount}</span>
  </HtmlTooltip>);
}

const getSquareName = (row: string, game: GameState): string => {
  const squareId = parseInt(row.split(',')[0]);
  if (game.theme[squareId]) {
    return game.theme[squareId].name;
  }
  return "";
}

const getTaxBreakdownTable = (game: GameState | undefined, taxTooltip: string): JSX.Element => {
  if (taxTooltip.length === 0 || !game) {
    return (
      <React.Fragment>
      </React.Fragment>
    );
  }

  const rows = taxTooltip.split(';');

  return (
    <TableContainer component={Paper} className="other-info">
      <Table size="small" aria-label="a dense table">
        <TableHead>
          <TableRow>
            <TableCell></TableCell>
            <TableCell align="right">Tax</TableCell>
            <TableCell align="right">Adjusted</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.split(',')[0]}>
              <TableCell component="th" scope="row">
                {getSquareName(row, game)}
              </TableCell>
              <TableCell align="right">{row.split(',')[1]}</TableCell>
              <TableCell align="right">{row.split(',')[2]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};



export const getTotalAssetsTooltip = () => {
  return (<HtmlTooltip
    title={
      <React.Fragment>
        <Typography color="inherit"><strong>Total Assets</strong></Typography>
        Money + Total Mortgageable Value + value of all houses
      </React.Fragment>
    }
  >
    <span>Total Assets</span>
  </HtmlTooltip>);
}

export const getSkillTypeTooltip = (skill: SkillType) => {
  return (<HtmlTooltip
    title={
      <React.Fragment>
        <Typography color="inherit">{skill}</Typography>
        {getSkillDescription(skill)}
      </React.Fragment>
    }
  >
    <span>{skill}</span>
  </HtmlTooltip>);
}

const getSkillDescription = (type: SkillType): JSX.Element => {

  if (type === SkillType.Luck) {
    return (
      <React.Fragment>
        {"Each point "} <b>{"increases"}</b> {" your chance to win lotto prizes by "} <b>{luckAdjustment}</b>{"%"}
      </React.Fragment>
    );
  } else if (type === SkillType.Negotiation) {
    return (
      <React.Fragment>
        {"Each point "} <b>{"lowers"}</b> {" the rent you pay by "} <b>{negotiationAdjustment}</b>{"%"}
      </React.Fragment>
    );
  } else if (type === SkillType.Corruption) {
    return (
      <React.Fragment>
        {"Each point "} <b>{"lowers"}</b> {" your taxes per turn by "} <b>{corruptionAdjustment}</b>{"%"}
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
    </React.Fragment>
  );
};


export const getPlayerClassDescription = (type: string | undefined): JSX.Element => {

  if (type === PlayerClass.Gambler) {
    return (
      <List dense={true}>
        <ListItem>
          <ListItemIcon>
            <FontAwesomeIcon icon={faThumbsUp} size="2x" color="green" />
          </ListItemIcon>
          <ListItemText primary="Lotto prize amounts are 40% higher" />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <FontAwesomeIcon icon={faThumbsUp} size="2x" color="green" />
          </ListItemIcon>
          <ListItemText primary="Start with luck 2" />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <FontAwesomeIcon icon={faThumbsDown} size="2x" color="red" />
          </ListItemIcon>
          <ListItemText primary="You are unemployed. Only collect $100 on payday" />
        </ListItem>
      </List>
    );
  } else if (type === PlayerClass.Conductor) {
    return (
      <List dense={true}>
        <ListItem>
          <ListItemIcon>
            <FontAwesomeIcon icon={faThumbsUp} size="2x" color="green" />
          </ListItemIcon>
          <ListItemText primary="Rent from railroads you own is doubled" />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <FontAwesomeIcon icon={faThumbsUp} size="2x" color="green" />
          </ListItemIcon>
          <ListItemText primary="Start with negotiation 2" />
        </ListItem>
      </List>
    );
  } else if (type === PlayerClass.Governor) {
    return (
      <List dense={true}>
        <ListItem>
          <ListItemIcon>
            <FontAwesomeIcon icon={faThumbsUp} size="2x" color="green" />
          </ListItemIcon>
          <ListItemText primary="If you own Governors Island, rent is doubled and you dont have to pay any taxes on it." />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <FontAwesomeIcon icon={faThumbsUp} size="2x" color="green" />
          </ListItemIcon>
          <ListItemText primary="Start with corruption 2" />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <FontAwesomeIcon icon={faThumbsUp} size="2x" color="green" />
          </ListItemIcon>
          <ListItemText primary="Due to wide-spread corruption, you don't have to pay for any electricity costs" />
        </ListItem>
      </List>
    );
  } else if (type === PlayerClass.Banker) {
    return (
      <List dense={true}>
        <ListItem>
          <ListItemIcon>
            <FontAwesomeIcon icon={faThumbsUp} size="2x" color="green" />
          </ListItemIcon>
          <ListItemText primary="Your taxes for every property you own are lowered by 50%" />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <FontAwesomeIcon icon={faThumbsUp} size="2x" color="green" />
          </ListItemIcon>
          <ListItemText primary="You have a high paying job, collect $300 on payday" />
        </ListItem>
      </List>
    );
  }

  return (
    <React.Fragment>
    </React.Fragment>
  );
};


export const getNumPlayersOnSquare = (gameState: GameState, squareId: number) => {
  return gameState.players.filter((p) => p.position === squareId && p.state !== PlayerState.BANKRUPT).length;
}

const getTopPosition = (rect: DOMRect, section: BoardSection) => {
  if (section === BoardSection.Bottom) {
    return rect.top + (rect.height / 2);
  }
  if (section === BoardSection.Top) {
    return (rect.height / 4);
  }

  return rect.top;
}

const getLeftPosition = (rect: DOMRect, section: BoardSection, numOnSquare: number, index: number) => {
  let offset = 0;
  if (numOnSquare > 1 && index > 0) {
    const multiplier = numOnSquare === 2 ? 3 : (numOnSquare >= 4 ? 8 : 4);
    const divisionFactor = numOnSquare * multiplier;
    offset = (index * numOnSquare * (rect.width / divisionFactor));
  }


  if (section === BoardSection.Right) {
    return rect.left + (rect.width / 8) + offset;
  }

  return rect.left + offset;
}

export const getPiecePosition = (gameState: GameState, squareId: number, index: number): PiecePosition => {
  const numOnSquare = getNumPlayersOnSquare(gameState, squareId);
  const section: BoardSection = SquareConfigDataMap.get(squareId)?.section!;
  const square = document.getElementById('game-square-' + squareId);
  const rect: DOMRect = square!.getBoundingClientRect();


  const bottom = rect.bottom;
  const right = rect.right;

  return {
    top: getTopPosition(rect, section), left: getLeftPosition(rect, section, numOnSquare, index), bottom: bottom, right: right
  };
}

export const getMovementKeyFrames = (gameState: GameState, moves: Array<number>): Array<PiecePosition> => {
  const frames: Array<PiecePosition> = [];

  for (let i = 0; i < moves.length; i++) {
    const squareId = moves[i];
    frames.push(getPiecePosition(gameState, squareId, 0));
  }

  return frames;
}



export const getHelpContent = (): JSX.Element => {
  return (
    <div>
      <h4>PLAYER CLASSES</h4>

      <b>Gambler</b>
      <div className="player-class-description">
        {getPlayerClassDescription(PlayerClass.Gambler)}
      </div>

      <b>Conductor</b>
      <div className="player-class-description">
        {getPlayerClassDescription(PlayerClass.Conductor)}
      </div>

      <b>Governor</b>
      <div className="player-class-description">
        {getPlayerClassDescription(PlayerClass.Governor)}
      </div>

      <b>Banker</b>
      <div className="player-class-description">
        {getPlayerClassDescription(PlayerClass.Banker)}
      </div>

      <hr />

      <p>
        Each player must pick a 'player class' that suits their style of play.
        Each class gives you special perks, and sometimes some drawbacks.
          </p>
      <p>
        Each class starts with a different set of skill points.
        Make your decision carefully.
          </p>

      <hr />

      <h4>SKILL POINTS</h4>
      <p>
        Each player starts with <b>5</b> skill points that can be distributed among the three skills:
            <ul>
          <li>Negotiation - {getSkillDescription(SkillType.Negotiation)}</li>
          <li>Luck - {getSkillDescription(SkillType.Luck)}</li>
          <li>Corruption - {getSkillDescription(SkillType.Corruption)}</li>
        </ul>
      </p>
      <p>
        Some skills are much more beneficial for certain player classes than others,
        so distribute your points carefully.  For example, the gambler greatly benefits from Luck.
          </p>
      <p>
        You gain an additional skill point every time you pass PAYDAY.
          </p>

      <hr />

      <h4>AUCTIONS</h4>
      <p>
        Whenever a player lands on an unowned property, it immediately goes to auction.
            Each player places a bid and the highest bid wins the auction.  <b>The winner purchases the property for
            the amount of the 2nd highest bid.</b>
      </p>
      <p>
        This forces the other players to carefully consider their bids even if they are not interested in purchasing the property.
          </p>

      <hr />

      <h4>PROPERTY</h4>
      <p>
        The purchase price of a property is important, it will determine the mortgage amount which is <b>40% of the purchase price</b>.
          </p>
      <p>
        If you want to redeem the property in the future, it will cost you the <b>mortgage amount plus an additional 10%</b>.
          </p>
      <p>
        The cost of building houses on your property is listed on the property card.  Selling houses gives you back half of the build cost.
          </p>

      <hr />

      <h4>PROPERTY TAXES</h4>
      <p>
        Each property has a tax rate that you must pay <b>each turn you own that property</b> if it is unmortgaged.
          </p>
      <p>
        The amount of tax due is calculated as the <b>purchase price * the tax rate.</b>  Player
            classes and skills can effect the amount of taxes you owe.
            <br />
        <b>Property taxes are collected at the start of your turn.</b>
        <br />
        <b>You don't have to pay while you are in quarantine.</b>
      </p>
      <p>
        Pay special attention to the purchase price of properties, if you later acquire a property thru trade, you might be stuck with a hefty tax bill.
          </p>

      <hr />

      <h4>ELECTRICITY COSTS</h4>
      <p>
        In addition to property taxes, if you've built any houses on your properties you must pay electricity costs.
            <br />
            Each property has an electricity cost that you must pay<b> per house per turn</b>.
            <br />
        <b>Electricity costs are collected at the start of your turn.</b>
        <br />
        <b>You don't have to pay while you are in quarantine.</b>
      </p>

      <hr />

      <h4>COMPANIES</h4>
      <p>
        There are two companies available for purchase that can greatly help you depending on your player class.
            <br />
            Pay special attention to these and how they fit in with your play style!
          </p>
    </div>
  );
}


