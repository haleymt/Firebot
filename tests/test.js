// TODO: Test the following functionality

/*

-Event listeners:
  1. When a user joins the team, they are added to the bot's list of members
  2. When a user deactivates their account, they are removed from the bot's list of users
  3. When a channel is created, it is added to the bot's list of member channels
  4. When a bot joins the channel, the channel is added to the bot's list of member channels
  5. When a channel is archived, it is removed from the bot's list of all channels
     and from its list of member channels (if the bot is a member)

-Conversation listeners:

-Setting up the bot:
  1. If the bot has been removed from the team, it should close the RTM and stop the interval
  2. Only active users are added to the list of all users
  3. Only active channels are added to the list of all channels
  4. Only active channels are added to the list of channels that the bot is a member of
  5. The bot should be added to the controller's list of bots
  6. The RTM should start
  7. The bot's interval should start
  8. If the bot already had an interval running, that interval should get closed
  9. If the bot is new, and ONLY when the bot is new, an introductory message should
     get sent to the team


*/
