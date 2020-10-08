import ActionRole from '@mafia/mixins/ActionRole';
import { Event, Events, PieceContext } from '@sapphire/framework';
import { Message } from 'discord.js';

export default class extends Event<Events.UnknownCommand> {

	public constructor(context: PieceContext) {
		super(context, { event: Events.UnknownCommand });
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public run(message: Message, command: string) {
		// actions are accepted in DMs only
		if (message.guild) return;

		const game = this.client.games.find(game => Boolean(game.players.get(message.author)));
		if (!game) return;

		const player = game.players.get(message.author)!;
		if (!(player.role! instanceof ActionRole)) return;

		if (player.role!.actionPhase !== game.phase) return;
		// await player.role!.onPmCommand(commandText, ...message.args as string[]);
	}

}