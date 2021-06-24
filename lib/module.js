// NPM Dependencies
const { filter } = require('rxjs/operators');

// Local Depdendencies
const logger = require('./logger');
const { version } = require('../package.json');

/** Pattern for admin login. */
const REGEXP_LOGIN = /^login (\S+) (\S+)$/i;

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

			if (this.admins.includes(message.sender)) {
				text = 'Already logged in.';
			} else if (
				this.settings.passwords.hasOwnProperty(username) &&
				this.settings.passwords[username] === password
			) {
				this.admins.push(message.sender);
				text = 'Login successful.';

				logger.log('[AUTH]', message.sender, 'LOGIN', username);
			} else {
				text = 'Invalid credentials.';

				logger.warn('[AUTH]', message.sender, 'LOGIN FAIL', username);
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

				logger.log('[AUTH]', message.sender, 'LOGOUT');
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

			logger.log('[AUTH]', oldNick, 'NICK', newNick);
		});

		quit$.subscribe(message => {
			let index = this.admins.indexOf(message.nick);

			this.admins.splice(index, 1);

			logger.log('[AUTH]', message.nick, 'QUIT');
		});

		// Remote control

		admin$.subscribe(message => {
			let admin = message.sender;
			let params = message.text.trim().split(' ');
			let command = params.shift().toUpperCase();

			switch (command) {
				case 'QUIT': {
					let reason = params.join(' ') || 'Gone';

					logger.log(admin, command, reason);

					client.actionOut$.next({
						command,
						reason,
					});
					break;
				}

				case 'JOIN': {
					let [channel] = params;

					logger.log(admin, command, channel);

					client.actionOut$.next({
						command,
						channel,
					});
					break;
				}

				case 'PART': {
					let channel = params.shift();
					let reason = params.join(' ');

					logger.log(admin, command, channel, reason);

					client.actionOut$.next({
						command,
						channel,
						reason,
					});
					break;
				}

				case 'MODE': {
					let channel = params.shift();
					let raw_out = [command, channel, ...params].join(' ');

					logger.log(admin, raw_out);

					client.rawOut$.next(raw_out);
					break;
				}

				case 'TOPIC': {
					let channel = params.shift();
					let text = params.join(' ');

					logger.log(admin, command, channel, text);

					client.actionOut$.next({
						command,
						channel,
						text,
					});
					break;
				}

				case 'KICK': {
					let channel = params.shift();
					let user = params.shift();
					let reason = params.join(' ');

					logger.log(admin, command, channel, user, reason);

					client.actionOut$.next({
						command,
						channel,
						user,
						reason,
					});
					break;
				}

				case 'NICK': {
					let [nick] = params;
					let nick_old = client.store.get('user.nick');

					logger.log(admin, command, nick_old, '->', nick);

					client.actionOut$.next({
						command,
						nick,
					});
					break;
				}

				case 'TELL':
				case 'NOTIFY': {
					let target = params.shift();
					let text = params.join(' ');

					logger.log(admin, command, target, text);

					client.actionOut$.next({
						command: command === 'TELL'
							? 'PRIVMSG'
							: 'NOTICE',
						target,
						text,
					});
					break;
				}

				case 'ACTION': {
					let target = params.shift();
					let text = params.join(' ');

					logger.log(admin, command, target, text);

					client.actionOut$.next({
						command: 'CTCP',
						target,
						text: `ACTION ${text}`,
					});
					break;
				}

				case 'GIVE':
				case 'TAKE': {
					let action = command === 'GIVE' ? '+' : '-';
					let subcommand = params.shift().toUpperCase();

					switch (subcommand) {
						case 'OP':
						case 'HOP':
						case 'VOICE': {
							let channel = params.shift();
							let privilege = subcommand.substring(0, 1).toLowerCase();
							let nicks = params;

							logger.log(admin, command, subcommand, channel, privilege, ...nicks);

							client.setPrivileges(channel, action, privilege, nicks);
							break;
						}

						default: {
							client.actionOut$.next({
								command: 'NOTICE',
								target: admin,
								text: `${command} ${subcommand} does not exist.`,
							});
						}
					}
					break;
				}

				case 'LOGIN':
				case 'LOGOUT':
					// Login and logout are handled in their own subscriptions.
					// But, without these cases the error below would be sent.
					break;

				default: {
					client.actionOut$.next({
						command: 'NOTICE',
						target: admin,
						text: `${command} does not exist.`,
					});
				}
			}
		});
	}
}
