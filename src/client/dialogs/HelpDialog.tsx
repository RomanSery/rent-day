import React from "react";
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Button from '@material-ui/core/Button';
import { PlayerClass } from "../../core/enums/PlayerClass";
import { getPlayerClassDescription } from "../uiHelpers";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const HelpDialog: React.FC<Props> = ({ open, onClose }) => {

  return (
    <Dialog fullWidth={true} maxWidth="xl" onClose={onClose} aria-labelledby="help-dialog-title" open={open}>
      <DialogTitle id="help-dialog-title">Help</DialogTitle>
      <DialogContent>
        <div style={{ height: 400, width: '80%' }}>

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
              <li>Negotiation</li>
              <li>Luck</li>
              <li>Corruption</li>
            </ul>
          </p>
          <p>
            Some skills are much more benefical for certain player classes than others,
            so distribute your points carefully.  For example, the gambler greatly benefits from Luck.
          </p>
          <p>
            You gain an additional skill point every time you pass PAYDAY.
          </p>

          <hr />

          <h4>AUCTIONS</h4>
          <p>
            Whenever a player lands on an unowned property, it immediately goes to auction.
            Each player places a bid and the highest bid wins the autction.  <b>The winner purchases the property for
            the amount of the 2nd highest bid.</b>
          </p>
          <p>
            This forces the other players to carefully consider their bids even if they are not interested in purchasing the property.
          </p>

          <hr />

          <h4>PROPERTY</h4>
          <p>
            The purchase price of a property is important, it will determine the mortgage amount which is <b>30% of the purchase price</b>.
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
          </p>
          <p>
            Pay special attention to the purchase price of properties, if you later acquire a property thru trade, you might be stuck with a hefty tax bill.
          </p>

          <hr />

          <h4>ELECTRICITY COSTS</h4>
          <p>
            In addition to property taxes, if you've built any houses on your properties you must pay electricity costs.
            <br />
            This is calculated at a constant <b>$2 per house per turn</b>.
            <br />
            <b>Electricity costs are collected at the start of your turn.</b>
          </p>

          <hr />

          <h4>COMPANIES</h4>
          <p>
            There are two companies available for purchase that can greatly help you depending on your player class.
            <br />
            Pay special attention to these and how they fit in with your play style!
          </p>

        </div>

      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">Close</Button>
      </DialogActions>
    </Dialog>
  );

};
