
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


const HtmlTooltip = withStyles((theme: Theme) => ({
  tooltip: {
    backgroundColor: '#f5f5f9',
    color: 'rgba(0, 0, 0, 0.87)',
    maxWidth: 220,
    fontSize: theme.typography.pxToRem(14),
    border: '1px solid #dadde9',
  },
}))(Tooltip);


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
          <ListItemText primary="Your taxes for each property you own are lowered by 50%" />
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

