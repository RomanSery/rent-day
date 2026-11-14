
import React from "react";
import { styled } from '@mui/material/styles';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { SkillType } from "../core/enums/SkillType";
import {
  corruptionAdjustment,
  luckAdjustment,
  negotiationAdjustment,
} from "../core/constants";
import { PlayerClass } from "../core/enums/PlayerClass";
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { faThumbsUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Player } from "../core/types/Player";
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { TableHead } from "@mui/material";
import { GameState } from "../core/types/GameState";
import { SquareConfigDataMap } from "../core/config/SquareData";
import { BoardSection } from "../core/enums/BoardSection";
import { PlayerState } from "../core/enums/PlayerState";
import { PiecePosition } from "../core/types/PiecePosition";


const HtmlTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: '#f5f5f9',
    color: 'rgba(0, 0, 0, 0.87)',
    fontSize: theme.typography.pxToRem(14),
    border: '1px solid #dadde9',
    maxWidth: 'none'
  },
}));


const getElectricityBreakdownTable = (game: GameState | undefined, electricityTooltip: string): React.JSX.Element => {
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

const getTaxBreakdownTable = (game: GameState | undefined, taxTooltip: string): React.JSX.Element => {
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
    <span>Total</span>
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

export const getSkillDescription = (type: SkillType): React.JSX.Element => {

  if (type === SkillType.Luck) {
    return (
      <React.Fragment>
        {"Each point "} <b>{"increases"}</b> {" your chance to win lotto prizes by "} <b>{luckAdjustment}</b>{"% percentage points"}
      </React.Fragment>
    );
  } else if (type === SkillType.Negotiation) {
    return (
      <React.Fragment>
        {"Each point "} <b>{"lowers"}</b> {" the rent you pay by "} <b>{negotiationAdjustment}</b>{"% percentage points"}
      </React.Fragment>
    );
  } else if (type === SkillType.Corruption) {
    return (
      <React.Fragment>
        {"Each point "} <b>{"lowers"}</b> {" your taxes & electricity costs per turn by "} <b>{corruptionAdjustment}</b>{"% percentage points"}
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
    </React.Fragment>
  );
};


export const getPlayerClassDescription = (type: string | undefined): React.JSX.Element => {

  if (type === PlayerClass.Gambler) {
    return (
      <List dense={true}>
        <ListItem>
          <ListItemIcon>
            <FontAwesomeIcon icon={faThumbsUp} size="2x" color="green" />
          </ListItemIcon>
          <ListItemText primary="Lotto prize amounts are 60% higher" />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <FontAwesomeIcon icon={faThumbsUp} size="2x" color="green" />
          </ListItemIcon>
          <ListItemText primary="Start with luck 2" />
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
          <ListItemText primary="Rent from subway stations you own is doubled" />
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

/** share of a grid cell a piece may fill */
const PIECE_FILL = 0.9;
/** pieces drawn smaller than this (px tall) are unreadable: show one piece and a count instead */
const MIN_PIECE_PX = 11;

/**
 * Size of a lone piece, read from the hidden probe GamePieces renders with the
 * same CSS as the pieces (the size follows the window). Icons are drawn at 2x
 * with a fixed width of 1.25em, so a piece is 2.5em wide and 2em tall.
 */
const basePieceSize = (): { w: number; h: number } => {
  const probe = document.querySelector(".piece-probe");
  const fontSize = probe ? parseFloat(getComputedStyle(probe).fontSize) : NaN;
  const f = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 16;
  return { w: 2.5 * f, h: 2 * f };
};

/**
 * Where piece `index` of `count` sits on a square. A crowded square is laid
 * out as a grid (whichever columns-by-rows lets the pieces be biggest, the last
 * row centred), shrinking the pieces only as far as needed to fit. When even
 * that would make them unreadably small (a phone with five or six players on
 * one square), a single piece is drawn with a "xN" badge.
 */
export const getSquarePieceLayout = (squareId: number, index: number, count: number): PiecePosition => {
  const square = document.getElementById('game-square-' + squareId);
  const rect: DOMRect = square!.getBoundingClientRect();
  const pad = Math.min(rect.width, rect.height) * 0.06;
  const w = rect.width - 2 * pad;
  const h = rect.height - 2 * pad;
  const base = basePieceSize();
  const n = Math.max(1, count);

  let best = { cols: 1, rows: 1, scale: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const scale = Math.min(1, (w / cols) * PIECE_FILL / base.w, (h / rows) * PIECE_FILL / base.h);
    if (scale > best.scale + 1e-6) {
      best = { cols, rows, scale };
    }
  }

  if (n > 1 && best.scale * base.h < MIN_PIECE_PX) {
    const scale = Math.min(1, w * PIECE_FILL / base.w, h * PIECE_FILL / base.h);
    return {
      top: rect.top + rect.height / 2, left: rect.left + rect.width / 2, bottom: rect.bottom, right: rect.right,
      scale, hidden: index > 0, badge: index === 0 ? n : undefined,
    };
  }

  const { cols, rows, scale } = best;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const inThisRow = row === rows - 1 ? n - cols * (rows - 1) : cols;
  const cellW = w / cols;
  const cellH = h / rows;
  const rowShift = ((cols - inThisRow) * cellW) / 2;

  return {
    top: rect.top + pad + cellH * (row + 0.5),
    left: rect.left + pad + rowShift + cellW * (col + 0.5),
    bottom: rect.bottom, right: rect.right, scale,
  };
};

export const getPiecePosition = (gameState: GameState, squareId: number, index: number): PiecePosition => {
  return getSquarePieceLayout(squareId, index, getNumPlayersOnSquare(gameState, squareId));
}

/**
 * Keyframe positions along a move: the piece's current spot, the middle of
 * each square it passes, and its spot among the players already on the square
 * it lands on (so it settles straight into place at its final size).
 */
export const getMovementKeyFrames = (
  moves: Array<number>,
  start?: PiecePosition,
  end?: { index: number; count: number }
): Array<PiecePosition> => {
  return moves.map((squareId, i) => {
    if (i === 0 && start) {
      return start;
    }
    if (i === moves.length - 1 && end) {
      return getSquarePieceLayout(squareId, end.index, end.count);
    }
    return getSquarePieceLayout(squareId, 0, 1);
  });
}





