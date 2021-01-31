
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
      <ul>
        <li>lotto prize amounts are 25% higher</li>
        <li>start with luck 5</li>
        <li>you are unemployed, only collect $75 on payday</li>
      </ul>
    );
  } else if (type === PlayerClass.Conductor) {
    return (
      <ul>
        <li>rent from railroads you own is doubled</li>
        <li>start with negotiation 2</li>
      </ul>
    );
  } else if (type === PlayerClass.Governor) {
    return (
      <ul>
        <li>If you own Governors Island, rent is doubled and you dont have to pay any taxes on it.</li>
        <li>Start with corruption 2</li>
      </ul>
    );
  } else if (type === PlayerClass.Banker) {
    return (
      <ul>
        <li>Your taxes for each property you own are lowered by 50%</li>
        <li>You have a high paying job, collect $300 on payday</li>
      </ul>
    );
  }

  return (
    <React.Fragment>
    </React.Fragment>
  );
};

