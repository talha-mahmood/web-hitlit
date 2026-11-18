export type GuideSection = {
  title: string;
  body: string;
  steps?: string[];
  tip?: string;
};

export type GuideChapter = {
  id: string;
  title: string;
  icon: string;
  intro: string;
  sections: GuideSection[];
};

/** Offline help written against the screens and flows currently in this app. */
export const USER_GUIDE: GuideChapter[] = [
  {
    id: "welcome",
    title: "Welcome to HitLit",
    icon: "hand-right-outline",
    intro: "HitLit brings local players, games, teams, tournaments, venues, and live scorecards together.",
    sections: [
      { title: "What you can do", body: "Find nearby games and venues, join or create a squad, organize a match or tournament, follow player profiles, and keep scores for supported sports. Features available to you depend on your account role and the sport or event you open." },
      { title: "First sign-in", body: "Sign in with Google, accept the app terms, and complete the profile details requested during onboarding. Your profile name and visibility help other players recognize and find you." },
      { title: "A note about availability", body: "Listings and actions use live app data. Some options appear only for a host, team manager, participant, or scorer. Online venue payment is not currently available; checkout shows the supported payment arrangement before you confirm." },
    ],
  },
  {
    id: "navigate",
    title: "Find your way around",
    icon: "compass-outline",
    intro: "Use the five tabs at the bottom to move between the app’s main areas.",
    sections: [
      { title: "Home", body: "Home brings together sport filters and nearby venues, team challenges, squads, games, tournaments, and events. Tap a card to open its details, or use See all to open the full listing." },
      { title: "Community", body: "The Community screen currently has four cards: Community Chat, Find Players, Explore Events, and Explore Training Camps. Games, tournaments, and squads are reached from their Home sections and dedicated listing screens." },
      { title: "Scorecard", body: "Choose a sport to find, create, or score matches. A live scorecard can be viewed by other people with access, while score editing is reserved for the assigned scorer or authorized match manager." },
      { title: "Venues and Profile", body: "Venues lets you find courts and grounds, check available slots, and manage bookings. Profile contains your player information, stats, activity, and Account Settings." },
      { title: "Notifications", body: "Open the bell to review in-app notifications. Tapping a notification can take you directly to its related chat, challenge, fixture, game, or other supported destination." },
    ],
  },
  {
    id: "terms",
    title: "App terms, simply explained",
    icon: "book-outline",
    intro: "These are the names you will see throughout HitLit.",
    sections: [
      { title: "Game and match", body: "A game is an activity listing that people can discover and join. A match is the sporting contest being scored; matches can also be created from the Scorecard tab." },
      { title: "Squad and team", body: "A squad is a member community with an owner and, where assigned, hosts. Squads can be community-focused or team-focused. Team squads represent a sports team and can use the team challenge tools when the sport supports them." },
      { title: "Tournament and fixture", body: "A tournament is an organized competition. Its fixtures are scheduled matchups. A team challenge is a request between two teams; when accepted, it can create a confirmed fixture." },
      { title: "Host, manager, member, and scorer", body: "Hosts or owners manage the activity or squad. Team challenge actions require a manager of one of the teams. Members participate. A scorer records the score; viewing a live score does not grant editing permission." },
      { title: "Formats", body: "Formats depend on the sport. Football uses side counts such as 5v5, 7v7, or 11v11. Cricket includes formats such as T10, T20, One Day, and Club Cricket where offered. Always use the options shown on the screen." },
    ],
  },
  {
    id: "games",
    title: "Find, join, and host games",
    icon: "football-outline",
    intro: "Use Home or Community to discover activities, or host a game when you want to organize one.",
    sections: [
      { title: "Find a game", body: "Use Games near you on Home and tap See all to open the game listings. Browse the available listings, use the sport and other filters shown, and open a card for the full details." , steps: ["Open a game card to check its venue, schedule, format, availability, and host details.", "Use the join or request action shown on the detail page.", "Return to the detail page to follow your participation status and relevant chat." ] },
      { title: "Host a game", body: "Open Games near you on Home and tap See all. Choose Create from the games listing, enter the requested match information, choose the sport and available format, and post the listing. The detail page is where hosts and players manage participation and communicate." , tip: "Review the date, time, location, and player requirements before posting; those details help nearby players decide whether to join." },
      { title: "Game status", body: "A listing can show whether it is open, full, cancelled, or has ended. Live scoring status is shown when scoring has started. If the game is team-based, team approval and roster actions may require a host." },
      { title: "Game chat", body: "Open a game’s chat from its details to coordinate with participants. Keep messages relevant to the match. Chat availability and moderation actions follow the game’s membership and host rules." },
    ],
  },
  {
    id: "teams",
    title: "Squads, teams, and challenges",
    icon: "people-outline",
    intro: "Squads help people organize around a team or community. Team managers can also send match challenges.",
    sections: [
      { title: "Create or join a squad", body: "Use Squads near you on Home and tap See all to browse squads. Choose Create in the squad listing to set one up. A squad can have a sport, location, privacy, and membership settings. Open its details to request to join, accept an invitation, or view member information." },
      { title: "Manage members", body: "Squad owners and assigned hosts can manage membership requests and member roles. Regular members do not automatically receive host or team-manager permissions." },
      { title: "Challenge a team", body: "Open Challenge a Team from Home’s Play Near You section or the team challenge tools. Search for a team, narrow the list using the available city and sport filters, then tap Challenge on the intended opponent." , steps: ["Choose a team that is different from your own team.", "Select the team you manage when prompted, then enter venue, date, time, sport format, and any other fields shown.", "Send the request and track its status under My Challenges." ] },
      { title: "Respond to a challenge", body: "In My Challenges, review received requests and their proposed details. An authorized team manager can accept or decline. Accepted requests are linked to a confirmed fixture; declined requests remain available in challenge history." },
      { title: "Challenge status and fixtures", body: "Pending, accepted, declined, and other available statuses show where a request stands. Open a confirmed fixture for its schedule and, when available, its sport-specific scorecard. Fixture scoring becomes available according to the schedule and manager permissions." },
    ],
  },
  {
    id: "competitions",
    title: "Tournaments and events",
    icon: "trophy-outline",
    intro: "Browse competitions and events, or use the hosting flows to organize one.",
    sections: [
      { title: "Explore tournaments", body: "Use Tournaments near you on Home and tap See all to browse competitions. Open a tournament to review its details, team registration, fixtures, and other sections." },
      { title: "Host a tournament", body: "Open Tournaments near you on Home and tap See all. Choose Create from the tournament listing and complete the competition details offered by the form. The organizer can manage participating teams, tournament structure, and match schedule from the tournament screens." },
      { title: "Follow tournament matches", body: "Tournament details provide access to the teams, fixtures, and other tournament sections. When scoring starts, match cards can show a live state. Participants and viewers can follow the score; score edits remain restricted to the scorer or authorized host." },
      { title: "Events and training camps", body: "Use the Explore Events and Explore Training Camps cards on Community to browse them. The Events listing also provides a Host action. Event details show the schedule, location, and participation information provided by the organizer. Event members can use the event chat where available." },
    ],
  },
  {
    id: "scoring",
    title: "Scorecards and live scoring",
    icon: "stats-chart-outline",
    intro: "The Scorecard tab includes separate scoring flows for the sports currently supported by the app.",
    sections: [
      { title: "Sports available", body: "The Scorecard hub currently lists Cricket, Padel, Football, Badminton, Pickleball, Tennis, and Table Tennis. Open a sport to see its match list, create a match, and view live or completed scorecards." },
      { title: "Start a match", body: "Choose the sport, enter the teams or players and match settings requested, then save the match. Sport-specific screens determine scoring rules and options; for example, cricket uses innings and overs while racket sports use their own point and game rules." },
      { title: "Record a score", body: "The assigned scorer uses the live scoring controls for the selected sport. Cricket scoring records deliveries and innings events; football records match events and time; racket sport scorecards track points, games, or sets as applicable." },
      { title: "Watch a live match", body: "Open a live match card to follow the current score. Viewers can see the same live score information without being able to change it. Use the match tabs or full scorecard where the sport provides them." },
      { title: "Manual scores and completed matches", body: "Some scoring routes support entering a completed score manually. Match lists let you find live, completed, or scorecard-related matches using the filters available for that sport." },
      { title: "Sport-specific rules", body: "Scoring rules vary by sport and match settings. Read the labels on the new match and live scoring screens before starting; do not assume a cricket over, football half, tennis set, or badminton game uses the same rules." },
    ],
  },
  {
    id: "venues",
    title: "Venues and bookings",
    icon: "location-outline",
    intro: "Find a place to play and, where booking is enabled, reserve an available court slot.",
    sections: [
      { title: "Explore venues", body: "Open Venues or use Venues near you on Home. Browse venue cards, apply available sport or location filters, and open a venue to inspect its courts and details." },
      { title: "Choose a slot", body: "From a venue, choose a court and an available date or time slot. Review the booking summary before continuing to checkout." , steps: ["Open the venue and choose the court you need.", "Select an available slot and review its time and amount.", "Confirm the booking details and check the payment instructions shown." ] },
      { title: "Payments and booking status", body: "The app supports booking records and payment status tracking. Online payment is not currently integrated; checkout identifies the available arrangement (such as cash on arrival). Your bookings screen shows upcoming and past booking records and their status." },
      { title: "Booking a tournament venue", body: "Tournament organizers can open a venue from the tournament flow and link a booking where that action is available. Follow the confirmation shown in the app to return to the tournament." },
    ],
  },
  {
    id: "players",
    title: "Players and your profile",
    icon: "person-circle-outline",
    intro: "Profiles help players show their sports activity and discover other people to play with.",
    sections: [
      { title: "Find players", body: "Use Community → Find Players to browse the player list and open a player profile. Available search and filters help narrow the results. A private profile is hidden from the Invite Players search." },
      { title: "Your profile", body: "Your profile includes your player identity and tabs for profile information, overview, statistics, matches, teams, tournaments, clubs, insights, and comparisons where data is available. Change your photo or skill level from the profile controls." },
      { title: "Understand statistics", body: "Stats are calculated from recorded app activity. Depending on the sport and available score data, the profile may show participation, wins, rating or tier, sport breakdowns, or sport-specific figures such as cricket batting and bowling records. A blank or zero value can mean no eligible recorded data is available yet." },
      { title: "Profile photo and player details", body: "Your display name, avatar, and jersey number help others identify you. Use Account Settings to update your name, jersey number, and public/private visibility." },
    ],
  },
  {
    id: "chat-notifications",
    title: "Chats and notifications",
    icon: "chatbubbles-outline",
    intro: "Use the right conversation to coordinate, and open alerts to jump to their related content.",
    sections: [
      { title: "Chat types", body: "The app includes community chat plus conversations associated with games, teams, squads, tournaments, and events where available. Open the relevant activity or squad to reach its conversation." },
      { title: "Send and manage messages", body: "Type a message and send it from the conversation composer. Some chat screens support replies, reactions, polls, reporting, blocking, or message deletion according to the screen and your permissions." },
      { title: "Notification behavior", body: "When HitLit is open, supported push events can appear as an in-app banner. When it is backgrounded or closed, Android push notifications can appear in the system shade. Tap an alert to open its associated screen; the available destination depends on the notification type and payload." },
      { title: "Notification history", body: "Open the bell or Notifications screen to review saved alerts, mark them read, or remove them where those actions are available. An in-app banner is a quick preview; the notification list keeps the inbox view." },
    ],
  },
  {
    id: "settings-faq",
    title: "Settings, privacy, and quick fixes",
    icon: "settings-outline",
    intro: "Use Account Settings to control your personal details and account access.",
    sections: [
      { title: "Update account details", body: "Open Profile → settings → Account Settings. You can save your display name and jersey number, switch profile visibility, review blocked users, and sign out. Account deletion is permanent and removes data associated with your account." },
      { title: "Profile visibility", body: "Public profiles can be found and invited to teams or squads. Private profiles are hidden from Invite Players search. Changing visibility does not remove your past activity from its related game or team records." },
      { title: "I cannot see a listing", body: "Check the active sport, city, and other filters; clear a search term; and confirm the listing has not ended or been cancelled. Listings with unavailable location data may not sort near your current location." },
      { title: "I cannot join or manage something", body: "Check whether you are signed in, whether a request is pending, and whether the action requires a host or team manager. A regular member does not automatically have manager permissions." },
      { title: "My scorecard is not editable", body: "Only the assigned scorer or an authorized manager can enter or change scores. Other participants can open the live score in view-only mode." },
      { title: "Something is not loading", body: "Check your internet connection, return to the listing, and use its refresh gesture or retry control if shown. If the problem continues, note the screen and action and contact the app team through the available support channel." },
      { title: "Quick tips", body: "Keep your profile current, check venue and time details before confirming, use the correct activity chat, and review permissions before expecting to manage a team or scorecard.", tip: "Guide content is stored in the app and remains available offline. Live listings, account updates, chats, and score synchronization still require a connection." },
    ],
  },
];
