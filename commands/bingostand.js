const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js')
const { supabaseAdmin } = require('../lib/supabaseAdmin')

// Let op: dit checkt specifiek op de rol 'owner', niet 'organizer' — dit
// commando is met opzet strenger dan de meeste andere beheer-commando's.
async function checkOwnerPermission(discordUserId, communityId) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('discord_id', discordUserId)
    .single()

  if (!profile) return false

  const { data: membership } = await supabaseAdmin
    .from('community_members')
    .select('role')
    .eq('community_id', communityId)
    .eq('profile_id', profile.id)
    .eq('role', 'owner')
    .maybeSingle()

  return !!membership
}

function buildStandingsMessage(eventName, teams, tiles, completions) {
  const tilesById = {}
  for (const t of tiles) tilesById[t.id] = t

  const lines = teams.map((team) => {
    const teamCompletions = completions.filter((c) => c.team_id === team.id)
    const completedTitles = teamCompletions
      .map((c) => tilesById[c.tile_id])
      .filter(Boolean)
      .sort((a, b) => a.position - b.position)
      .map((t) => `${t.position}. ${t.title}`)

    let line = `**${team.name}** — ${teamCompletions.length}/${tiles.length} vakjes`
    if (completedTitles.length > 0) {
      line += `\n     ${completedTitles.join(', ')}`
    } else {
      line += `\n     (nog niets voltooid)`
    }
    return line
  })

  let message = `**Tussenstand ${eventName}:**\n\n${lines.join('\n\n')}`

  // Discord-berichten mogen max. 2000 tekens zijn; kort desnoods in
  if (message.length > 1900) {
    message = message.slice(0, 1900) + '\n...(ingekort, te veel data voor één bericht)'
  }

  return message
}

async function showBingoStandings(interaction, eventId) {
  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, name')
    .eq('id', eventId)
    .single()

  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id, name')
    .eq('event_id', eventId)

  if (!teams || teams.length === 0) {
    return interaction.editReply('Dit event heeft nog geen teams.')
  }

  const { data: tiles } = await supabaseAdmin
    .from('bingo_tiles')
    .select('id, position, title')
    .eq('event_id', eventId)

  const tileIds = (tiles ?? []).map((t) => t.id)

  let completions = []
  if (tileIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('bingo_completions')
      .select('tile_id, team_id')
      .in('tile_id', tileIds)
    completions = data ?? []
  }

  const message = buildStandingsMessage(event.name, teams, tiles ?? [], completions)
  return interaction.editReply(message)
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bingostand')
    .setDescription('Toon per team welke Bingo-vakjes al zijn behaald (alleen voor owners)'),

  showBingoStandings,

  async execute(interaction) {
    // Publiek zichtbaar in het kanaal, niet alleen voor de owner zelf
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

    const isOwner = await checkOwnerPermission(interaction.user.id, community.id)
    if (!isOwner) {
      return interaction.editReply('Alleen de owner van deze community mag dit commando gebruiken.')
    }

    const { data: events } = await supabaseAdmin
      .from('events')
      .select('id, name')
      .eq('community_id', community.id)
      .eq('type', 'bingo')
      .eq('status', 'active')

    if (!events || events.length === 0) {
      return interaction.editReply('Er is nu geen actief Bingo-event.')
    }

    if (events.length === 1) {
      return showBingoStandings(interaction, events[0].id)
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('bingostand_select_event')
      .setPlaceholder('Kies een event')
      .addOptions(events.map((e) => ({ label: e.name, value: e.id })))

    const row = new ActionRowBuilder().addComponents(menu)

    return interaction.editReply({
      content: 'Van welk event wil je de tussenstand zien?',
      components: [row],
    })
  },
}
