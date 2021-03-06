import GodfatherCommand from '@lib/GodfatherCommand';
import Game, { Phase } from '@mafia/structures/Game';
import type Player from '@mafia/structures/Player';
import { canManage } from '@root/lib/util/utils';
import { ApplyOptions } from '@sapphire/decorators';
import type { Args, CommandContext, CommandOptions } from '@sapphire/framework';
import { Time } from '@sapphire/time-utilities';
import type { Message } from 'discord.js';
import type { TFunction } from 'i18next';

@ApplyOptions<CommandOptions>({
	aliases: ['s', 'startgame'],
	description: 'commands/help:startDescription',
	detailedDescription: 'commands/help:startDetailed',
	preconditions: ['GuildOnly', 'GameOnly', 'HostOnly']
})
export default class extends GodfatherCommand {
	public async run(message: Message, args: Args, context: CommandContext) {
		const setupName = await args.rest('string').catch(() => '');
		const { game } = message.channel;
		const t = await message.fetchT();

		if (game!.hasStarted) throw t('commands/mafia:startAlreadyStarted');
		if (!game!.setup) game!.setup = await this.getSetup(message, game!, setupName, t);

		if (game!.setup!.totalPlayers !== game!.players.length)
			throw await message.resolveKey('commands/mafia:startWrongPlayerCount', { setup: game!.setup!.name, playerCount: game!.players!.length });

		if (game!.settings.numberedNicknames && message.guild!.me?.hasPermission('MANAGE_NICKNAMES')) {
			for (const plr of game!.players) {
				const member = await message.guild!.members.fetch(plr.user.id)!;
				if (message.guild!.me && canManage(message.guild!.me, member)) {
					await member
						.setNickname(`[${game!.players.indexOf(plr) + 1}] ${member!.displayName}`)
						.then(() => game!.numberedNicknames.add(member))
						.catch(() => null);
				}
			}
		}

		const sent = await message.channel.send(t('commands/mafia:startSetupChosen', { setup: game!.setup!.name }));
		game!.phase = Phase.Standby;
		const generatedRoles = game!.setup!.generate(this.context.client);
		for (const player of game!.players) {
			const { role, modifiers } = generatedRoles.shift()!;
			player.role = new role(player);
			for (const { modifier, context } of modifiers) {
				if (modifier.canPatch(player.role)) modifier.patch(player.role, context);
			}
		}

		const noPms: Player[] = [];
		for (const player of game!.players) {
			try {
				await player.sendPM();
			} catch (error) {
				this.context.client.logger.error(error);
				noPms.push(player);
			}
			await player.role.init();
		}

		await sent.edit(t('commands/mafia:startSentRolePms'));
		if (noPms.length > 0) {
			await message.channel.send(
				t('commands/mafia:startDmFail', { players: noPms.map((player) => player.toString()), prefix: context.prefix })
			);
		}

		if (game!.setup!.nightStart) {
			game!.cycle++;
			return game!.startNight();
		}
		return game!.startDay();
	}

	private async getSetup(message: Message, game: Game, setupName: string, t: TFunction) {
		const possibleSetups =
			setupName === ''
				? this.context.stores.get('setups').filter((setup) => setup.totalPlayers === game.players.length)
				: this.context.stores.get('setups').filter((setup) => setup.name === setupName);
		if (possibleSetups.size === 0)
			throw setupName === ''
				? t('commands/mafia:startNoSetups', { playerCount: game.players.length })
				: t('command/mafia:startSetupNotFound', { name: setupName });
		if (possibleSetups.size === 1) return possibleSetups.first();

		await message.channel.send(
			t('commands/mafia:startMultipleSetups', {
				amount: possibleSetups.size,
				setups: possibleSetups.map((setup) => `	-- ${setup.name}`).join('\n')
			})
		);
		const messages = await message.channel.awaitMessages(
			(msg: Message) =>
				!game.hasStarted &&
				msg.author.id === message.author.id &&
				Number.isInteger(parseInt(msg.content, 10)) &&
				parseInt(msg.content, 10) > 0 &&
				parseInt(msg.content, 10) <= possibleSetups.size,
			{
				max: 1,
				time: Time.Second * 30
			}
		);
		if (messages.size === 0 && !game.hasStarted) throw t('commands/mafia:startPromptAborted');
		return [...possibleSetups.values()][parseInt(messages.first()!.content, 10)! - 1];
	}
}
