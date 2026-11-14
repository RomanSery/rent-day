import React from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

import {
  corruptionAdjustment,
  defaultStartSkillPoints,
  luckAdjustment,
  maxTimeoutsAllowed,
  muggingAmount,
  muggingChance,
  negotiationAdjustment,
  payToGetOutFee,
  turnTimeLimit,
  auctionTimeLimit,
} from "../core/constants";
import { PlayerClass } from "../core/enums/PlayerClass";
import { SkillType } from "../core/enums/SkillType";
import { getPlayerClassDescription, getSkillDescription } from "./uiHelpers";

/**
 * The game rules, split into tabs. Shared by the /help page and the in-game
 * help dialog. With `syncHash` the open tab is kept in the URL (/help#taxes)
 * so a topic can be linked to directly.
 */

interface Topic {
  id: string;
  label: string;
  render: () => React.JSX.Element;
}

const Callout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="help-callout">{children}</div>
);

const Formula: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="help-formula">{children}</div>
);

const SimpleTable: React.FC<{ head: string[]; rows: React.ReactNode[][] }> = ({ head, rows }) => (
  <TableContainer component={Paper} variant="outlined" className="help-table">
    <Table size="small">
      <TableHead>
        <TableRow>
          {head.map((h) => <TableCell key={h}>{h}</TableCell>)}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {row.map((cell, j) => <TableCell key={j}>{cell}</TableCell>)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

const BasicsTopic = () => (
  <>
    <h3>Goal</h3>
    <p>
      Buy property, collect rent and drive everyone else into bankruptcy.
      <b> The last player still in the game wins.</b>
    </p>

    <h3>Setting up a game</h3>
    <ul>
      <li>2 to 6 seats. Empty seats can be filled with computer players.</li>
      <li>Everyone starts on <b>Pay Day</b> with the same money (default <b>$2,000</b>) and the same pool of skill points to spend (default <b>{defaultStartSkillPoints}</b>).</li>
      <li>Before the game starts, each player picks a <b>player class</b> (see the Classes tab).</li>
      <li>Turn order is shuffled when the game starts.</li>
    </ul>

    <h3>Your turn</h3>
    <ol>
      <li><b>Pay your bills.</b> Property taxes and electricity are taken from your money as soon as your turn begins.</li>
      <li><b>Optional, before you roll:</b> ride the subway between two stations you own, pay ${payToGetOutFee} to leave quarantine, spend skill points.</li>
      <li><b>Roll the dice</b> and move. What happens next depends on the square you land on (table below).</li>
      <li><b>Rolled a double?</b> Roll again. Three doubles in a row sends you straight to quarantine.</li>
      <li><b>End your turn.</b> You can't end it while an auction or lotto from your roll is still open, or while your money is below $0.</li>
    </ol>
    <p>
      Building, selling houses, mortgaging, redeeming and trading can be done at any time,
      not just on your turn. Spending skill points is only allowed on your turn.
    </p>

    <h3>Pay Day</h3>
    <p>
      Every time you pass or land on Pay Day you collect your salary (<b>$200</b>, or <b>$300</b> for the Banker)
      and earn <b>1 skill point</b>. Being moved past Pay Day by a Chance card counts too.
    </p>

    <h3>The board</h3>
    <SimpleTable
      head={["Square", "What happens"]}
      rows={[
        ["Property (coloured)", "Unowned: goes to auction. Owned by someone else: pay rent."],
        ["Subway station (Herald Sq, Fulton St, Penn Station, Grand Central)", "Same as property. Owning stations also lets you ride the subway."],
        ["Company (MTA, Con Edison)", "Unowned: goes to auction. They never charge rent, but give their owner a special power."],
        ["Chance", "A random good or bad event (see the Chance & Lotto tab)."],
        ["NY Lotto", "Pick one of three prizes and try your luck."],
        ["Big Brother", "Caught breaking the rules: go to quarantine."],
        ["Quarantine", "Just visiting, unless you were sent there."],
        ["Central Park", "Nothing happens. Enjoy the view."],
      ]}
    />
  </>
);

const ClassesTopic = () => {
  const classes: Array<{ type: PlayerClass; tagline: string }> = [
    { type: PlayerClass.Gambler, tagline: "Lives for the lotto." },
    { type: PlayerClass.Conductor, tagline: "Rules the subway." },
    { type: PlayerClass.Governor, tagline: "Corrupt, and proud of it." },
    { type: PlayerClass.Banker, tagline: "Low taxes and a fat paycheck." },
  ];

  return (
    <>
      <p>
        Each player picks a class before the game starts. Your class gives you perks,
        and most classes also start with 2 free points in one skill. Pick the one that suits your style of play.
      </p>

      <div className="help-class-grid">
        {classes.map((c) => (
          <Paper key={c.type} variant="outlined" className="help-class-card">
            <h3>{c.type}</h3>
            <div className="help-class-tagline">{c.tagline}</div>
            <div className="player-class-description">{getPlayerClassDescription(c.type)}</div>
          </Paper>
        ))}
      </div>

      <h3>At a glance</h3>
      <SimpleTable
        head={["Class", "Free skill points", "Salary", "Plays well with"]}
        rows={[
          ["Gambler", "Luck 2", "$200", "Luck, landing on NY Lotto"],
          ["Conductor", "Negotiation 2", "$200", "Subway stations, the MTA"],
          ["Governor", "Corruption 2", "$200", "Governors Island, building lots of houses"],
          ["Banker", "None", "$300", "Expensive properties (half taxes)"],
        ]}
      />

      <Callout>
        Class perks stack with companies. A Conductor who also owns the MTA collects
        <b> 4x</b> rent on their stations.
      </Callout>
    </>
  );
};

const SkillsTopic = () => (
  <>
    <p>There are three skills. Each point you put into a skill makes it stronger, with no upper limit.</p>

    <SimpleTable
      head={["Skill", "Effect per point"]}
      rows={[
        [<b key="n">Negotiation</b>, getSkillDescription(SkillType.Negotiation)],
        [<b key="l">Luck</b>, getSkillDescription(SkillType.Luck)],
        [<b key="c">Corruption</b>, getSkillDescription(SkillType.Corruption)],
      ]}
    />

    <h3>Getting skill points</h3>
    <ul>
      <li>Every player starts with a pool of points to spend (default <b>{defaultStartSkillPoints}</b>, set when the game is created).</li>
      <li>Most classes also start with <b>2 free points</b> in one skill.</li>
      <li><b>+1 point</b> each time you pass Pay Day.</li>
      <li>Sometimes from a lucky Chance card.</li>
    </ul>
    <p>
      Unspent points show as a badge in your turn bar. You can only spend them on your turn,
      and once spent they can't be moved.
    </p>

    <h3>Examples</h3>
    <ul>
      <li><b>Negotiation 3:</b> rent of $200 is lowered by {3 * negotiationAdjustment}%, so you pay ${200 - 200 * 3 * negotiationAdjustment / 100}.</li>
      <li><b>Luck 2:</b> the small lotto prize goes from a 50% to a {50 + 2 * luckAdjustment}% chance to win.</li>
      <li><b>Corruption 4:</b> a $100 bill for taxes and electricity drops by {4 * corruptionAdjustment}% to ${100 - 4 * corruptionAdjustment}.</li>
    </ul>

    <Callout>
      Some skills are worth much more to certain classes. A Gambler gets the most out of Luck,
      and a Governor (who never pays for electricity) gets a little less out of Corruption than the others.
    </Callout>
  </>
);

const PropertyTopic = () => (
  <>
    <h3>Auctions</h3>
    <p>Whenever a player lands on an unowned property, station or company, it immediately goes to auction.</p>
    <ul>
      <li>Every player still in the game bids, including players in quarantine. Bids are sealed: nobody sees the others' bids until the auction closes.</li>
      <li>You can't bid more money than you have. A bid of $0 is allowed.</li>
      <li><b>The highest bid wins, but the winner pays the amount of the 2nd highest bid.</b></li>
      <li>If the highest bid is a tie, nobody wins and the square stays unowned until someone lands on it again.</li>
      <li>Players who run out of time are counted as bidding $0 and don't set the price. If nobody else really bid, the winner pays their own bid.</li>
    </ul>
    <p>
      Because the winner pays the runner-up's price, everyone has a reason to bid,
      even on property they don't want: a high bid can make a rival pay more.
    </p>

    <h3>The purchase price matters</h3>
    <p>
      The price paid at auction stays with the property for the rest of the game, even when it
      changes hands in a trade. It sets the property's <b>mortgage value</b> and its <b>property tax</b>.
    </p>

    <h3>Rent</h3>
    <ul>
      <li>Rent for each number of houses is listed on the property card.</li>
      <li>Own every property in a colour group and the rent on its unbuilt properties is <b>doubled</b>.</li>
      <li>Mortgaged properties don't collect rent.</li>
      <li><b>Owners in quarantine don't collect rent.</b></li>
      <li>The rent you pay is lowered by your Negotiation skill.</li>
    </ul>

    <h3>Houses</h3>
    <ul>
      <li>To build you must own the whole colour group, and none of it can be mortgaged.</li>
      <li>Up to <b>5 houses</b> per property. Build and sell <b>evenly</b> across the group.</li>
      <li>The cost of a house is listed on the property card. Selling a house gives back <b>half</b> of what it cost.</li>
      <li>Every house adds to your electricity bill (see the Taxes & Electricity tab).</li>
    </ul>

    <h3>Mortgages</h3>
    <ul>
      <li>Mortgaging pays you <b>40% of the purchase price</b>.</li>
      <li>Sell all the houses in the group before mortgaging any property in it.</li>
      <li>A mortgaged property collects no rent, but you pay no tax or electricity on it either.</li>
      <li>Redeeming costs the <b>mortgage amount plus 10%</b>.</li>
      <li>Companies can't be mortgaged.</li>
    </ul>

    <Formula>
      Bought for $300 → mortgage pays $120 → redeem for $132
    </Formula>
  </>
);

const TaxesTopic = () => (
  <>
    <p>
      Owning property isn't free. At the <b>start of each of your turns</b> you pay property taxes
      plus electricity for your houses. Both are skipped while you are in quarantine.
    </p>

    <h3>Property taxes</h3>
    <p>Every property and station has a tax rate. You pay tax on each one you own that isn't mortgaged.</p>
    <Formula>tax per turn = purchase price × tax rate</Formula>
    <ul>
      <li><b>Banker:</b> all property taxes cut in half.</li>
      <li><b>Governor:</b> no tax on Governors Island.</li>
      <li><b>Corruption:</b> each point takes {corruptionAdjustment}% off your total.</li>
      <li>Companies have no tax.</li>
    </ul>
    <Callout>
      Watch the purchase price. Tax follows the price paid at auction, so a property that sold for
      a lot can land you with a hefty tax bill if you later get it in a trade.
    </Callout>

    <h3>Electricity</h3>
    <p>If you've built houses, you also pay for their electricity. Each property lists a cost per house.</p>
    <Formula>electricity per turn = houses × electricity cost per house</Formula>
    <ul>
      <li><b>Own Con Edison</b> or play the <b>Governor</b>: no electricity bill at all.</li>
      <li><b>Corruption:</b> each point takes {corruptionAdjustment}% off your total.</li>
      <li>Mortgaged properties have no houses, so they cost nothing.</li>
    </ul>

    <h3>Example</h3>
    <SimpleTable
      head={["", "Amount"]}
      rows={[
        ["Brownsville, bought for $400, tax rate 1%", "$4.00"],
        ["Tribeca, bought for $600, tax rate 2.5%", "$15.00"],
        ["Taxes before skills", "$19.00"],
        ["Corruption 2 (−10%)", "−$1.90"],
        [<b key="t">Taxes per turn</b>, <b key="v">$17</b>],
      ]}
    />
    <p>
      Each player's total bill shows next to their name as "−$X/turn". Click a player to see taxes and
      electricity separately, and hover over either number for the breakdown by property.
    </p>
  </>
);

const SubwayTopic = () => (
  <>
    <h3>Subway stations</h3>
    <p>There are four stations: Herald Sq, Fulton St, Penn Station and Grand Central. Rent depends on how many you own.</p>
    <SimpleTable
      head={["Stations owned", "1", "2", "3", "4"]}
      rows={[["Rent", "$25", "$50", "$100", "$200"]]}
    />
    <ul>
      <li>Owning the <b>MTA</b> doubles the rent on your stations.</li>
      <li>The <b>Conductor</b> doubles it again.</li>
    </ul>

    <h3>Riding the subway</h3>
    <p>
      If you're standing on a station you own, you can travel to any other station you own <b>before you roll</b>.
      Neither station can be mortgaged. You get one ride per turn, plus another after each double.
    </p>
    <Callout>
      The subway isn't safe: there is a <b>{muggingChance}% chance</b> you get mugged and lose <b>${muggingAmount}</b> on each ride.
    </Callout>

    <h3>Companies</h3>
    <p>
      The two companies never charge rent and have no tax, but their owner gets a special power.
      Think about how they fit your class.
    </p>
    <SimpleTable
      head={["Company", "Power"]}
      rows={[
        ["MTA", "Doubles the rent on every subway station you own."],
        ["Con Edison", "You pay no electricity, no matter how many houses you build."],
      ]}
    />

    <h3>Governors Island</h3>
    <p>
      Governors Island is a group of its own, so whoever owns it can build on it straight away,
      and its unbuilt rent is always doubled. Its rent jumps sharply at 3 houses. A Governor who owns it
      collects double rent and pays no tax on it.
    </p>
  </>
);

const ChanceLottoTopic = () => (
  <>
    <h3>NY Lotto</h3>
    <p>Land on NY Lotto and choose one of three prizes. The bigger the prize, the smaller your chance of winning it. Prize amounts are random within these ranges.</p>
    <SimpleTable
      head={["Prize", "Amount", "Chance to win", "With Luck 2"]}
      rows={[
        ["Small", "$100 – $200", "50%", `${50 + 2 * luckAdjustment}%`],
        ["Medium", "$230 – $400", "20%", `${20 + 2 * luckAdjustment}%`],
        ["Large", "$430 – $600", "10%", `${10 + 2 * luckAdjustment}%`],
      ]}
    />
    <ul>
      <li>Each point of <b>Luck</b> adds {luckAdjustment} percentage points to every prize's chance.</li>
      <li>The <b>Gambler</b>'s prizes are 60% bigger.</li>
      <li>If you rolled a double, pick your prize before rolling again.</li>
    </ul>

    <h3>Chance</h3>
    <p>
      Landing on Chance draws a random event. Some are good news, some are bad: you might
      collect money, pay a bill, gain a skill point or be sent somewhere else on the board.
      The rest is for you to discover.
    </p>
    <p>
      If a Chance card moves you onto an unowned property, it goes to auction as usual.
      If it moves you past Pay Day, you collect your salary.
    </p>
  </>
);

const QuarantineTopic = () => (
  <>
    <h3>Going in</h3>
    <ul>
      <li>Land on <b>Big Brother</b>.</li>
      <li>Roll <b>three doubles in a row</b>.</li>
    </ul>
    <p>You go straight to quarantine without passing Pay Day.</p>

    <h3>Getting out</h3>
    <ul>
      <li>Roll a <b>double</b>, and move by that roll.</li>
      <li>Pay <b>${payToGetOutFee}</b> before you roll, then roll as normal.</li>
      <li>Wait it out: on your third turn you leave and move by whatever you roll.</li>
    </ul>

    <h3>While you are in quarantine</h3>
    <SimpleTable
      head={["", ""]}
      rows={[
        ["Property taxes and electricity", "Not charged"],
        ["Rent from your properties", <b key="r">Not collected</b>],
        ["Bidding at auctions", "Allowed"],
        ["Trading, building, mortgaging", "Allowed"],
      ]}
    />
    <Callout>
      Quarantine can be a good place to hide from big bills, but your properties earn nothing while you are there.
    </Callout>
  </>
);

const MoneyTopic = () => (
  <>
    <h3>Trading</h3>
    <ul>
      <li>Offer any mix of money and properties to another player, and ask for money or properties in return. Both sides must give something.</li>
      <li>Properties with houses, or in a group that has any houses, can't be traded. Sell the houses first.</li>
      <li>A traded property keeps its purchase price and mortgage, so check its tax before you accept.</li>
      <li>Trades can be offered at any time, not just on your turn.</li>
    </ul>

    <h3>Running out of money</h3>
    <ul>
      <li>Bills and Chance cards can push your money below $0. You can't roll or end your turn until you get back to $0 or more by selling houses or mortgaging property.</li>
      <li>If you owe rent equal to or more than everything you own (your <b>total assets</b>), you pay what you can and go <b>bankrupt</b>.</li>
      <li>If your money is below $0 and you have nothing left to sell or mortgage, you are out.</li>
    </ul>
    <p>
      <b>Total assets</b> = money + mortgage value of your unmortgaged properties + resale value of your houses.
    </p>

    <h3>Bankruptcy</h3>
    <p>
      A bankrupt player is out of the game. Their properties go back to the bank: unowned, with no houses and
      no mortgage, and up for auction again when someone lands on them. Quitting a game counts as going bankrupt.
    </p>

    <h3>Turn timers</h3>
    <p>
      Timers are on by default and can be turned off when creating a game. You get about <b>{turnTimeLimit} seconds</b> per
      turn and <b>{auctionTimeLimit} seconds</b> to bid in an auction.
    </p>
    <ul>
      <li>Run out of time and the game plays for you: it rolls, ends your turn, and bids $0 in auctions.</li>
      <li>If your money is below $0 when time runs out, it sells houses and mortgages property until you're back to $0.</li>
      <li><b>If you time out {maxTimeoutsAllowed} times in a row, you lose the game.</b> This stops players who walk away from ruining the game for everyone else.</li>
    </ul>
  </>
);

const TOPICS: Topic[] = [
  { id: "basics", label: "Basics", render: BasicsTopic },
  { id: "classes", label: "Classes", render: ClassesTopic },
  { id: "skills", label: "Skills", render: SkillsTopic },
  { id: "property", label: "Property & Auctions", render: PropertyTopic },
  { id: "taxes", label: "Taxes & Electricity", render: TaxesTopic },
  { id: "subway", label: "Subway & Companies", render: SubwayTopic },
  { id: "chance", label: "Chance & Lotto", render: ChanceLottoTopic },
  { id: "quarantine", label: "Quarantine", render: QuarantineTopic },
  { id: "money", label: "Trades & Bankruptcy", render: MoneyTopic },
];

const topicFromHash = (): number => {
  const id = window.location.hash.replace("#", "");
  const index = TOPICS.findIndex((t) => t.id === id);
  return index === -1 ? 0 : index;
};

interface Props {
  /** keep the open tab in the URL hash (the /help page, not the in-game dialog) */
  syncHash?: boolean;
}

export const HelpContent: React.FC<Props> = ({ syncHash }) => {
  const [tab, setTab] = React.useState<number>(() => (syncHash ? topicFromHash() : 0));

  React.useEffect(() => {
    if (!syncHash) {
      return;
    }
    const onHashChange = () => setTab(topicFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [syncHash]);

  const onChange = (_: React.SyntheticEvent, value: number) => {
    setTab(value);
    if (syncHash) {
      window.history.replaceState(null, "", "#" + TOPICS[value].id);
    }
  };

  const topic = TOPICS[tab];

  return (
    <div className="help-content">
      <Tabs
        value={tab}
        onChange={onChange}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Help topics"
        className="help-tabs"
      >
        {TOPICS.map((t) => (
          <Tab key={t.id} label={t.label} id={"help-tab-" + t.id} aria-controls={"help-panel-" + t.id} />
        ))}
      </Tabs>

      <div
        role="tabpanel"
        id={"help-panel-" + topic.id}
        aria-labelledby={"help-tab-" + topic.id}
        className="help-panel"
      >
        {topic.render()}
      </div>
    </div>
  );
};
