// NPM Dependencies
const { filter } = require('rxjs/operators');

// Local Depdendencies
const { version } = require('../package.json');

/** Pattern for JOIN command. */
const REGEXP_JOIN = /^join (\S+)$/i;
/** Pattern for PART command. */
const REGEXP_PART = /^part (\S+)(?: (.+))?\s*$/i;
/** Pattern for MODE command. */
const REGEXP_MODE = /^mode (\S+) ([+-a-z]+)(?: (.+))?\s*$/i;
/** Pattern for TOPIC command. */
const REGEXP_TOPIC = /^topic (\S+) (.+)\s*$/i;
/** Pattern for KICK command. */
const REGEXP_KICK = /^kick (\S+) (\S+)(?: (.+))?\s*$/i;
/** Pattern for NICK command. */
const REGEXP_NICK = /^nick (\S+)$/i;
/** Pattern for privilege commands. Give or take channel modes o, h, v. */
const REGEXP_PRIVS = /^((?:give|take)(?:Ops|Hops|Voices)) (\S+) (.+)$/
/** Pattern for talk commands. Alias for PRIVMSG & NOTICE commands. */
const REGEXP_TALK = /^(tell|notify) (\S+) (.+)$/

let defaults = {
	regexp: '^nick!user@',
	logLevel: 'error'
};

module.exports = class AdminModule {
	/**
	 * @param {ClientWrapper} client
	 * @param {object} options
	 * @param {RegExp} options.regexp='^nick!user@'
	 * @param {string} options.logLevel='error'
	 */
	constructor(client, options) {
		/** @type {object} */
		this.settings = { ...defaults, ...options };
		this.settings.regexp = new RegExp(this.settings.regexp);
		/** @type {string} */
		this.version = version;

		let { logger } = client;

		//  ____  _
		// / ___|| |_ _ __ ___  __ _ _ __ ___  ___
		// \___ \| __| '__/ _ \/ _` | '_ ` _ \/ __|
		//  ___) | |_| | |  __/ (_| | | | | | \__ \
		// |____/ \__|_|  \___|\__,_|_| |_| |_|___/
		//

		let admin$ = client.raw$.pipe(
			filter(message => message.command === 'PRIVMSG'),
			filter(message => message.args[0] === client.getNick()),
			filter(message => this.settings.regexp.test(message.prefix))
		);

		//  ____        _                   _       _   _
		// / ___| _   _| |__  ___  ___ _ __(_)_ __ | |_(_) ___  _ __  ___
		// \___ \| | | | '_ \/ __|/ __| '__| | '_ \| __| |/ _ \| '_ \/ __|
		//  ___) | |_| | |_) \__ \ (__| |  | | |_) | |_| | (_) | | | \__ \
		// |____/ \__,_|_.__/|___/\___|_|  |_| .__/ \__|_|\___/|_| |_|___/
		//                                   |_|
		//

		admin$.subscribe(message => {
			let request = message.args[1].trim();

			if (request === 'quit') {
				logger.info(`RxBot Admin - Shutting down.`);
				client.disconnect('Gone', () => {
					setTimeout(() => process.exit(0), 3000);
				});
			} else if (REGEXP_JOIN.test(request)) {
				let [, channel] = request.match(REGEXP_JOIN);
				logger.info(`RxBot Admin - Joining channel ${channel}.`);
				client.join(channel);
			} else if (REGEXP_PART.test(request)) {
				let [, channel, text] = request.match(REGEXP_PART);
				logger.info(`RxBot Admin - Parting channel ${channel}.`);
				client.part(channel, text);
			} else if (REGEXP_MODE.test(request)) {
				let [, channel, flags, args] = request.match(REGEXP_MODE);
				let command = ['MODE', channel, flags];
				if (args) {
					command = command.concat(args.split(' '));
				}
				logger.info(`RxBot Admin - ${command.join(' ')}`);
				client.lib.send.apply(client.lib, command);
			} else if (REGEXP_TOPIC.test(request)) {
				let [, channel, topic] = request.match(REGEXP_TOPIC);
				logger.info(`RxBot Admin - Setting topic of ${channel} to: ${topic}`);
				client.setTopic(channel, topic);
			} else if (REGEXP_KICK.test(request)) {
				let [, channel, user, reason] = request.match(REGEXP_KICK);
				logger.info(`RxBot Admin - Kicking ${user} from "${channel}".`);
				if (reason) {
					logger.info(`RxBot Admin - Reason: ${reason}`);
				}
				client.kick(channel, user, reason);
			} else if (REGEXP_NICK.test(request)) {
				let [, nick] = request.match(REGEXP_NICK);
				logger.info(`RxBot Admin - Changing nick to ${nick}.`);
				client.setNick(nick);
			} else if (REGEXP_PRIVS.test(request)) {
				let [, method, channel, nicks] = request.match(REGEXP_PRIVS);
				logger.info(`RxBot Admin - ${method.toUpperCase()} ${channel}: ${nicks}`);
				client[method](channel, nicks.split(' '));
			} else if (REGEXP_TALK.test(request)) {
				let [, method, target, message] = request.match(REGEXP_TALK);
				logger.info(`RxBot Admin - ${method.toUpperCase()} ${target}: ${message}`);
				client[method](target, message);
			}
		});
	}
}
