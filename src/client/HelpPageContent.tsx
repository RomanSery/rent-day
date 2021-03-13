import { Typography } from "@material-ui/core";
import React from "react";



interface Props {

}

export const HelpPageContent: React.FC<Props> = () => {

  return (
    <div className="help-page-cont">

      <Typography component="h2" variant="h5">Rent Day Rules</Typography>

      <h4>OBJECT</h4>
      <p>
        The object of the game is to become the wealthiest player
        through buying, renting and selling property.
      </p>


      <h4>THE BANK…</h4>
      <p>
        Besides the Bank’s money, the Bank holds the Title Deed
        cards and houses and hotels prior to purchase and use by the players.
        The Bank pays salaries and bonuses. It sells and auctions properties
        and hands out their proper Title Deed cards; it sells houses and hotels
        to the players and loans money when required on mortgages.
        The Bank collects all taxes, fines, loans and interest, and the price of
        all properties which it sells and auctions.
        The Bank never “goes broke.” If the Bank runs out of money, the
        Banker may issue as much more as may be needed by writing on any
        ordinary paper.
      </p>

      <h4>THE PLAY…</h4>
      <p>
        Starting with the Banker, each player in turn throws the
        dice. The player with the highest total starts the play: Place your token
        on the corner marked “GO,” throw the dice and move your token in
        the direction of the arrow the number of spaces indicated by the dice.
        After you have completed your play, the turn passes to the left. The
        tokens remain on the spaces occupied and proceed from that point on
        the player’s next turn. Two or more tokens may rest on the same space
        at the same time.
        According to the space your token reaches, you may be entitled to
        buy real estate or other properties — or obliged to pay rent, pay taxes,
        draw a Chance or Community Chest card, “Go to Jail ®,” etc.
        If you throw doubles, you move your token as usual, the sum of the
        two dice, and are subject to any privileges or penalties pertaining to
        the space on which you land. Retaining the dice, throw again and
        move your token as before. If you throw doubles three times in
        succession, move your token immediately to the space marked “In
      </p>

      <h4>“GO”…</h4>
      <p>
        Each time a player’s token lands on or passes over GO,
        whether by throwing the dice or drawing a card, the Banker pays
        him/her a $200 salary.
        The $200 is paid only once each time around the board. However, if
        a player passing GO on the throw of the dice lands 2 spaces beyond it
        on Community Chest, or 7 spaces beyond it on Chance, and draws the
        “Advance to GO” card, he/she collects $200 for passing GO the first
        time and another $200 for reaching it the second time by instructions
        on the card.
      </p>

      <h4>BUYING PROPERTY…</h4>
      <p>
        Whenever you land on an unowned property
        you may buy that property from the Bank at its printed price. You
        receive the Title Deed card showing ownership; place it face up in
        front of you.
        If you do not wish to buy the property, the Banker sells it at auction
        to the highest bidder. The buyer pays the Bank the amount of the bid
        in cash and receives the Title Deed card for that property. Any player,
        including the one who declined the option to buy it at the printed
        price, may bid. Bidding may start at any price.
      </p>

      <h4>PAYING RENT…</h4>
      <p>
        When you land on property owned by another
        player, the owner collects rent from you in accordance with the list
        printed on its Title Deed card.
        If the property is mortgaged, no rent can be collected. When a
        property is mortgaged, its Title Deed card is placed face down in front
        of the owner.
        It is an advantage to hold all the Title Deed cards in a color-group
        (e.g., Boardwalk and Park Place; or Connecticut, Vermont and Oriental
        Avenues) because the owner may then charge double rent for
        unimproved properties in that color-group. This rule applies to
        unmortgaged properties even if another property in that color-group
        is mortgaged.
        It is even more advantageous to have houses or hotels on properties
        because rents are much higher than for unimproved properties.
        The owner may not collect the rent if he/she fails to ask for it before
        the second player following throws the dice.
      </p>

      <h4>“JAIL”…</h4>
      <p>
        You land in Jail when… (1) your token lands on the space
        marked “Go to Jail”; (2) you draw a card marked “Go to Jail”; or
        (3) you throw doubles three times in succession.
        When you are sent to Jail you cannot collect your $200 salary in that
        move since, regardless of where your token is on the board, you must
        move it directly into Jail. Yours turn ends when you are sent to Jail.
        If you are not “sent” to Jail but in the ordinary course of play land
        on that space, you are “Just Visiting,” you incur no penalty, and you
        move ahead in the usual manner on your next turn.
        You get out of Jail by… (1) throwing doubles on any of your next
        three turns; if you succeed in doing this you immediately move
        forward the number of spaces shown by your doubles throw; even
        though you had thrown doubles, you do not take another turn;
        (2) using the “Get Out of Jail Free” card if you have it; (3) purchasing
        the “Get Out of Jail Free” card from another player and playing it;
        (4) paying a fine of $50 before you roll the dice on either of your next
        two turns.
        If you do not throw doubles by your third turn, you must pay the
        $50 fine. You then get out of Jail and immediately move forward the
        number of spaces shown by your throw.
        Even though you are in Jail, you may buy and sell property, buy
        and sell houses and hotels and collect rents.
      </p>

      <h4>HOUSES…</h4>
      <p>
        When you own all the properties in a color-group you
        may buy houses from the Bank and erect them on those properties.
        If you buy one house, you may put it on any one of those
        properties. The next house you buy must be erected on one of the
        unimproved properties of this or any other complete color-group you
        may own.
        The price you must pay the Bank for each house is shown on your
        Title Deed card for the property on which you erect the house.
        The owner still collects double rent from an opponent who lands on
        the unimproved properties of his/her complete color-group.
        Following the above rules, you may buy and erect at any time as
        many houses as your judgement and financial standing will allow. But
        you must build evenly, i.e., you cannot erect more than one house on
        any one property of any color-group until you have built one house on
        every property of that group. You may then begin on the second row
        of houses, and so on, up to a limit of four houses to a property. For
        example, you cannot build three houses on one property if you have
        only one house on another property of that group.
        As you build evenly, you must also break down evenly if you sell
        houses back to the Bank (see SELLING PROPERTY).
      </p>

      <h4>HOTELS…</h4>
      <p>
        When a player has four houses on each property of a
        complete color-group, he/she may buy a hotel from the Bank and
        erect it on any property of the color-group. He/she returns the four
        houses from that property to the Bank and pays the price for the hotel
        as shown on the Title Deed card. Only one hotel may be erected on
        any one property.
      </p>

      <h4>SELLING PROPERTY…</h4>
      <p>
        Unimproved properties, railroads and
        utilities (but not buildings) may be sold to any player as a private
        transaction for any amount the owner can get; however, no property
        can be sold to another player if buildings are standing on any
        properties of that color-group. Any buildings so located must be sold
        back to the Bank before the owner can sell any property of that color-group.
        Houses and hotels may be sold back to the Bank at any time for
        one-half the price paid for them.
        All houses on one color-group must be sold one by one, evenly, in
        reverse of the manner in which they were erected.
        All hotels on one color-group may be sold at once, or they may be
        sold one house at a time (one hotel equals five houses), evenly, in
        reverse of the manner in which they were erected.
      </p>

      <h4>MORTGAGES…</h4>
      <p>
        Unimproved properties can be mortgaged through
        the Bank at any time. Before an improved property can be mortgaged,
        all the buildings on all the properties of its color-group must be sold
        back to the Bank at half price. The mortgage value is printed on each
        Title Deed card.
        No rent can be collected on mortgaged properties or utilities, but
        rent can be collected on unmortgaged properties in the same group.
        In order to lift the mortgage, the owner must pay the Bank the
        amount of the mortgage plus 10% interest. When all the properties of a
        color-group are no longer mortgaged, the owner may begin to buy
        back houses at full price.
        The player who mortgages property retains possession of it and no
        other player may secure it by lifting the mortgage from the Bank.
        However, the owner may sell this mortgaged property to another
        player at any agreed price. If you are the new owner, you may lift the
        mortgage at once if you wish by paying off the mortgage plus 10%
        interest to the Bank. If the mortgage is not lifted at once, you must pay
        the Bank 10% interest when you buy the property and if you lift the
        mortgage later you must pay the Bank an additional 10% interest as
        well as the amount of the mortgage.
      </p>

      <h4>BANKRUPTCY…</h4>
      <p>
        You are declared bankrupt if you owe more than
        you can pay either to another player or to the Bank. If your debt is to
        another player, you must turn over to that player all that you have of
        value and retire from the game. In making this settlement, if you own
        houses or hotels, you must return these to the Bank in exchange for
        money to the extent of one-half the amount paid for them; this cash is
        given to the creditor. If you have mortgaged property you also turn
        this property over to your creditor but the new owner must at once
        pay the Bank the amount of interest on the loan, which is 10% of the
        value of the property. The new owner who does this may then, at
        his/her option, pay the principal or hold the property until some later
        turn, then lift the mortgage. If he/she holds property in this way until
        a later turn, he/she must pay the interest again upon lifting the
        mortgage.
        Should you owe the Bank, instead of another player, more than you
        can pay (because of taxes or penalties) even by selling off buildings
        and mortgaging property, you must turn over all assets to the Bank. In
        this case, the Bank immediately sells by auction all property so taken,
        except buildings. A bankrupt player must immediately retire from the
        game. The last player left in the game wins.
      </p>

      <div>

      </div>

    </div>
  );
}
