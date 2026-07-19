const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js')
const { supabaseAdmin } = require('../lib/supabaseAdmin')

function buildStandingsMessage(eventName, teams, tilesByNumber, boardSize) {
  const sorted = [...teams].sort((a, b) => b.board_position - a.board_position)
  const medals = ['🥇', '🥈', '🥉']

  const lines = sorted.map((team, index) => {
    const rank = medals[index] ?? `${index + 1}.`
    let line = `${rank} **${team.name}** — vak ${team.board_position}/${boardSize}`
    if (team.board_position >= boardSize) line += ' 🏁'
    if (team.pending_penalty) line += ' ⏳ (strafworp klaar)'

    const tile = tilesByNumber[team.board_position]
    if (tile && team.board_position > 0) {
      line += `\n     📜 ${tile.description}`
    }
    return line
  })

  return `**Stand van ${eventName}:**\n\n${lines.join('\n')}`
}

async function showStandings(interaction, eventId) {
  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, name, config')
    .eq('id', eventId)
    .single()

  const boardSize = event?.config?.boardSize ?? 63

  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id, name, board_position, pending_penalty')
    .eq('event_id', eventId)

  if (!teams || teams.length === 0) {
    return interaction.editReply('Dit event heeft nog geen teams.')
  }

  const { data: tiles } = await supabaseAdmin
    .from('board_tiles')
    .select('*')
    .eq('event_id', eventId)

  const tilesByNumber = {}
  for (const t of tiles ?? []) tilesByNumber[t.tile_number] = t

  const message = buildStandingsMessage(event.name, teams, tilesByNumber, boardSize)
  return interaction.editReply(message)
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stand')
    .setDescription('Toon de huidige stand van het actieve Ganzebord-event'),

  showStandings,

  async execute(interaction) {
    await interaction.deferReply()

    const { data: community } = await supabaseAdmin
      .from('communities')
      .select('id')
      .eq('discord_guild_id', interaction.guildId)
      .single()

    if (!community) {
      return interaction.editReply(
        'Deze Discord-server is nog niet gekoppeld aan een community. Vraag de eigenaar om /koppel-server uit te voeren.'
      )
    }

    const { data: events } = await supabaseAdmin
      .from('events')
      .select('id, name')
      .eq('community_id', community.id)
      .eq('type', 'ganzebord')
      .eq('status', 'active')

    if (!events || events.length === 0) {
      return interaction.editReply('Er is nu geen actief Ganzebord-event.')
    }

    if (events.length > 1) {
      const menu = new StringSelectMenuBuilder()
        .setCustomId('stand_select_event')
        .setPlaceholder('Kies een event')
        .addOptions(events.map((e) => ({ label: e.name, value: e.id })))
      const row = new ActionRowBuilder().addComponents(menu)
      return interaction.editReply({ content: 'Van welk event wil je de stand zien?', components: [row] })
    }

    return showStandings(interaction, events[0].id)
  },
}
