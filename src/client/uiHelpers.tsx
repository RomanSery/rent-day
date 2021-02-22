
import React from "react";
import { withStyles, Theme } from '@material-ui/core/styles';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';

import { SkillType } from "../core/enums/SkillType";
import {
  corruptionAdjustment,
  goToIsolationPosition,
  isolation_position,
  last_pos,
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


export const getElectricityTooltip = (player: Player | undefined, amount: string) => {
  if (!player) {
    return amount;
  }
  return (<HtmlTooltip
    title={
      <React.Fragment>
        <Typography color="inherit"><strong>Electricity per Turn</strong></Typography>
        {player.electricityTooltip}
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

const getSquareId = (row: string): number => {
  return parseInt(row.split(',')[0]);
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
                {game.theme[getSquareId(row)].name}
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
          <ListItemText primary="Lotto prize amounts are 25% higher" />
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
          <ListItemText primary="You are unemployed. Only collect $75 on payday" />
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

export const getMovementKeyFrames = (gameState: GameState, landedOnGoToIsolation: boolean, origPos: number, newPos: number): Array<PiecePosition> => {
  const frames: Array<PiecePosition> = [];

  if (landedOnGoToIsolation) {
    for (let i = origPos; i <= goToIsolationPosition; i++) {
      frames.push(getPiecePosition(gameState, i, 0));
    }
    for (let x = goToIsolationPosition - 1; x >= isolation_position; x--) {
      frames.push(getPiecePosition(gameState, x, 0));
    }
  } else if (origPos > newPos) {
    for (let i = origPos; i <= last_pos; i++) {
      frames.push(getPiecePosition(gameState, i, 0));
    }
    for (let i = 1; i <= newPos; i++) {
      frames.push(getPiecePosition(gameState, i, 0));
    }
  } else {
    for (let i = origPos; i <= newPos; i++) {
      frames.push(getPiecePosition(gameState, i, 0));
    }
  }
  return frames;
}



