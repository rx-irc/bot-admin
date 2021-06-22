// NPM Dependencies
const { filter } = require('rxjs/operators');

// Local Depdendencies
const logger = require('./logger');
const { version } = require('../package.json');

/** Pattern for admin login. */
const REGEXP_LOGIN = /^login (\S+) (\S+)$/i;
/** Pattern for QUIT command. */
const REGEXP_QUIT = /^quit(?: (.+))?$/i;
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
	passwords: {},
};

module.exports = class AdminModule {
	/**
	 * @param {ClientWrapper} client
	 * @param {object} options
	 * @param {object} options.passwords key:value -> username:password
	 */
	constructor(client, options) {
		/** @type {object} */
		this.settings = { ...defaults, ...options };
		/** @type {string} */
		this.version = version;
		/** @type {string[]} */
		this.admins = [];

		//  ____  _
		// / ___|| |_ _ __ ___  __ _ _ __ ___  ___
		// \___ \| __| '__/ _ \/ _` | '_ ` _ \/ __|
		//  ___) | |_| | |  __/ (_| | | | | | \__ \
		// |____/ \__|_|  \___|\__,_|_| |_| |_|___/
		//

		let privmsg$ = client.privmsg$.pipe(
			filter(message => message.target === client.store.get('user.nick')),
		);

		// Authentication

		let login$ = privmsg$.pipe(
			filter(message => REGEXP_LOGIN.test(message.text)),
		);

		let logout$ = privmsg$.pipe(
			filter(message => message.text.startsWith('logout')),
		);

		let nick$ = client.nick$.pipe(
			filter(message => this.admins.includes(message.oldNick)),
		);

		let quit$ = client.quit$.pipe(
			filter(message => this.admins.includes(message.nick)),
		);

		// Remote control

		let admin$ = privmsg$.pipe(
			filter(message => this.admins.includes(message.sender)),
		);

		//  ____        _                   _       _   _
		// / ___| _   _| |__  ___  ___ _ __(_)_ __ | |_(_) ___  _ __  ___
		// \___ \| | | | '_ \/ __|/ __| '__| | '_ \| __| |/ _ \| '_ \/ __|
		//  ___) | |_| | |_) \__ \ (__| |  | | |_) | |_| | (_) | | | \__ \
		// |____/ \__,_|_.__/|___/\___|_|  |_| .__/ \__|_|\___/|_| |_|___/
		//                                   |_|
		//

		// Authentication

		login$.subscribe(message => {
			let [, username, password] = message.text.match(REGEXP_LOGIN);
			let text;

			if (
				this.settings.passwords.hasOwnProperty(username) &&
				this.settings.passwords[username] === password
			) {
				this.admins.push(message.sender);
				text = 'Login successful.';

				logger.log(`Login from ${message.sender}`);
			} else {
				text = 'Invalid credentials.';

				logger.warn(`Login attempt for ${message.sender}`);
			}

			client.actionOut$.next({
				command: 'NOTICE',
				target: message.sender,
				text,
			});
		});

		logout$.subscribe(message => {
			let index = this.admins.indexOf(message.sender);
			let text;

			if (index !== -1) {
				this.admins.splice(index, 1);
				text = 'Successfully logged out.';

				logger.log(`Logout from ${message.sender}`);
			} else {
				text = 'Not currently logged in.';
			}

			client.actionOut$.next({
				command: 'NOTICE',
				target: message.sender,
				text,
			});
		});

		nick$.subscribe(message => {
			let { oldNick, newNick } = message;
			let index = this.admins.indexOf(oldNick);

			this.admins.splice(index, 1, newNick);

			logger.log(`Nick change from ${oldNick} to ${newNick}`);
		});

		quit$.subscribe(message => {
			let index = this.admins.indexOf(message.nick);

			this.admins.splice(index, 1);

			logger.log(`Admin ${message.nick} quit`);
		});

		// Remote control

		admin$.subscribe(message => {
			let request = message.text.trim();

			if (REGEXP_QUIT.test(request)) {
				let [, reason] = request.match(REGEXP_QUIT);
				logger.info(message.sender, 'QUIT');

				client.actionOut$.next({
					command: 'QUIT',
					reason: reason || 'Gone',
				});
			} else if (REGEXP_JOIN.test(request)) {
				let [, channel] = request.match(REGEXP_JOIN);
				logger.info(message.sender, 'JOIN', channel);

				client.actionOut$.next({
					command: 'JOIN',
					channel,
				});
			} else if (REGEXP_PART.test(request)) {
				let [, channel, reason] = request.match(REGEXP_PART);
				logger.info(message.sender, 'PART', channel);

				client.actionOut$.next({
					command: 'PART',
					channel,
					reason,
				});
			} else if (REGEXP_MODE.test(request)) {
				let [, channel, flags, args] = request.match(REGEXP_MODE);
				let command = ['MODE', channel, flags];
				if (args) {
					command = command.concat(args.split(' '));
				}
				logger.info(message.sender, ...command);

				client.rawOut$.next(command.join(' '));
			} else if (REGEXP_TOPIC.test(request)) {
				let [, channel, text] = request.match(REGEXP_TOPIC);
				logger.info(message.sender, 'TOPIC', channel, text);

				client.actionOut$.next({
					command: 'TOPIC',
					text,
				});
			} else if (REGEXP_KICK.test(request)) {
				let [, channel, user, reason] = request.match(REGEXP_KICK);
				logger.info(message.sender, 'KICK', channel, user, reason);

				client.actionOut$.next({
					command: 'KICK',
					channel,
					user,
					reason,
				});
			} else if (REGEXP_NICK.test(request)) {
				let [, nick] = request.match(REGEXP_NICK);
				logger.info(message.sender, 'NICK', client.store.get('user.nick'), nick);

				client.actionOut$.next({
					command: 'NICK',
					nick,
				});
			} else if (REGEXP_PRIVS.test(request)) {
				let [, method, channel, nicks] = request.match(REGEXP_PRIVS);
				logger.info(message.sender, method.toUpperCase(), channel, nicks);
				client[method](channel, nicks.split(' '));
			} else if (REGEXP_TALK.test(request)) {
				let [, method, target, text] = request.match(REGEXP_TALK);
				logger.info(message.sender, method.toUpperCase(), target, text);

				client.actionOut$.next({
					command: method === 'tell'
						? 'PRIVMSG'
						: 'NOTICE',
					target,
					text,
				});
			}
		});
	}
}
