
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
