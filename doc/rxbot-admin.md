# RxBox Admin
The admin module gives remote access to some administrative tasks via private messages.

* [Repository](https://github.com/rx-irc/bot-admin)

## Commands
* `join <channel>`
* `part <channel>`
* `mode <channel/nick> <modes> (<options>)`
* `topic <channel> <text>`
* `kick <channel> <nick> (<reason>)`
* `nick <newnick>`
* `give op <channel> <nick ...>`
* `take op <channel> <nick ...>`
* `give hop <channel> <nick ...>`
* `take hop <channel> <nick ...>`
* `give voice <channel> <nick ...>`
* `take voice <channel> <nick ...>`
* `tell <channel/nick> <text>`
* `notify <channel/nick> <text>`

All commands are case-insensitive.

### Brackets
* Angle brackets indicate variable parts of the commands.
* Round brackets indicate optional parameters.

## Logging
The scope for the `DEBUG` environment variable is `rx-irc:bot:admin`.
